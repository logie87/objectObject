import hashlib
import json
import logging
import os
import sqlite3
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from pipelines import run_iep_alignment_selected

import jwt
import uvicorn
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
    Path as FPath,
    Query,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr

from logger import SimpleAppLogger

# ============================================================
# ======================= CONFIG =============================
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
LOG_DIR = BASE_DIR / "logs"

DB_PATH     = DATA_DIR / "instuctive.db"
LIB_DIR     = DATA_DIR / "library"
LIB_INDEX   = LIB_DIR / "index.json"
STU_DIR     = DATA_DIR / "students"
USERS_DIR   = DATA_DIR / "users"
REPORTS_DIR = DATA_DIR / "reports"
REPORTS_INDEX = REPORTS_DIR / "index.json"

JWT_SECRET = os.environ.get(
    "JWT_SECRET",
    "48XDWJdPQUg34NkVdK2BwvrscDYyzuhKqZmSxYNk4xAgvL2T5rxrfwWFzKqnhsT6Y5jELHJe7KJQvmHSW6rSPNu7TQnwewYu33J9",
)
JWT_ALG = "HS256"

app = FastAPI()

# ============================================================
# ========================= LOGGING ==========================
# ============================================================

logging.getLogger("watchfiles.main").level = logging.ERROR
LOG_DIR.mkdir(parents=True, exist_ok=True)
logger = SimpleAppLogger(str(LOG_DIR), "instructive_api", logging.INFO).get_logger()

# ============================================================
# ====================== MODELS ==============================
# ============================================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str  # sha256 hex from frontend

class DocMeta(BaseModel):
    id: str
    filename: str
    title: str
    size: int
    sha256: str
    uploaded_at: str  # ISO
    tags: List[str] = []
    source: Optional[str] = None

class DocMetaUpdate(BaseModel):
    title: Optional[str] = None
    tags: Optional[List[str]] = None

class StudentSummary(BaseModel):
    id: str
    name: str
    grade: Optional[str] = None
    teacher: Optional[str] = None
    alignment_pct: Optional[int] = None
    badges: List[str] = []

class StudentFull(BaseModel):
    id: str
    data: Dict  # full JSON payload from file

class StudentUpdate(BaseModel):
    # Partial update; deep-merge into file JSON
    student: Optional[Dict] = None
    performance_progress: Optional[str] = None
    education_goals: Optional[Dict] = None
    accommodations: Optional[Dict] = None
    assessments: Optional[str] = None
    transition_goals: Optional[str] = None
    participants: Optional[List[Dict]] = None
    alignment_pct: Optional[int] = None  # allow storing alignment with file if desired

class MeSettings(BaseModel):
    show_setup_on_login: bool

# Reports
REPORT_CATEGORIES = [
    "Class Alignment",
    "Activity Fit",
    "Accommodation Compliance",
]

class ReportMeta(BaseModel):
    id: str
    filename: str
    title: str
    size: int
    sha256: str
    generated_at: str
    category: str
    tags: List[str] = []
    students: List[str] = []  # <— NEW: searchable student names


class ReportUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None

security = HTTPBearer()

class IEPAlignRequest(BaseModel):
    student_ids: List[str]
    courses: List[str]
    units: List[str]

class IEPAlignResponse(BaseModel):
    meta: Dict
    matrix: Dict
    details: Dict
    row_averages: List[float]
    column_averages: List[float]


# ============================================================
# ==================== DATABASE HELPERS ======================
# ============================================================

def get_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def _table_has_column(conn: sqlite3.Connection, table: str, col: str) -> bool:
    cur = conn.execute(f"PRAGMA table_info({table});")
    return any(r[1] == col for r in cur.fetchall())

def init_user_db():
    """Create table if missing and migrate required columns."""
    conn = get_db()
    c = conn.cursor()
    c.execute("""
      CREATE TABLE IF NOT EXISTS users(
        id    INTEGER PRIMARY KEY AUTOINCREMENT,
        name  TEXT,
        email TEXT NOT NULL UNIQUE,
        pwd   TEXT NOT NULL,
        is_new INTEGER DEFAULT 1,
        show_setup_on_login INTEGER DEFAULT 1
      );
    """)
    if not _table_has_column(conn, "users", "name"):
        c.execute("ALTER TABLE users ADD COLUMN name TEXT;")
    if not _table_has_column(conn, "users", "is_new"):
        c.execute("ALTER TABLE users ADD COLUMN is_new INTEGER DEFAULT 1;")
    if not _table_has_column(conn, "users", "show_setup_on_login"):
        c.execute("ALTER TABLE users ADD COLUMN show_setup_on_login INTEGER DEFAULT 1;")
    conn.commit()
    conn.close()
    logger.info("User database initialized/migrated.")

# ============================================================
# =================== FS HELPERS (LIB/STU/RPT) ==============
# ============================================================

def ensure_library():
    LIB_DIR.mkdir(parents=True, exist_ok=True)
    if not LIB_INDEX.exists():
        with open(LIB_INDEX, "w", encoding="utf-8") as f:
            json.dump({"docs": {}}, f)

def _load_index() -> Dict[str, Dict]:
    ensure_library()
    with open(LIB_INDEX, "r", encoding="utf-8") as f:
        return json.load(f)

def _save_index(data: Dict):
    tmp = str(LIB_INDEX) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, LIB_INDEX)

def _safe_filename(name: str) -> str:
    keep = "-_.() "
    return "".join(c for c in name if c.isalnum() or c in keep).strip() or "document.pdf"

def _now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds") + "Z"

def ensure_students_dir():
    STU_DIR.mkdir(parents=True, exist_ok=True)

def ensure_users_dir():
    USERS_DIR.mkdir(parents=True, exist_ok=True)

def ensure_reports_dir():
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    if not REPORTS_INDEX.exists():
        with open(REPORTS_INDEX, "w", encoding="utf-8") as f:
            json.dump({"reports": {}}, f)

# ====== Students FS helpers ======

def _student_name_from_id(sid: str) -> Optional[str]:
    p = _student_file_for_id(sid)
    if not p.exists():
        return None
    try:
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
        nm = data.get("student", {}).get("student_name")
        if isinstance(nm, str) and nm.strip():
            return nm.strip()
    except Exception as e:
        logger.warning(f"Failed reading student {sid}: {e}")
    return None


def _student_file_for_id(sid: str) -> Path:
    # id is filename without extension, guard against path traversal
    safe = "".join(ch for ch in sid if ch.isalnum() or ch in "-_")
    return STU_DIR / f"{safe}.json"

def _scan_students() -> List[Tuple[str, Dict]]:
    """
    Scan /data/students for individual student JSONs.
    Ignores aggregator/aux files like index.json, reports.json, and hidden/underscore files.
    """
    ensure_students_dir()
    out: List[Tuple[str, Dict]] = []
    for p in sorted(STU_DIR.glob("*.json")):
        stem = p.stem.lower()
        # Skip known non-student files and hidden ones
        if stem in {"index", "reports"} or p.name.startswith("_") or p.name.startswith("."):
            continue
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
            sid = p.stem
            out.append((sid, data))
        except Exception as e:
            logger.warning(f"Skipping student file {p.name}: {e}")
    return out


def _badges_from_accommodations(accom_text: str) -> List[str]:
    s = accom_text.lower()
    badges = []
    if "reading" in s:
        badges.append("Reading")
    if "time" in s or "extra time" in s:
        badges.append("Time")
    if "scribe" in s or "oral" in s:
        badges.append("Alternate Response")
    return list(dict.fromkeys(badges))  # de-dupe preserve order

def _summarize_student(sid: str, data: Dict) -> StudentSummary:
    student = data.get("student", {})
    name = student.get("student_name") or student.get("name") or sid
    grade = student.get("grade")
    teacher = student.get("teacher")
    alignment = data.get("alignment_pct")
    acc = data.get("accommodations", {}) or {}
    accom_concat = " ".join(str(v) for v in acc.values() if isinstance(v, str))
    badges = _badges_from_accommodations(accom_concat)
    return StudentSummary(
        id=sid, name=name, grade=grade, teacher=teacher,
        alignment_pct=alignment if isinstance(alignment, int) else None,
        badges=badges
    )

def _merge_deep(orig: Dict, patch: Dict) -> Dict:
    for k, v in patch.items():
        if isinstance(v, dict) and isinstance(orig.get(k), dict):
            _merge_deep(orig[k], v)
        else:
            orig[k] = v
    return orig

# ====== Course-reports store (course/unit rollups for pie charts) ======

CUR_REPORTS_PATH = (DATA_DIR / "curriculum" / "reports.json")

def _load_course_reports() -> Dict[str, Dict]:
    """
    Shape:
    {
      "courses": {
        "<course>": {
          "updated_at": ISO,
          "selection": {"units": [...]},
          "overall": int,
          "metrics": {
            "understanding": int,
            "accessibility": int,
            "accommodation": int,
            "engagement": int
          },
          "students_count": int,
          "worksheets_count": int
        },
        ...
      }
    }
    """
    CUR_DIR.mkdir(parents=True, exist_ok=True)
    if not CUR_REPORTS_PATH.exists():
        return {"courses": {}}
    try:
        with open(CUR_REPORTS_PATH, "r", encoding="utf-8") as f:
            obj = json.load(f)
        if not isinstance(obj, dict) or "courses" not in obj:
            return {"courses": {}}
        if not isinstance(obj["courses"], dict):
            obj["courses"] = {}
        return obj
    except Exception as e:
        logger.warning(f"Failed loading course reports store: {e}")
        return {"courses": {}}

def _save_course_reports(obj: Dict[str, Dict]) -> None:
    CUR_DIR.mkdir(parents=True, exist_ok=True)
    tmp = str(CUR_REPORTS_PATH) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, CUR_REPORTS_PATH)

def _all_student_names() -> List[str]:
    """
    Return all student.student_name values from /data/students/*.json
    (skips index/reports/hidden files). Missing names are ignored.
    """
    names: List[str] = []
    for p in sorted(STU_DIR.glob("*.json")):
        stem = p.stem.lower()
        if stem in {"index", "reports"} or p.name.startswith("_") or p.name.startswith("."):
            continue
        try:
            with open(p, "r", encoding="utf-8") as f:
                j = json.load(f)
            nm = str(j.get("student", {}).get("student_name", "")).strip()
            if nm:
                names.append(nm)
        except Exception:
            continue
    return names

def _status_from_mean(mean: int) -> str:
    # Mirror your default thresholds
    return "good" if mean >= 85 else ("warn" if mean >= 70 else "bad")
def _apply_course_fit_overrides(course: str, units: List[str], worksheet_overall: Dict[str, int]) -> None:
    """
    Update per-unit sidecars (legacy) AND root curriculum/index.json (preferred).
    worksheet_overall: filename -> int mean
    """
    # 1) Update per-unit sidecars if they exist
    for unit in units:
        unit_dir = CUR_DIR / course / unit
        if not unit_dir.exists():
            continue
        idx_path = unit_dir / "index.json"
        try:
            current = {}
            if idx_path.exists():
                with open(idx_path, "r", encoding="utf-8") as f:
                    current = json.load(f)
            if not isinstance(current, dict):
                current = {}
            changed = False
            for pdf in unit_dir.iterdir():
                if not (pdf.is_file() and pdf.suffix.lower() == ".pdf"):
                    continue
                fname = pdf.name
                norm = _normalize_fname(fname)
                if norm in worksheet_overall:
                    mean = int(worksheet_overall[norm])
                    rec = current.get(fname) or {}
                    fit = rec.get("fit") or {}
                    spread = int(fit.get("spread", 20 if mean >= 80 else 28))
                    status = _status_from_mean(mean)
                    current[fname] = {
                        **rec,
                        "fit": {"mean": mean, "spread": spread, "status": status},
                    }
                    changed = True
            if changed:
                tmp = str(idx_path) + ".tmp"
                with open(tmp, "w", encoding="utf-8") as f:
                    json.dump(current, f, ensure_ascii=False, indent=2)
                os.replace(tmp, idx_path)
        except Exception as e:
            logger.warning(f"Failed updating unit sidecar for {course}/{unit}: {e}")

    # 2) Update ROOT index.json
    root = _load_curriculum_root_index()
    courses = root.setdefault("courses", {})
    course_map = courses.get(course)
    if not course_map:
        _save_curriculum_root_index(root)
        return
    changed_root = False
    for unit in units:
        res_list = course_map.get(unit) or []
        # res_list is a list of dicts with filename + fit
        for rec in res_list:
            fn = _normalize_fname(rec.get("filename", ""))
            if fn in worksheet_overall:
                new_mean = int(worksheet_overall[fn])
                old_fit = rec.get("fit") or {}
                spread = int(old_fit.get("spread", 20 if new_mean >= 80 else 28))
                status = _status_from_mean(new_mean)
                rec["fit"] = {"mean": new_mean, "spread": spread, "status": status}
                changed_root = True
    if changed_root:
        _save_curriculum_root_index(root)


# ====== Student-reports store (for pie charts, latest alignment) ======

STU_REPORTS_PATH = STU_DIR / "reports.json"

def _load_student_reports() -> Dict[str, Dict]:
    """
    Shape:
    {
      "students": {
        "<sid>": {
          "updated_at": ISO,
          "selection": {"courses": [...], "units": [...]},
          "overall": int,
          "metrics": {
            "understanding": int,
            "accessibility": int,
            "accommodation": int,
            "engagement": int
          }
        },
        ...
      }
    }
    """
    ensure_students_dir()
    if not STU_REPORTS_PATH.exists():
        return {"students": {}}
    try:
        with open(STU_REPORTS_PATH, "r", encoding="utf-8") as f:
            obj = json.load(f)
        if not isinstance(obj, dict) or "students" not in obj:
            return {"students": {}}
        if not isinstance(obj["students"], dict):
            obj["students"] = {}
        return obj
    except Exception as e:
        logger.warning(f"Failed loading student reports store: {e}")
        return {"students": {}}

def _save_student_reports(obj: Dict[str, Dict]) -> None:
    ensure_students_dir()
    tmp = str(STU_REPORTS_PATH) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, STU_REPORTS_PATH)


# ====== Reports helpers ======
def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def _guess_category_from_name(name: str) -> str:
    n = name.lower()
    if "snapshot" in n or "fire" in n:
        return REPORT_CATEGORIES[0]
    if "fit" in n or "worksheet" in n:
        return REPORT_CATEGORIES[1]
    if any(x in n for x in ["compliance", "accommodation", "requirement"]):
        return REPORT_CATEGORIES[2]
    return REPORT_CATEGORIES[0]

def _load_reports_index() -> Dict[str, Dict]:
    ensure_reports_dir()
    try:
        with open(REPORTS_INDEX, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"reports": {}}

def _save_reports_index(obj: Dict):
    tmp = str(REPORTS_INDEX) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, REPORTS_INDEX)

def _rebuild_reports_index() -> Dict[str, Dict]:
    idx = _load_reports_index()
    existing = idx.get("reports", {})
    seen_ids = set()
    for p in REPORTS_DIR.glob("*.pdf"):
        stat = p.stat()
        sha = _sha256_file(p)
        rid = sha[:16]
        seen_ids.add(rid)
        meta = existing.get(rid) or {}
        title = meta.get("title") or p.stem
        category = meta.get("category") or _guess_category_from_name(p.name)
        tags = meta.get("tags") or []
        students = meta.get("students") or []  # <— NEW: preserve previously stored names
        existing[rid] = {
            "id": rid,
            "filename": p.name,
            "title": title,
            "size": stat.st_size,
            "sha256": sha,
            "generated_at": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds") + "Z",
            "category": category,
            "tags": tags,
            "students": students,  # <— NEW
        }

    # remove stale
    stale = [rid for rid, m in existing.items() if not (REPORTS_DIR / m["filename"]).exists()]
    for rid in stale:
        existing.pop(rid, None)
    idx["reports"] = existing
    _save_reports_index(idx)
    return idx

# ====== Robust PDF writer for alignment reports (ReportLab if available, else text-PDF) ======

def _create_pdf_report(
    title: str,
    category: str,
    tags: Optional[List[str]] = None,
    payload: Optional[dict] = None,  # pass the alignment result dict so we can include student names in filename
) -> Dict[str, str]:
    """
    Write a readable PDF into /data/reports and upsert /data/reports/index.json.
    If ReportLab is available, render a proper report. Otherwise, fall back to a text PDF.

    Filenames now include student names (from payload.meta.students or matrix.students),
    e.g., "IEP Alignment — Math 10 - Alex_Johnson-Liam_Chen-20251110-104455.pdf",
    and then are renamed to have the {id}- prefix after hashing for stable IDs.
    """
    ensure_reports_dir()
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    # --- Extract student names (minimal, robust)
    def _students_from_payload(pl: Optional[dict]) -> List[str]:
        if not isinstance(pl, dict):
            return []
        meta_students = (pl.get("meta", {}) or {}).get("students") or []
        matrix_students = (pl.get("matrix", {}) or {}).get("students") or []
        names = [str(n).strip() for n in (meta_students or matrix_students) if isinstance(n, str) and n.strip()]
        # de-dupe preserving order
        seen = set()
        out = []
        for n in names:
            if n not in seen:
                seen.add(n)
                out.append(n)
        return out

    def _slug_students(names: List[str]) -> str:
        if not names:
            return ""
        # limit to first 3 names, trim long parts
        trimmed = []
        for n in names[:3]:
            # replace spaces with underscores, keep basic ASCII-alnum+underscores only
            n2 = "".join(ch if ch.isalnum() else ("_" if ch.isspace() else "") for ch in n).strip("_")
            if len(n2) > 24:
                n2 = n2[:24]
            if n2:
                trimmed.append(n2)
        suffix = "-".join(trimmed)
        if len(names) > 3:
            suffix += f"-and-{len(names)-3}-more"
        return suffix

    students = _students_from_payload(payload)
    students_suffix = _slug_students(students)

    # --- Build a safe, human-readable base filename (now with student names)
    now = datetime.now()
    now_str = now.strftime("%Y%m%d-%H%M%S")
    safe_title = _safe_filename(title) or "report"
    base = f"{safe_title}"
    if students_suffix:
        base += f" - {students_suffix}"
    tmp_name = f"{base}-{now_str}.pdf"
    # keep filenames reasonable
    if len(tmp_name) > 160:
        # truncate middle
        head, tail = tmp_name[:100], tmp_name[-55:]
        tmp_name = head + "…" + tail
    tmp_path = REPORTS_DIR / tmp_name

    # --- Try ReportLab (pretty PDF)
    used_reportlab = False
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

        doc = SimpleDocTemplate(str(tmp_path), pagesize=letter, title=title)
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name="Meta", fontSize=9, leading=12, textColor=colors.grey))
        story = []

        story.append(Paragraph(title, styles["Title"]))
        story.append(Spacer(1, 6))

        meta_line = f"{category} • {now.isoformat(timespec='seconds')}Z"
        if tags:
            meta_line += " • " + ", ".join(tags)
        if students:
            meta_line += " • Students: " + ", ".join(students[:3]) + ("…" if len(students) > 3 else "")
        story.append(Paragraph(meta_line, styles["Meta"]))
        story.append(Spacer(1, 12))

        if isinstance(payload, dict):
            meta = payload.get("meta", {}) or {}
            matrix = payload.get("matrix", {}) or {}
            details = payload.get("details", {}) or {}

            students_list = list(meta.get("students", []) or matrix.get("students", []) or [])
            worksheets = list(meta.get("worksheets", []) or matrix.get("worksheets", []) or [])
            row_avgs = payload.get("row_averages", []) or []
            col_avgs = payload.get("column_averages", []) or []

            hdr = (
                f"Students: {len(students_list)} &nbsp;&nbsp; "
                f"Worksheets: {len(worksheets)} &nbsp;&nbsp; "
                f"Row avg: {', '.join(str(int(round(x))) for x in row_avgs) or '—'} &nbsp;&nbsp; "
                f"Column avg: {', '.join(str(int(round(x))) for x in col_avgs) or '—'}"
            )
            story.append(Paragraph(hdr, styles["Normal"]))
            story.append(Spacer(1, 10))

            if details:
                ws_key = sorted(details.keys())[0]
                per_ws = details.get(ws_key, {}) or {}
                data = [["Student", "Understanding", "Accessibility", "Accommodation", "Engagement", "Overall"]]
                for s in students_list or sorted(per_ws.keys()):
                    d = per_ws.get(s, {}) if isinstance(per_ws.get(s, {}), dict) else {}
                    def _grab(name):
                        v = d.get(name)
                        try:
                            return int(round(float(v)))
                        except Exception:
                            return ""
                    data.append([
                        s,
                        _grab("understanding_fit"),
                        _grab("accessibility_fit"),
                        _grab("accommodation_fit"),
                        _grab("engagement_fit"),
                        _grab("overall_alignment"),
                    ])
                tbl = Table(data, repeatRows=1)
                tbl.setStyle(TableStyle([
                    ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#f0f0f0")),
                    ("GRID", (0,0), (-1,-1), 0.25, colors.grey),
                    ("ALIGN", (1,1), (-1,-1), "CENTER"),
                    ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
                    ("FONTSIZE", (0,0), (-1,0), 9),
                    ("FONTSIZE", (0,1), (-1,-1), 9),
                    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#fafafa")]),
                ]))
                story.append(Paragraph(f"Worksheet: {ws_key}", styles["Heading3"]))
                story.append(Spacer(1, 4))
                story.append(tbl)

        else:
            story.append(Paragraph("Summary will appear here when payload data is provided.", styles["BodyText"]))

        doc.build(story)
        used_reportlab = True
    except Exception as e:
        logger.warning(f"ReportLab not available or failed ({e}); using text-PDF fallback.")
        # Fallback text-PDF (one page, visible text)
        content_lines = [
            title,
            f"Category: {category}",
            f"Generated: {now.isoformat(timespec='seconds')}Z",
            f"Students: {', '.join(students)}" if students else "Students: —",
            f"Tags: {', '.join(tags or [])}" if tags else "Tags: —",
        ]
        try:
            def _esc(s: str) -> str:
                return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            y = 750
            stream = "BT /F1 14 Tf 72 {} Td ({}) Tj ET\n".format(y, _esc(content_lines[0]))
            y -= 20
            for line in content_lines[1:]:
                stream += "BT /F1 10 Tf 72 {} Td ({}) Tj ET\n".format(y, _esc(line))
                y -= 14
            stream_bytes = stream.encode("latin-1", "replace")
            objects = []
            objects.append("1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n")
            objects.append("2 0 obj <</Type /Pages /Count 1 /Kids [3 0 R]>> endobj\n")
            objects.append(
                "3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                "/Resources <</Font <</F1 4 0 R>>>> /Contents 5 0 R>> endobj\n"
            )
            objects.append("4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n")
            objects.append(f"5 0 obj <</Length {len(stream_bytes)}>> stream\n".encode("latin-1") + stream_bytes + b"\nendstream\nendobj\n")
            with open(tmp_path, "wb") as f:
                f.write(b"%PDF-1.4\n")
                offsets = []
                for obj in objects:
                    offsets.append(f.tell())
                    f.write(obj if isinstance(obj, bytes) else obj.encode("latin-1"))
                xref_pos = f.tell()
                f.write(f"xref\n0 {len(objects)+1}\n".encode("latin-1"))
                f.write(b"0000000000 65535 f \n")
                for off in offsets:
                    f.write(f"{off:010d} 00000 n \n".encode("latin-1"))
                f.write(
                    (
                        "trailer <</Size {size}/Root 1 0 R>>\nstartxref\n{start}\n%%EOF"
                    ).format(size=len(objects)+1, start=xref_pos).encode("latin-1")
                )
        except Exception as e2:
            with open(tmp_path, "wb") as f:
                f.write(
                    b"%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n"
                    b"2 0 obj <</Type /Pages /Count 1 /Kids [3 0 R]>> endobj\n"
                    b"3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj\n"
                    b"xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000061 00000 n \n0000000127 00000 n \n"
                    b"trailer <</Size 4/Root 1 0 R>>\nstartxref\n193\n%%EOF"
                )
            logger.warning(f"Text-PDF fallback also failed to render text ({e2}); wrote minimal PDF.")

    # --- Compute sha/id, rename to add id prefix, update index
        # --- Compute sha/id, rename to add id prefix, update index
    sha = _sha256_file(tmp_path)
    rid = sha[:16]
    final_name = f"{rid}-{tmp_name}"
    final_path = REPORTS_DIR / final_name
    os.replace(tmp_path, final_path)

    # try to reuse parsed students if available, else empty list
    idx = _load_reports_index()
    idx.setdefault("reports", {})[rid] = {
        "id": rid,
        "filename": final_name,
        "title": title,
        "size": final_path.stat().st_size,
        "sha256": sha,
        "generated_at": datetime.fromtimestamp(final_path.stat().st_mtime).isoformat(timespec="seconds") + "Z",
        "category": category,
        "tags": list(tags or []),
        "students": students if 'students' in locals() else [],  # <— NEW
    }
    _save_reports_index(idx)
    logger.info(f"Report PDF created: {final_name} (category={category})")
    return {"id": rid, "filename": final_name}



# ============================================================
# ======================= JWT HELPERS ========================
# ============================================================

def create_jwt(user_id: int, email: str) -> str:
    payload = {"sub": str(user_id), "email": email, "iat": int(time.time())}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return payload
    except Exception as e:
        logger.warning(f"Invalid JWT: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")
    


@app.get("/align/history")
async def align_history(course: str, unit: str, resource: str, user=Depends(verify_jwt)):
    """
    Returns last alignment summary for a specific worksheet:
    {
      "affected": [student names below threshold],
      "consensus": [bullet lines],
      "evidence": "short string"
    }
    """
    key = f"{course}|{unit}|{_normalize_fname(resource)}"
    hist = _load_align_history()
    rec = hist.get(key)
    if not rec:
        raise HTTPException(status_code=404, detail="No history")
    return rec


# ============================================================
# ======================= MIDDLEWARE =========================
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://instructive-ui.vercel.app",
        "https://www.instructive.ca",
        "https://instructive.ca",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# ============================================================
# ====================== STARTUP HOOK ========================
# ============================================================

@app.on_event("startup")
def _startup():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ensure_users_dir()
    ensure_students_dir()
    ensure_library()
    ensure_reports_dir()
    init_user_db()

# ============================================================
# ======================= AUTH ROUTES ========================
# ============================================================

class _LoginRow(BaseModel):
    id: int
    name: Optional[str]
    email: str

@app.post("/auth/login")
async def login(req: LoginRequest):
    email = req.email.lower()
    password = req.password
    if len(password) != 64:
        raise HTTPException(status_code=400, detail="Invalid password hash length")

    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, name, email FROM users WHERE email = ? AND pwd = ?;", (email, password))
    row = c.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_id, user_name, user_email = row
    token = create_jwt(user_id, user_email)
    logger.info(f"User '{user_email}' logged in successfully.")
    return {"access_token": token, "user_name": user_name or user_email, "token_type": "bearer"}

# ============================================================
# ======================= ME / PROFILE =======================
# ============================================================

@app.get("/me")
async def me(user=Depends(verify_jwt)):
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("SELECT id, name, email, is_new, show_setup_on_login FROM users WHERE id = ?;", (user["sub"],))
        row = c.fetchone()
    finally:
        conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": row["id"],
        "name": row["name"] or row["email"],
        "email": row["email"],
        "is_new": bool(row["is_new"]),
        "show_setup_on_login": bool(row["show_setup_on_login"]),
        "avatar_url": f"/me/avatar?ts={int(time.time())}",
    }

@app.get("/me/settings", response_model=MeSettings)
async def get_settings(user=Depends(verify_jwt)):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT show_setup_on_login FROM users WHERE id = ?;", (user["sub"],))
    row = c.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return {"show_setup_on_login": bool(row["show_setup_on_login"])}

@app.put("/me/settings", response_model=MeSettings)
async def update_settings(payload: MeSettings, user=Depends(verify_jwt)):
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE users SET show_setup_on_login = ? WHERE id = ?;", (1 if payload.show_setup_on_login else 0, user["sub"]))
    conn.commit()
    conn.close()
    return {"show_setup_on_login": payload.show_setup_on_login}

@app.get("/me/avatar")
async def me_avatar(user=Depends(verify_jwt)):
    email = user["email"]
    base = USERS_DIR
    cand = [base / f"{email}.png", base / f"{email}.jpg", base / f"{email}.jpeg"]
    for p in cand:
        if p.exists():
            return FileResponse(
                str(p),
                media_type="image/png" if p.suffix.lower()==".png" else "image/jpeg",
                headers={
                    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                    "Pragma": "no-cache",
                    "Expires": "0",
                },
            )
    return Response(status_code=404, headers={
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
    })

# ============================================================
# ======================= HOME ROUTES ========================
# ============================================================

@app.post("/is_new")
async def is_new(user=Depends(verify_jwt)):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT is_new FROM users WHERE id = ?;", (user["sub"],))
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    is_new_val = bool(int(row[0]))
    if is_new_val:
        c.execute("UPDATE users SET is_new = 0 WHERE id = ?;", (user["sub"],))
        conn.commit()
    conn.close()
    return {"isFirstLogin": is_new_val}

# ============================================================
# ===================== LIBRARY ROUTES =======================
# ============================================================

@app.get("/library", response_model=List[DocMeta])
async def list_documents(user=Depends(verify_jwt)):
    data = _load_index()
    docs = [DocMeta(**m) for m in data.get("docs", {}).values()]
    docs.sort(key=lambda d: d.uploaded_at, reverse=True)
    return docs

@app.post("/library/upload", response_model=DocMeta)
async def upload_document(
    user=Depends(verify_jwt),
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")
    ensure_library()

    content = await file.read()
    size = len(content)
    sha256 = hashlib.sha256(content).hexdigest()
    doc_id = sha256[:16]

    data = _load_index()
    docs = data.setdefault("docs", {})
    if doc_id in docs:
        return DocMeta(**docs[doc_id])

    safe_name = _safe_filename(file.filename)
    stored_name = f"{doc_id}-{safe_name}"
    stored_path = LIB_DIR / stored_name
    with open(stored_path, "wb") as f:
        f.write(content)

    meta = DocMeta(
        id=doc_id,
        filename=stored_name,
        title=title or os.path.splitext(safe_name)[0],
        size=size,
        sha256=sha256,
        uploaded_at=_now_iso(),
        tags=[t.strip() for t in tags.split(",")] if tags else [],
        source="upload",
    ).model_dump()

    docs[doc_id] = meta
    _save_index(data)
    logger.info(f"Uploaded doc {stored_name} ({size} bytes) by {user['email']}")
    return DocMeta(**meta)

@app.get("/library/{doc_id}", response_model=DocMeta)
async def get_document(doc_id: str = FPath(..., min_length=6, max_length=64), user=Depends(verify_jwt)):
    data = _load_index()
    meta = data.get("docs", {}).get(doc_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Not found")
    return DocMeta(**meta)

@app.get("/library/{doc_id}/file")
async def download_document(doc_id: str = FPath(..., min_length=6, max_length=64), user=Depends(verify_jwt)):
    data = _load_index()
    meta = data.get("docs", {}).get(doc_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Not found")
    path = LIB_DIR / meta["filename"]
    if not path.exists():
        raise HTTPException(status_code=410, detail="File missing on disk")
    return FileResponse(str(path), media_type="application/pdf", filename=meta["filename"])

@app.put("/library/{doc_id}", response_model=DocMeta)
async def update_document(payload: DocMetaUpdate, doc_id: str = FPath(..., min_length=6, max_length=64), user=Depends(verify_jwt)):
    data = _load_index()
    docs = data.get("docs", {})
    meta = docs.get(doc_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Not found")

    if payload.title is not None:
        meta["title"] = payload.title.strip() or meta["title"]
    if payload.tags is not None:
        meta["tags"] = [t.strip() for t in payload.tags if t.strip()]

    docs[doc_id] = meta
    _save_index(data)
    return DocMeta(**meta)

@app.delete("/library/{doc_id}")
async def delete_document(doc_id: str = FPath(..., min_length=6, max_length=64), user=Depends(verify_jwt)):
    data = _load_index()
    docs = data.get("docs", {})
    meta = docs.get(doc_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Not found")

    path = LIB_DIR / meta["filename"]
    try:
        if path.exists():
            path.unlink()
    finally:
        docs.pop(doc_id, None)
        _save_index(data)
    logger.info(f"Deleted doc {doc_id} by {user['email']}")
    return {"ok": True}

# ============================================================
# ====================== REPORTS ROUTES ======================
# ============================================================

@app.get("/reports", response_model=List[ReportMeta])
async def list_reports(
    user=Depends(verify_jwt),
    category: Optional[str] = Query(None),
    sort: str = Query("recent", pattern="^(recent|title|size)$"),
):
    idx = _rebuild_reports_index()
    items = [ReportMeta(**m) for m in idx.get("reports", {}).values()]
    if category:
        items = [r for r in items if r.category == category]
    if sort == "recent":
        items.sort(key=lambda r: r.generated_at, reverse=True)
    elif sort == "title":
        items.sort(key=lambda r: r.title.lower())
    elif sort == "size":
        items.sort(key=lambda r: r.size, reverse=True)
    return items

@app.get("/reports/categories")
async def list_report_categories(user=Depends(verify_jwt)):
    return {"categories": REPORT_CATEGORIES}

@app.put("/reports/{rid}", response_model=ReportMeta)
async def update_report(rid: str, payload: ReportUpdate, user=Depends(verify_jwt)):
    idx = _rebuild_reports_index()
    rep = idx.get("reports", {}).get(rid)
    if not rep:
        raise HTTPException(status_code=404, detail="Not found")
    if payload.title is not None:
        rep["title"] = payload.title.strip() or rep["title"]
    if payload.category is not None:
        if payload.category not in REPORT_CATEGORIES:
            raise HTTPException(status_code=400, detail="Invalid category")
        rep["category"] = payload.category
    if payload.tags is not None:
        rep["tags"] = [t.strip() for t in payload.tags if t.strip()]
    idx["reports"][rid] = rep
    _save_reports_index(idx)
    return ReportMeta(**rep)

@app.get("/reports/{rid}/file")
async def download_report(rid: str, user=Depends(verify_jwt)):
    idx = _rebuild_reports_index()
    rep = idx.get("reports", {}).get(rid)
    if not rep:
        raise HTTPException(status_code=404, detail="Not found")
    path = REPORTS_DIR / rep["filename"]
    if not path.exists():
        raise HTTPException(status_code=410, detail="File missing on disk")
    return FileResponse(str(path), media_type="application/pdf", filename=rep["filename"])

# ============================================================
# ===================== STUDENTS ROUTES ======================
# ============================================================

@app.get("/students", response_model=List[StudentSummary])
async def list_students(user=Depends(verify_jwt)):
    rows = _scan_students()
    out = [ _summarize_student(sid, data) for sid, data in rows ]
    # Sort by name asc
    out.sort(key=lambda s: s.name.lower())
    return out

@app.get("/students/{sid}", response_model=StudentFull)
async def get_student(sid: str, user=Depends(verify_jwt)):
    p = _student_file_for_id(sid)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found")
    with open(p, "r", encoding="utf-8") as f:
        data = json.load(f)
    return StudentFull(id=sid, data=data)

@app.put("/students/{sid}", response_model=StudentFull)
async def update_student(sid: str, payload: StudentUpdate, user=Depends(verify_jwt)):
    p = _student_file_for_id(sid)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found")
    try:
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Corrupt JSON for {sid}: {e}")

    patch = payload.model_dump(exclude_unset=True)
    # If present, nest values into the file
    for key in ["student", "education_goals", "accommodations"]:
        if key in patch and isinstance(patch[key], dict):
            src = data.get(key, {}) if isinstance(data.get(key), dict) else {}
            data[key] = _merge_deep(src, patch[key])
            patch.pop(key, None)

    # Scalars / lists at top level
    for k in ["performance_progress", "assessments", "transition_goals", "participants", "alignment_pct"]:
        if k in patch:
            data[k] = patch[k]

    # Write back atomically
    tmp = p.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, p)

    logger.info(f"Student {sid} updated by {user['email']}")
    return StudentFull(id=sid, data=data)


# ============================================================
# ================== STUDENT REPORTS ROUTES ==================
# ============================================================

@app.get("/students/reports")
async def get_students_reports(user=Depends(verify_jwt)):
    """
    Returns the latest per-student alignment snapshot used by pie charts.
    """
    store = _load_student_reports()
    return store

@app.get("/students/{sid}/reports")
async def get_student_report(sid: str, user=Depends(verify_jwt)):
    """
    Returns one student's latest alignment snapshot (or 404 if none).
    """
    store = _load_student_reports()
    rec = store.get("students", {}).get(sid)
    if not rec:
        raise HTTPException(status_code=404, detail="No report snapshot for this student")
    return rec


# ============================================================
# =================== CURRICULUM: API BLOCK ==================
# ============================================================

from pydantic import BaseModel, Field

CUR_DIR = DATA_DIR / "curriculum"

CUR_ROOT_INDEX = DATA_DIR / "curriculum" / "index.json"
ALIGN_HISTORY_PATH = DATA_DIR / "curriculum" / "history.json"

def _normalize_fname(s: str) -> str:
    # match pipeline keys like "._File.pdf" to actual "File.pdf"
    s = str(s or "")
    if s.startswith("._"):
        s = s[2:]
    return s.strip()

def _load_curriculum_root_index() -> Dict:
    try:
        if CUR_ROOT_INDEX.exists():
            with open(CUR_ROOT_INDEX, "r", encoding="utf-8") as f:
                obj = json.load(f)
            if isinstance(obj, dict) and "courses" in obj:
                return obj
    except Exception as e:
        logger.warning(f"curriculum root index read failed: {e}")
    return {"courses": {}}

def _save_curriculum_root_index(obj: Dict) -> None:
    CUR_DIR.mkdir(parents=True, exist_ok=True)
    tmp = str(CUR_ROOT_INDEX) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, CUR_ROOT_INDEX)

def _load_align_history() -> Dict[str, Dict]:
    # key: f"{course}|{unit}|{filename}"
    try:
        if ALIGN_HISTORY_PATH.exists():
            with open(ALIGN_HISTORY_PATH, "r", encoding="utf-8") as f:
                obj = json.load(f)
            if isinstance(obj, dict):
                return obj
    except Exception as e:
        logger.warning(f"align history read failed: {e}")
    return {}

def _save_align_history(hist: Dict[str, Dict]) -> None:
    tmp = str(ALIGN_HISTORY_PATH) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(hist, f, ensure_ascii=False, indent=2)
    os.replace(tmp, ALIGN_HISTORY_PATH)

def _load_curriculum_analysis() -> Dict:
    """
    Shape:
    { "<course>": { "<unit>": { "<filename>": {
         "updated_at": ISO,
         "students": { "<Student Name>": {... per-student detail from pipeline ...} }
    }}}}
    """
    CUR_DIR.mkdir(parents=True, exist_ok=True)
    if ALIGN_HISTORY_PATH.exists():
        try:
            with open(ALIGN_HISTORY_PATH, "r", encoding="utf-8") as f:
                j = json.load(f)
            if isinstance(j, dict):
                return j
        except Exception:
            pass
    return {}

def _save_curriculum_analysis(obj: Dict) -> None:
    tmp = str(ALIGN_HISTORY_PATH) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, ALIGN_HISTORY_PATH)

def _update_index_fit_from_overall(course: str, units: list[str], worksheet_overall: Dict[str, int]) -> None:
    """
    Update data/curriculum/index.json 'fit' for matching filenames.
    """
    idx = _load_curriculum_root_index()
    courses = idx.setdefault("courses", {})
    cobj = courses.get(course)
    if not isinstance(cobj, dict):
        return
    changed = False
    for unit in units:
        ulist = cobj.get(unit)
        if not isinstance(ulist, list):
            continue
        for item in ulist:
            try:
                fname = _normalize_fname(item.get("filename"))
                if fname in worksheet_overall:
                    mean = int(worksheet_overall[fname])
                    spread = int(item.get("fit", {}).get("spread", 20 if mean >= 80 else 28))
                    status = "good" if mean >= 85 else ("warn" if mean >= 70 else "bad")
                    item["fit"] = {"mean": mean, "spread": spread, "status": status}
                    changed = True
            except Exception:
                continue
    if changed:
        _save_curriculum_index(idx)

def _persist_analysis_details(course: str, units: list[str], details: Dict[str, Dict[str, Dict]]) -> None:
    """
    Write last-run per-worksheet student details into analysis.json.
    We locate the unit for each filename by searching the index.
    """
    idx = _load_curriculum_root_index()
    analysis = _load_curriculum_analysis()
    analysis.setdefault(course, {})

    # Build lookup: filename -> unit (first match)
    fname_to_unit: Dict[str, str] = {}
    cobj = idx.get("courses", {}).get(course, {}) if isinstance(idx.get("courses"), dict) else {}
    for unit in units:
        for item in cobj.get(unit, []) or []:
            fname_to_unit[_normalize_fname(item.get("filename", ""))] = unit

    now = _now_iso()
    for raw_fname, per_student in (details or {}).items():
        fname = _normalize_fname(raw_fname)
        unit = fname_to_unit.get(fname)
        if not unit:
            # not found under selected units; skip
            continue
        cu = analysis[course].setdefault(unit, {})
        cu[fname] = {
            "updated_at": now,
            "students": per_student or {}
        }

    _save_curriculum_analysis(analysis)


class ResourceOut(BaseModel):
    name: str
    filename: str
    path: str           # "<course>/<unit>/<filename>"
    size: int
    uploaded_at: str
    fit: dict           # {"mean": int, "spread": int, "status": "good|warn|bad"}
    issues: List[str] = Field(default_factory=list)

class CurriculumOut(BaseModel):
    courses: Dict[str, Dict[str, List[ResourceOut]]]

class ReorderIn(BaseModel):
    order: List[str]  # filenames in the desired order

class AnalysisOut(BaseModel):
    affected: List[str]
    consensus: List[str]
    evidence: str

class SnapshotIn(BaseModel):
    resources: List[str]  # filenames within the unit

def _iso_from_stat(path: Path) -> str:
    try:
        ts = path.stat().st_mtime
        return datetime.fromtimestamp(ts).isoformat(timespec="seconds") + "Z"
    except Exception:
        return _now_iso()

def _load_order(unit_dir: Path) -> List[str]:
    order_file = unit_dir / "order.json"
    if order_file.exists():
        try:
            with open(order_file, "r", encoding="utf-8") as f:
                obj = json.load(f)
            if isinstance(obj, dict) and "order" in obj and isinstance(obj["order"], list):
                return [str(x) for x in obj["order"]]
        except Exception:
            pass
    return []

def _save_order(unit_dir: Path, filenames: List[str]) -> None:
    order_file = unit_dir / "order.json"
    tmp = str(order_file) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"order": filenames}, f, ensure_ascii=False, indent=2)
    os.replace(tmp, order_file)
def _scan_curriculum() -> CurriculumOut:
    """
    If data/curriculum/index.json exists (root index with courses->units->resources), use it.
    Otherwise fall back to scanning folders and per-unit sidecars.
    """
    root = _load_curriculum_root_index()
    if root.get("courses"):
        # Normalize into API shape, preserve provided fit/issues exactly
        courses: Dict[str, Dict[str, List[ResourceOut]]] = {}
        for course, units in root["courses"].items():
            uout: Dict[str, List[ResourceOut]] = {}
            for unit, resources in (units or {}).items():
                lst: List[ResourceOut] = []
                for rec in (resources or []):
                    # rec already has the fields as the user showed
                    lst.append(ResourceOut(
                        name=rec.get("name") or Path(_normalize_fname(rec.get("filename",""))).stem,
                        filename=_normalize_fname(rec.get("filename","")),
                        path=f"{course}/{unit}/{_normalize_fname(rec.get('filename',''))}",
                        size=int(rec.get("size", 0)),
                        uploaded_at=str(rec.get("uploaded_at") or _now_iso()),
                        fit=rec.get("fit") or {"mean": 80, "spread": 15, "status": "warn"},
                        issues=rec.get("issues", []) or []
                    ))
                uout[unit] = lst
            courses[course] = uout
        return CurriculumOut(courses=courses)

    # ---- legacy fallback (unchanged): scan filesystem + per-unit sidecars ----
    courses: Dict[str, Dict[str, List[ResourceOut]]] = {}
    for course_dir in sorted(CUR_DIR.iterdir()):
        if not course_dir.is_dir():
            continue
        course_name = course_dir.name
        units: Dict[str, List[ResourceOut]] = {}
        for unit_dir in sorted(course_dir.iterdir()):
            if not unit_dir.is_dir():
                continue
            unit_name = unit_dir.name
            files = [p for p in unit_dir.iterdir()
                     if p.is_file()
                     and p.suffix.lower() == ".pdf"
                     and p.name not in ("index.json", "order.json")]
            unit_index = {}
            idx_path = unit_dir / "index.json"
            if idx_path.exists():
                try:
                    with open(idx_path, "r", encoding="utf-8") as f:
                        unit_index = json.load(f)
                except Exception:
                    unit_index = {}
            def default_fit(n: str) -> dict:
                lower = n.lower()
                mean = 88
                if "quiz" in lower or "exit" in lower:
                    mean = 62
                elif "lab" in lower or "station" in lower or "hands" in lower:
                    mean = 90
                spread = 20 if mean >= 80 else 28
                status = "good" if mean >= 85 else ("warn" if mean >= 70 else "bad")
                return {"mean": mean, "spread": spread, "status": status}
            items: List[ResourceOut] = []
            for pdf in files:
                meta = unit_index.get(pdf.name, {})
                fit = meta.get("fit") or default_fit(pdf.name)
                issues = meta.get("issues") or []
                items.append(ResourceOut(
                    name=pdf.stem,
                    filename=pdf.name,
                    path=f"{course_name}/{unit_name}/{pdf.name}",
                    size=pdf.stat().st_size,
                    uploaded_at=_iso_from_stat(pdf),
                    fit=fit,
                    issues=issues
                ))
            order = _load_order(unit_dir)
            if order:
                order_map = {fn: i for i, fn in enumerate(order)}
                items.sort(key=lambda r: order_map.get(r.filename, 10_000))
            else:
                items.sort(key=lambda r: r.name.lower())
            units[unit_name] = items
        courses[course_name] = units

    return CurriculumOut(courses=courses)

@app.get("/curriculum", response_model=CurriculumOut)
async def get_curriculum(user=Depends(verify_jwt)):
    obj = _load_curriculum_root_index()
    # Coerce to pydantic shape
    return CurriculumOut(courses=obj.get("courses", {}))


@app.post("/curriculum/{course}/{unit}/reorder")
async def reorder_unit(payload: ReorderIn, course: str, unit: str, user=Depends(verify_jwt)):
    """
    Persist new order for unit PDFs. Payload is the list of filenames (not paths).
    """
    unit_dir = CUR_DIR / course / unit
    if not unit_dir.exists():
        raise HTTPException(status_code=404, detail="Unit not found")
    # Ensure all filenames exist as PDFs in the unit
    existing = {p.name for p in unit_dir.iterdir() if p.is_file() and p.suffix.lower()==".pdf"}
    for fn in payload.order:
        if fn not in existing:
            raise HTTPException(status_code=400, detail=f"File not in unit: {fn}")
    _save_order(unit_dir, payload.order)
    return {"ok": True}
@app.get("/curriculum/{course}/{unit}/analysis", response_model=AnalysisOut)
async def analyze_resource(course: str, unit: str, resource: str, user=Depends(verify_jwt)):
    fname = _normalize_fname(resource)
    store = _load_curriculum_analysis()
    course_rec = store.get(course, {})
    unit_rec = course_rec.get(unit, {})
    res = unit_rec.get(fname)

    if isinstance(res, dict) and isinstance(res.get("students"), dict) and res["students"]:
        per = res["students"]  # { "Student Name": {understanding_fit,...,overall_alignment,...} }
        affected = []
        u_vals, a_vals, ac_vals, e_vals, o_vals = [], [], [], [], []
        for s_name, d in per.items():
            try:
                u_vals.append(int(d.get("understanding_fit", 0)))
                a_vals.append(int(d.get("accessibility_fit", 0)))
                ac_vals.append(int(d.get("accommodation_fit", 0)))
                e_vals.append(int(d.get("engagement_fit", 0)))
                o = int(d.get("overall_alignment", 0))
                o_vals.append(o)
                if o < 80:
                    affected.append(s_name)
            except Exception:
                continue

        def avg(xs): 
            xs = [int(x) for x in xs if isinstance(x, (int, float))]
            return int(round(sum(xs)/len(xs))) if xs else 0

        u,a,ac,e,ov = avg(u_vals), avg(a_vals), avg(ac_vals), avg(e_vals), avg(o_vals)
        consensus = []
        if u < 80: consensus.append("Add worked examples and vocabulary pre-teach.")
        if a < 80: consensus.append("Provide visuals/captions and guided notes.")
        if ac < 80: consensus.append("Apply accommodations (scribe/extra time/alternate response).")
        if e < 80: consensus.append("Chunk tasks and offer shorter, choice-based items.")
        if not consensus:
            consensus.append("Keep as-is; monitor for individual adjustments.")

        evidence = f"Avg overall {ov}%; understanding {u}%, accessibility {a}%, accommodation {ac}%, engagement {e}%. Students: {len(per)}."

        return AnalysisOut(affected=sorted(affected), consensus=consensus, evidence=evidence)

    # Fallback: legacy heuristic if we have no real record
    low = fname.lower()
    if "exit" in low or "quiz" in low:
        return AnalysisOut(
            affected=["S1","S3","S8"],
            consensus=["Reduce item count; allow oral check-in.","Time extension 1.5×; split into two parts."],
            evidence="Heuristic (no prior analysis found)."
        )
    elif "video" in low or "reading" in low:
        return AnalysisOut(
            affected=["S4","S6","S10","S12"],
            consensus=["Provide guided notes with visuals.","Enable captions and transcript."],
            evidence="Heuristic (no prior analysis found)."
        )
    else:
        return AnalysisOut(
            affected=["S2","S7"],
            consensus=["Keep as-is; offer optional visual supports."],
            evidence="Heuristic (no prior analysis found)."
        )


@app.post("/curriculum/{course}/{unit}/snapshot")
async def class_snapshot(payload: SnapshotIn, course: str, unit: str, user=Depends(verify_jwt)):
    """
    Demo: create a placeholder PDF in /data/reports and index it as
    'Class Alignment Snapshot — Today’s Fire Map' for quick access.
    """
    # 1) Make a tiny valid PDF (placeholder)
    REPORTS_DIR = DATA_DIR / "reports"
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now().strftime("%Y%m%d-%H%M%S")
    rid = f"snapshot-{course}-{unit}-{now}"
    pdf_file = REPORTS_DIR / f"{rid}.pdf"
    # minimal PDF payload
    pdf_bytes = b"%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Count 1 /Kids [3 0 R]>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000061 00000 n \n0000000127 00000 n \ntrailer <</Size 4/Root 1 0 R>>\nstartxref\n193\n%%EOF"
    with open(pdf_file, "wb") as f:
        f.write(pdf_bytes)

    # 2) Update reports index via existing reports system if present
    #    (compatible with earlier /reports design; if missing, silently skip).
    reports_index = DATA_DIR / "reports" / "index.json"
    index = {"reports": {}}
    if reports_index.exists():
        try:
            with open(reports_index, "r", encoding="utf-8") as f:
                index = json.load(f)
        except Exception:
            index = {"reports": {}}
    # Insert/overwrite entry
    index["reports"][rid] = {
        "id": rid,
        "filename": pdf_file.name,
        "title": f"Class Alignment Snapshot — {course} / {unit}",
        "size": pdf_file.stat().st_size,
        "sha256": hashlib.sha256(pdf_file.read_bytes()).hexdigest(),
        "uploaded_at": _now_iso(),
        "category": "Class Alignment Snapshot — Today’s Fire Map",
        "unit": unit,
        "course": course,
        "source": "snapshot",
        "tags": ["auto", "snapshot"] + [f for f in (payload.resources or [])],
    }
    tmp = str(reports_index) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    os.replace(tmp, reports_index)

    logger.info(f"Snapshot report created: {pdf_file.name} for {course}/{unit}")
    return {"ok": True, "report_id": rid, "filename": pdf_file.name}

@app.get("/curriculum/{course}/{unit}/{filename}")
async def get_curriculum_resource(course: str, unit: str, filename: str, user=Depends(verify_jwt)):
    """
    Returns a single PDF resource for viewing/downloading.
    Authorization required (uses JWT like other endpoints).
    Ignores index.json/order.json and only serves *.pdf.
    """
    unit_dir = CUR_DIR / course / unit
    file_path = unit_dir / filename

    if not unit_dir.exists() or not file_path.exists():
        raise HTTPException(status_code=404, detail="Resource not found")
    if file_path.suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF resources are served")
    if file_path.name in ("index.json", "order.json"):
        raise HTTPException(status_code=400, detail="Not a resource")

    return FileResponse(
        str(file_path),
        media_type="application/pdf",
        filename=file_path.name,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )

# ===================== SEARCH ROUTES =====================
from functools import lru_cache
from urllib.parse import quote_plus

# --- Search data models ---
class SearchItem(BaseModel):
    kind: str              # 'report' | 'library' | 'student' | 'course' | 'unit' | 'resource' | 'function'
    id: str
    title: str
    subtitle: Optional[str] = None
    route: Optional[str] = None     # where to navigate (SPA route)
    api_file: Optional[str] = None  # if present, front-end should fetch blob and open
    score: float = 0.0              # simple relevance score

# --- Local helpers for reading existing stores without importing routes ---
REPORTS_DIR   = DATA_DIR / "reports"
REPORTS_INDEX = REPORTS_DIR / "index.json"
CURR_DIR      = DATA_DIR / "curriculum"  # /course/unit/resource.pdf

def _load_json_safe(path: Path, default):
    try:
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        logger.warning(f"search/_load_json_safe error: {e}")
    return default

def _reports_list() -> List[dict]:
    # Shape aligned with earlier Reports feature (id, title, filename, size, uploaded_at, category, course, unit)
    idx = _load_json_safe(REPORTS_INDEX, {"reports": {}})
    items = []
    for rid, meta in idx.get("reports", {}).items():
        # Skip index files accidentally placed in reports dir
        if str(meta.get("filename", "")).lower() == "index.json":
            continue
        # tolerate sparse fields
        meta["id"] = rid
        items.append(meta)
    # sort newest first
    items.sort(key=lambda m: m.get("uploaded_at", ""), reverse=True)
    return items

def _library_list() -> List[dict]:
    data = _load_index()  # existing library helper
    docs = [m for m in data.get("docs", {}).values()]
    # filter out index.json if it sneaked in
    docs = [d for d in docs if str(d.get("filename","")).lower() != "index.json"]
    docs.sort(key=lambda d: d.get("uploaded_at",""), reverse=True)
    return docs

def _students_list() -> List[dict]:
    # Prefer index.json if present, else scan files in data/students
    base = STU_DIR
    items = []
    try:
        data = _students_load()  # respects STU_INDEX if present
        for s in data.get("students", {}).values():
            items.append(s)
    except Exception:
        # fallback to per-file scan
        for p in base.glob("*.json"):
            try:
                j = _load_json_safe(p, {})
                if "student" in j:
                    s = j["student"]
                    items.append({"id": p.stem, "name": s.get("student_name")})
            except Exception:
                continue
    return items

def _curriculum_scan() -> List[dict]:
    """Scan data/curriculum/<course>/<unit>/* for resources."""
    out = []
    if not CURR_DIR.exists():
        return out
    for course_dir in CURR_DIR.iterdir():
        if not course_dir.is_dir():
            continue
        course = course_dir.name
        for unit_dir in course_dir.iterdir():
            if not unit_dir.is_dir():
                continue
            unit = unit_dir.name
            for f in unit_dir.iterdir():
                if f.suffix.lower() not in (".pdf",):  # only PDFs for now
                    continue
                # Ignore index files if any
                if f.name.lower() == "index.json":
                    continue
                out.append({
                    "course": course,
                    "unit": unit,
                    "filename": f.name,
                    "path": str(f.relative_to(CURR_DIR)),
                })
    return out

@lru_cache(maxsize=1)
def _function_catalog() -> List[dict]:
    # Lightweight "what can I do" mapping -> routes
    return [
        {"id": "open-reports", "title": "Open Reports", "route": "/app/reports"},
        {"id": "open-library", "title": "Open Library", "route": "/app/library"},
        {"id": "manage-students", "title": "Manage Students", "route": "/app/students"},
        {"id": "browse-curriculum", "title": "Browse Curriculum", "route": "/app/curriculum"},
        {"id": "student-reports", "title": "Students: View report outputs", "route": "/app/reports"},
        {"id": "upload-library", "title": "Upload worksheet to Library", "route": "/app/library"},
    ]

def _score(q: str, text: str) -> float:
    ql = q.lower().strip()
    tl = (text or "").lower()
    if not ql:
        return 0.1
    if ql == tl:
        return 2.0
    if ql in tl:
        return 1.0 + min(0.9, len(ql) / max(10, len(tl)))
    # token overlap
    qset = set(ql.split())
    tset = set(tl.split())
    inter = len(qset & tset)
    return 0.3 * inter

def _route_curriculum(course: str, unit: Optional[str] = None, open_path: Optional[str] = None) -> str:
    # SPA route with qs hints the Curriculum page understands
    qs = []
    if course: qs.append(f"course={quote_plus(course)}")
    if unit:   qs.append(f"unit={quote_plus(unit)}")
    if open_path: qs.append(f"open={quote_plus(open_path)}")
    return "/app/curriculum" + (("?" + "&".join(qs)) if qs else "")

@app.get("/search")
async def search(s: str, limit: int = 8, user=Depends(verify_jwt)) -> List[SearchItem]:
    """Federated search over reports, library, students, curriculum + function catalog."""
    q = s.strip()
    items: List[SearchItem] = []

    # Reports
    for r in _reports_list():
        title = r.get("title") or r.get("filename") or r.get("id")
        cat   = r.get("category") or ""
        course = r.get("course") or ""
        unit = r.get("unit") or ""
        text = " ".join([title, cat, course, unit])
        sc = _score(q, text)
        if sc <= 0: 
            continue
        items.append(SearchItem(
            kind="report",
            id=r["id"],
            title=title,
            subtitle=" • ".join([p for p in [cat, course, unit] if p]),
            route=None,
            api_file=f"/reports/{r['id']}/file",
            score=sc + 0.2  # slight boost for concrete artifacts
        ))

    # Library docs
    for d in _library_list():
        title = d.get("title") or d.get("filename") or d.get("id")
        text = " ".join([title] + (d.get("tags") or []))
        sc = _score(q, text)
        if sc <= 0:
            continue
        items.append(SearchItem(
            kind="library",
            id=d["id"],
            title=title,
            subtitle="Library PDF",
            api_file=f"/library/{d['id']}/file",
            score=sc
        ))

    # Students
    for srow in _students_list():
        nm = srow.get("name") or srow.get("student_name") or srow.get("id")
        sc = _score(q, nm or "")
        if sc <= 0:
            continue
        items.append(SearchItem(
            kind="student",
            id=str(srow.get("id") or nm),
            title=nm,
            subtitle="Student",
            route="/app/students",
            score=sc + 0.1
        ))

    # Curriculum: courses / units / resources
    # Courses
    seen_courses = set()
    for rec in _curriculum_scan():
        seen_courses.add(rec["course"])
    for course in seen_courses:
        sc = _score(q, course)
        if sc > 0:
            items.append(SearchItem(
                kind="course",
                id=course,
                title=course,
                subtitle="Course",
                route=_route_curriculum(course=course),
                score=sc
            ))
    # Units + Resources
    for rec in _curriculum_scan():
        unit = rec["unit"]
        course = rec["course"]
        fname = rec["filename"]
        unit_sc = _score(q, f"{course} {unit}")
        file_sc = _score(q, f"{course} {unit} {fname}")
        if unit_sc > 0:
            items.append(SearchItem(
                kind="unit",
                id=f"{course}/{unit}",
                title=f"{unit}",
                subtitle=f"{course}",
                route=_route_curriculum(course=course, unit=unit),
                score=unit_sc
            ))
        if file_sc > 0:
            items.append(SearchItem(
                kind="resource",
                id=f"{course}/{unit}/{fname}",
                title=fname,
                subtitle=f"{course} • {unit}",
                route=_route_curriculum(course=course, unit=unit, open_path=rec["path"]),
                score=file_sc + 0.15
            ))

    # Functions (generic actions -> pages)
    for f in _function_catalog():
        sc = _score(q, f["title"])
        if sc <= 0:
            continue
        items.append(SearchItem(
            kind="function",
            id=f["id"],
            title=f["title"],
            subtitle="Action",
            route=f["route"],
            score=sc * 0.8
        ))

    # Rank & cut
    items.sort(key=lambda it: it.score, reverse=True)
    return items[:max(1, min(20, limit))]

@app.get("/search/suggest")
async def search_suggest(s: Optional[str] = "", limit: int = 6, user=Depends(verify_jwt)) -> List[SearchItem]:
    """Lightweight suggest: prefix match across functions + top artifacts."""
    q = (s or "").strip()
    out: List[SearchItem] = []

    # If no query: show a mixed starter set
    if not q:
        # top functions
        for f in _function_catalog()[:3]:
            out.append(SearchItem(kind="function", id=f["id"], title=f["title"], route=f["route"], score=1.0))
        # latest reports
        for r in _reports_list()[:3]:
            out.append(SearchItem(kind="report", id=r["id"], title=r.get("title") or r.get("filename") or r["id"],
                                  subtitle=(r.get("category") or ""), api_file=f"/reports/{r['id']}/file", score=0.9))
        return out[:limit]

    # With query
    # prefer exact-ish startswith for each domain, then fall back to /search top-ks
    ql = q.lower()
    # functions
    for f in _function_catalog():
        if f["title"].lower().startswith(ql):
            out.append(SearchItem(kind="function", id=f["id"], title=f["title"], route=f["route"], score=2))
    # students
    for srow in _students_list():
        nm = (srow.get("name") or srow.get("student_name") or "").lower()
        if nm.startswith(ql):
            out.append(SearchItem(kind="student", id=str(srow.get("id") or nm), title=srow.get("name") or srow.get("student_name"),
                                  subtitle="Student", route="/app/students", score=1.8))
    # reports
    for r in _reports_list():
        title = (r.get("title") or r.get("filename") or "").lower()
        if title.startswith(ql):
            out.append(SearchItem(kind="report", id=r["id"], title=r.get("title") or r.get("filename"),
                                  subtitle=r.get("category") or "", api_file=f"/reports/{r['id']}/file", score=1.7))
    # curriculum resources
    for rec in _curriculum_scan():
        fname = rec["filename"].lower()
        if fname.startswith(ql):
            out.append(SearchItem(kind="resource", id=rec["path"], title=rec["filename"],
                                  subtitle=f"{rec['course']} • {rec['unit']}",
                                  route=_route_curriculum(course=rec["course"], unit=rec["unit"], open_path=rec["path"]),
                                  score=1.6))

    if len(out) >= limit:
        out.sort(key=lambda x: x.score, reverse=True)
        return out[:limit]

    # fill using /search ranking
    more = await search(q, limit=limit)
    seen = {(x.kind, x.id) for x in out}
    for m in more:
        if (m.kind, m.id) in seen:
            continue
        out.append(m)
        if len(out) >= limit:
            break
    out.sort(key=lambda x: x.score, reverse=True)
    return out[:limit]

# ============================================================
# =================== ALIGNMENT (IEP-SELECTED) ===============
# ============================================================
@app.post("/align/iep-selected", response_model=IEPAlignResponse)
async def align_iep_selected(payload: IEPAlignRequest, user=Depends(verify_jwt)):
    """
    Run IEP alignment for an explicit subset and persist:
      - alignment_pct into each student's JSON
      - a pie-chart-friendly breakdown into /data/students/reports.json
      - a minimal PDF report into /data/reports (indexed for /reports UI)
    """
    # 1) Validate + resolve student names (parallel to IDs)
    student_ids = [s for s in (payload.student_ids or []) if isinstance(s, str) and s.strip()]
    if not student_ids:
        raise HTTPException(status_code=400, detail="No students selected")

    student_names: List[str] = []
    for sid in student_ids:
        nm = _student_name_from_id(sid)
        if nm:
            student_names.append(nm)
        else:
            logger.warning(f"Student ID not found or missing name: {sid}")
    if not student_names:
        raise HTTPException(status_code=400, detail="Selected students not found")

    # 2) Course/unit selection that actually exists
    requested_courses = [c for c in (payload.courses or []) if isinstance(c, str) and c.strip()]
    requested_units   = {u for u in (payload.units or []) if isinstance(u, str) and u.strip()}
    if not requested_courses or not requested_units:
        raise HTTPException(status_code=400, detail="Select at least one course and one unit")

    selection: Dict[str, List[str]] = {}
    for course in requested_courses:
        course_dir = CUR_DIR / course
        if not course_dir.exists() or not course_dir.is_dir():
            logger.info(f"Course not found: {course}")
            continue
        existing_units = [u.name for u in course_dir.iterdir() if u.is_dir()]
        units_for_course = [u for u in existing_units if u in requested_units]
        if units_for_course:
            selection[course] = units_for_course
    if not selection:
        raise HTTPException(status_code=400, detail="No matching units found under selected courses")

    # 3) Run pipeline
    try:
        result = run_iep_alignment_selected(
            student_names=student_names,
            base_students_dir=str(STU_DIR),
            selection=selection,
            base_curriculum_dir=str(CUR_DIR),
        )
    except Exception as e:
        logger.exception("Alignment pipeline failed")
        raise HTTPException(status_code=500, detail=f"Pipeline error: {e}")

    if not result or not isinstance(result, dict):
        raise HTTPException(status_code=500, detail="No result from pipeline")

    # 4) Compute per-student overall and metric breakdowns from result.details
    matrix_obj = result.get("matrix", {}) or {}
    matrix_students: List[str] = list(matrix_obj.get("students", []) or [])
    column_averages: List[float] = list(result.get("column_averages", []) or [])
    details: Dict[str, Dict[str, Dict]] = result.get("details", {}) or {}

    def _avg_int(values: List[float]) -> int:
        if not values:
            return 0
        return int(round(sum(values) / len(values)))

    per_student_stats: Dict[str, Dict] = {}
    for s_name in matrix_students:
        overall_from_cols = None
        try:
            s_idx = matrix_students.index(s_name)
            if 0 <= s_idx < len(column_averages):
                overall_from_cols = column_averages[s_idx]
        except Exception:
            overall_from_cols = None

        u_vals, a11n_vals, acc_vals, eng_vals, overall_vals = [], [], [], [], []
        for ws, per_ws in details.items():
            row = per_ws.get(s_name)
            if not isinstance(row, dict):
                continue
            if "understanding_fit" in row: u_vals.append(row["understanding_fit"])
            if "accessibility_fit" in row: a11n_vals.append(row["accessibility_fit"])
            if "accommodation_fit" in row: acc_vals.append(row["accommodation_fit"])
            if "engagement_fit"   in row: eng_vals.append(row["engagement_fit"])
            if "overall_alignment" in row: overall_vals.append(row["overall_alignment"])

        metrics = {
            "understanding": _avg_int(u_vals),
            "accessibility": _avg_int(a11n_vals),
            "accommodation": _avg_int(acc_vals),
            "engagement":    _avg_int(eng_vals),
        }
        overall = int(round(float(overall_from_cols))) if overall_from_cols is not None else _avg_int(overall_vals)

        per_student_stats[s_name] = {"overall": overall, "metrics": metrics}

    # 5) Persist: (a) alignment_pct into student JSONs, (b) reports store for pie charts
    name_to_sid = {name: sid for name, sid in zip(student_names, student_ids)}
    reports_store = _load_student_reports()
    reports_students = reports_store.setdefault("students", {})

    for s_name, stats in per_student_stats.items():
        sid = name_to_sid.get(s_name)
        if not sid:
            continue

        # (a) student file
        p = _student_file_for_id(sid)
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    s_json = json.load(f)
            except Exception as e:
                logger.warning(f"Could not read student {sid} to update alignment: {e}")
                s_json = {}
            s_json["alignment_pct"] = int(stats["overall"])
            s_json["last_alignment"] = {
                "updated_at": _now_iso(),
                "overall": int(stats["overall"]),
                "metrics": stats["metrics"],
                "selection": {"courses": requested_courses, "units": list(requested_units)},
            }
            tmp = p.with_suffix(".json.tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(s_json, f, ensure_ascii=False, indent=2)
            os.replace(tmp, p)

        # (b) pie-chart store
        reports_students[sid] = {
            "updated_at": _now_iso(),
            "overall": int(stats["overall"]),
            "metrics": {
                "understanding": int(stats["metrics"]["understanding"]),
                "accessibility": int(stats["metrics"]["accessibility"]),
                "accommodation": int(stats["metrics"]["accommodation"]),
                "engagement":    int(stats["metrics"]["engagement"]),
            },
            "selection": {"courses": requested_courses, "units": list(requested_units)},
        }

    _save_student_reports(reports_store)

    logger.info(
        f"Alignment persisted for {len(per_student_stats)} students; "
        f"courses={requested_courses}; units={list(requested_units)}"
    )

    # 6) Emit a minimal PDF into /data/reports and index it
    try:
        title = f"IEP Alignment — {len(per_student_stats)} students • {', '.join(sorted(requested_courses))}"
        # Use the 'snapshot' category so it groups under your first bucket in UI
        _create_pdf_report(
            title=f"IEP Alignment — {len(per_student_stats)} students • {', '.join(sorted(requested_courses))}",
            category=REPORT_CATEGORIES[0],
            tags=["auto", "iep-selected"],
            payload=result,
        )

    except Exception as e:
        logger.warning(f"Failed to create IEP-selected PDF: {e}")

    # 7) Return original pipeline result
    return result




# ============================================================
# ================== CURRICULUM REPORTS ROUTES ===============
# ============================================================

@app.get("/curriculum/reports")
async def get_curriculum_reports(user=Depends(verify_jwt)):
    """
    Returns latest per-course rollups used by course-level pie charts.
    """
    return _load_course_reports()

@app.get("/curriculum/{course}/report")
async def get_course_report(course: str, user=Depends(verify_jwt)):
    store = _load_course_reports()
    rec = store.get("courses", {}).get(course)
    if not rec:
        raise HTTPException(status_code=404, detail="No report snapshot for this course")
    return rec


# ============================================================
# =================== ALIGNMENT (COURSE-SELECTED) ============
# ============================================================

class CourseAlignRequest(BaseModel):
    course: str
    units: Optional[List[str]] = None          # if None or empty => all units under course
    student_ids: Optional[List[str]] = None    # optional restriction; default is ALL students

@app.post("/align/course-selected", response_model=IEPAlignResponse)
async def align_course_selected(payload: CourseAlignRequest, user=Depends(verify_jwt)):
    """
    Evaluate a course's selected units against a student set (default: ALL students).
    Persists a course-level rollup in /data/curriculum/reports.json:
      overall (int), 4 pie metrics, counts, and the unit selection used.
    Returns the full pipeline result (same shape as /align/iep-selected).
    """
    course = (payload.course or "").strip()
    if not course:
        raise HTTPException(status_code=400, detail="Missing course")

    # Units to include
    course_dir = CUR_DIR / course
    if not course_dir.exists() or not course_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"Course not found: {course}")

    if payload.units:
        requested_units = {u for u in payload.units if isinstance(u, str) and u.strip()}
    else:
        # all units under course
        requested_units = {u.name for u in course_dir.iterdir() if u.is_dir()}
    if not requested_units:
        raise HTTPException(status_code=400, detail="No units selected for this course")

    selection = {course: sorted(list(requested_units))}

    # Student set: explicit IDs -> names, else ALL students
    if payload.student_ids:
        student_ids = [s for s in payload.student_ids if isinstance(s, str) and s.strip()]
        student_names: List[str] = []
        for sid in student_ids:
            nm = _student_name_from_id(sid)
            if nm:
                student_names.append(nm)
        if not student_names:
            raise HTTPException(status_code=400, detail="Selected students not found")
    else:
        student_names = _all_student_names()
        if not student_names:
            raise HTTPException(status_code=400, detail="No students found")

    # Run the same selection-based pipeline
    try:
        result = run_iep_alignment_selected(
            student_names=student_names,
            base_students_dir=str(STU_DIR),
            selection=selection,
            base_curriculum_dir=str(CUR_DIR),
        )
    except Exception as e:
        logger.exception("Course alignment pipeline failed")
        raise HTTPException(status_code=500, detail=f"Pipeline error: {e}")

    if not result or not isinstance(result, dict):
        raise HTTPException(status_code=500, detail="No result from pipeline")

    # Aggregate course-level rollup from details (avg across all students & worksheets)
    details: Dict[str, Dict[str, Dict]] = result.get("details", {}) or {}
    mat = (result.get("matrix", {}) or {}).get("matrix", []) or []
    worksheets_count = len(mat)
    students_count = len(student_names)

    def _avg_int(vals: List[float]) -> int:
        if not vals:
            return 0
        return int(round(sum(vals) / len(vals)))

    u_vals: List[int] = []
    a11n_vals: List[int] = []
    acc_vals: List[int] = []
    eng_vals: List[int] = []
    overall_vals: List[int] = []

    for ws, per_ws in details.items():
        for s_name, d in per_ws.items():
            if not isinstance(d, dict):
                continue
            if "understanding_fit" in d: u_vals.append(int(d["understanding_fit"]))
            if "accessibility_fit" in d: a11n_vals.append(int(d["accessibility_fit"]))
            if "accommodation_fit" in d: acc_vals.append(int(d["accommodation_fit"]))
            if "engagement_fit"   in d: eng_vals.append(int(d["engagement_fit"]))
            if "overall_alignment" in d: overall_vals.append(int(d["overall_alignment"]))

    metrics = {
        "understanding": _avg_int(u_vals),
        "accessibility": _avg_int(a11n_vals),
        "accommodation": _avg_int(acc_vals),
        "engagement":    _avg_int(eng_vals),
    }
    # Course overall: simple average of all overall_alignment cells (fallback to row/column means if empty)
    if overall_vals:
        overall = _avg_int(overall_vals)
    else:
        row_avgs = result.get("row_averages", []) or []
        overall = _avg_int(row_avgs)


       # Persist to course store (existing)
    store = _load_course_reports()
    courses = store.setdefault("courses", {})
    courses[course] = {
        "updated_at": _now_iso(),
        "selection": {"units": sorted(list(requested_units))},
        "overall": int(overall),
        "metrics": {
            "understanding": int(metrics["understanding"]),
            "accessibility": int(metrics["accessibility"]),
            "accommodation": int(metrics["accommodation"]),
            "engagement":    int(metrics["engagement"]),
        },
        "students_count": int(students_count),
        "worksheets_count": int(worksheets_count),
    }
    _save_course_reports(store)

    # Build per-worksheet overall mean across students (filename -> int mean)
    worksheet_overall: Dict[str, int] = {}
    details: Dict[str, Dict[str, Dict]] = result.get("details", {}) or {}

    def _avg_int(vals: List[float]) -> int:
        if not vals:
            return 0
        return int(round(sum(vals) / len(vals)))

    # Also create a small per-worksheet "history" summary for the Analyze side panel
    hist = _load_align_history()
    for ws_fname, per_ws in details.items():
        norm = _normalize_fname(ws_fname)
        vals_overall, u_vals, a11n_vals, acc_vals, eng_vals = [], [], [], [], []
        affected = []
        for s_name, d in per_ws.items():
            if not isinstance(d, dict):
                continue
            o = int(d.get("overall_alignment", 0))
            u = int(d.get("understanding_fit", 0))
            a = int(d.get("accessibility_fit", 0))
            ac = int(d.get("accommodation_fit", 0))
            e = int(d.get("engagement_fit", 0))
            vals_overall.append(o)
            u_vals.append(u); a11n_vals.append(a); acc_vals.append(ac); eng_vals.append(e)
            if o < 70:  # threshold for "affected"
                affected.append(s_name)
        worksheet_overall[norm] = _avg_int(vals_overall)

        # crude but real consensus based on weakest metric signals
        metrics_sorted = sorted(
            [("Understanding", _avg_int(u_vals)),
             ("Accessibility", _avg_int(a11n_vals)),
             ("Accommodation", _avg_int(acc_vals)),
             ("Engagement", _avg_int(eng_vals))],
            key=lambda kv: kv[1]
        )
        consensus = []
        for label, score in metrics_sorted[:2]:
            if label == "Accessibility":
                consensus.append("Provide captions/large-print & guided notes.")
            elif label == "Accommodation":
                consensus.append("Offer scribe/reader and 1.5× time with chunking.")
            elif label == "Understanding":
                consensus.append("Add step-by-step worked examples before tasks.")
            elif label == "Engagement":
                consensus.append("Include choice of modality and shorter tasks.")
        if not consensus:
            consensus = ["Keep as-is; provide optional visual supports."]

        evidence = (f"Overall {worksheet_overall[norm]}%. "
                    f"U { _avg_int(u_vals)}%, Acc { _avg_int(a11n_vals)}%, "
                    f"Accom { _avg_int(acc_vals)}%, Eng { _avg_int(eng_vals)}%.")

        key = f"{course}|{sorted(list(requested_units))[0] if len(requested_units)==1 else 'Multiple'}|{norm}"
        # If units>1, we'll store under 'Multiple' (analyze pane asks specific unit; single-unit runs are exact)
        hist[key] = {"affected": affected, "consensus": consensus, "evidence": evidence}

    _save_align_history(hist)

    # Persist back into per-unit sidecar AND ROOT index.json so /curriculum reflects new fit
    _apply_course_fit_overrides(course, selection[course], worksheet_overall)

    logger.info(
        f"Course alignment persisted: course={course}, units={sorted(list(requested_units))}, "
        f"students={students_count}, worksheets={worksheets_count}, overall={overall}"
    )

    try:
        title = f"Activity Fit Rollup — {course} • {len(requested_units)} unit(s) • {students_count} student(s)"
        _create_pdf_report(title=title, category=REPORT_CATEGORIES[1], tags=["auto", "course-selected", course], payload=result)
    except Exception as e:
        logger.warning(f"Failed to create course-selected PDF: {e}")

    return result



# ============================================================
# ========================== MAIN ============================
# ============================================================

def main():
    _startup()
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)

if __name__ == "__main__":
    main()
