# api.py
import hashlib
import json
import logging
import os
import sqlite3
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

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
    "Class Alignment Snapshot — Today’s Fire Map",
    "Activity Fit Rollup — Worksheets Hurting the Group",
    "Accommodation Compliance Summary — Check against core competencies and other requirements",
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

class ReportUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None

security = HTTPBearer()

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
def _student_file_for_id(sid: str) -> Path:
    # id is filename without extension, guard against path traversal
    safe = "".join(ch for ch in sid if ch.isalnum() or ch in "-_")
    return STU_DIR / f"{safe}.json"

def _scan_students() -> List[Tuple[str, Dict]]:
    """
    Scan /data/students for individual student JSONs.
    Ignores aggregator/aux files like index.json and hidden/underscore files.
    """
    ensure_students_dir()
    out: List[Tuple[str, Dict]] = []
    for p in sorted(STU_DIR.glob("*.json")):
        stem = p.stem.lower()
        # Skip known non-student files
        if stem in {"index"} or p.name.startswith("_") or p.name.startswith("."):
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
        existing[rid] = {
            "id": rid,
            "filename": p.name,
            "title": title,
            "size": stat.st_size,
            "sha256": sha,
            "generated_at": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds") + "Z",
            "category": category,
            "tags": tags,
        }
    # remove stale
    stale = [rid for rid, m in existing.items() if not (REPORTS_DIR / m["filename"]).exists()]
    for rid in stale:
        existing.pop(rid, None)
    idx["reports"] = existing
    _save_reports_index(idx)
    return idx

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

# ============================================================
# ======================= MIDDLEWARE =========================
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://instructive-ui.vercel.app",
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
# =================== CURRICULUM: API BLOCK ==================
# ============================================================

from pydantic import BaseModel, Field

CUR_DIR = DATA_DIR / "curriculum"

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
    CUR_DIR.mkdir(parents=True, exist_ok=True)
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

            # Gather PDFs, ignore index.json and order.json
            files = [p for p in unit_dir.iterdir()
                     if p.is_file()
                     and p.suffix.lower() == ".pdf"
                     and p.name not in ("index.json", "order.json")]

            # Load optional sidecar unit index for issues/fit overrides: unit_dir/index.json
            unit_index = {}
            idx_path = unit_dir / "index.json"
            if idx_path.exists():
                try:
                    with open(idx_path, "r", encoding="utf-8") as f:
                        unit_index = json.load(f)
                except Exception:
                    unit_index = {}

            # Default naive fit (demo)
            def default_fit(n: str) -> dict:
                # Bias worse if filename hints "quiz"/"exit", better for "lab"/"hands"
                lower = n.lower()
                mean = 88
                if "quiz" in lower or "exit" in lower:
                    mean = 62
                elif "lab" in lower or "station" in lower or "hands" in lower:
                    mean = 90
                spread = 20 if mean >= 80 else 28
                status = "good" if mean >= 85 else ("warn" if mean >= 70 else "bad")
                return {"mean": mean, "spread": spread, "status": status}

            # Compute resource items
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

            # Respect order.json if present
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
    """
    Returns the curriculum tree: course -> unit -> [resources]
    Ignores 'index.json'/'order.json'. Uses 'order.json' for ordering if present.
    """
    return _scan_curriculum()

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
    """
    Demo analysis endpoint. If a sidecar '<resource>.meta.json' exists, use it.
    Otherwise, return a simple canned result based on filename heuristics.
    """
    unit_dir = CUR_DIR / course / unit
    pdf_path = unit_dir / resource
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Resource not found")

    sidecar = unit_dir / f"{resource}.meta.json"
    if sidecar.exists():
        try:
            with open(sidecar, "r", encoding="utf-8") as f:
                meta = json.load(f)
            return AnalysisOut(
                affected=meta.get("affected", []),
                consensus=meta.get("consensus", []),
                evidence=meta.get("evidence", ""),
            )
        except Exception:
            pass

    # Heuristic demo
    low = resource.lower()
    if "exit" in low or "quiz" in low:
        return AnalysisOut(
            affected=["S1", "S3", "S8"],
            consensus=[
                "Reduce item count; allow oral check-in.",
                "Time extension 1.5×; chunk into two parts.",
            ],
            evidence="Assessment format vs accommodations; prior time-on-task data.",
        )
    elif "video" in low or "reading" in low:
        return AnalysisOut(
            affected=["S4", "S6", "S10", "S12"],
            consensus=[
                "Provide guided notes with visuals.",
                "Enable captions and a highlighted transcript.",
            ],
            evidence="Lexical density analysis; modality mismatch flagged in IEPs.",
        )
    else:
        return AnalysisOut(
            affected=["S2", "S7"],
            consensus=["Keep as-is; offer optional visual supports."],
            evidence="High engagement; low spread.",
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
# ========================== MAIN ============================
# ============================================================

def main():
    _startup()
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)

if __name__ == "__main__":
    main()
