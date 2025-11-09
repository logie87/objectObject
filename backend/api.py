import hashlib
import json
import logging
import os
import sqlite3
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

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
STU_INDEX   = STU_DIR / "index.json"
USERS_DIR   = DATA_DIR / "users"          # avatars: users/<email>.png

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

class Student(BaseModel):
    id: str
    name: str
    grade: Optional[str] = None
    alignment_pct: Optional[int] = None
    unmet_accommodations: List[str] = []
    notes: Optional[str] = None

class MeSettings(BaseModel):
    show_setup_on_login: bool

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
    # Ensure table exists
    c.execute("""
      CREATE TABLE IF NOT EXISTS users(
        id    INTEGER PRIMARY KEY AUTOINCREMENT,
        name  TEXT,
        email TEXT NOT NULL UNIQUE,
        pwd   TEXT NOT NULL,
        is_new INTEGER DEFAULT 1
      );
    """)
    # Migrate columns if missing
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
# =================== FS HELPERS (LIB/STU) ===================
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

def ensure_students_seed():
    STU_DIR.mkdir(parents=True, exist_ok=True)
    if not STU_INDEX.exists():
        seed = {
            "students": {
                "s1": {
                    "id": "s1",
                    "name": "Alex Student",
                    "grade": "5",
                    "alignment_pct": 72,
                    "unmet_accommodations": ["Reading", "Time"],
                    "notes": "Demo student for UI wiring.",
                }
            }
        }
        with open(STU_INDEX, "w", encoding="utf-8") as f:
            json.dump(seed, f, ensure_ascii=False, indent=2)

def _students_load() -> Dict:
    ensure_students_seed()
    with open(STU_INDEX, "r", encoding="utf-8") as f:
        return json.load(f)

def ensure_users_dir():
    USERS_DIR.mkdir(parents=True, exist_ok=True)

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
    """Ensure schema/dirs exist even when running 'uvicorn api:app --reload'."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ensure_users_dir()
    init_user_db()
    ensure_library()
    ensure_students_seed()

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
    password = req.password  # sha256 hex

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
    # Defensive: if a legacy DB lacks the column, auto-migrate once.
    try:
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT id, name, email, is_new, show_setup_on_login FROM users WHERE id = ?;", (user["sub"],))
        row = c.fetchone()
        conn.close()
    except sqlite3.OperationalError as e:
        if "no such column: show_setup_on_login" in str(e):
            init_user_db()
            conn = get_db()
            c = conn.cursor()
            c.execute("SELECT id, name, email, is_new, show_setup_on_login FROM users WHERE id = ?;", (user["sub"],))
            row = c.fetchone()
            conn.close()
        else:
            raise

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
    # look up user avatar under data/users/{email}.png (or .jpg fallback)
    email = user["email"]
    base = (DATA_DIR / "users")
    base.mkdir(parents=True, exist_ok=True)

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
    # no avatar -> 204 No Content
    return Response(status_code=204, headers={
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
# ===================== STUDENT ROUTES =======================
# ============================================================

@app.get("/students", response_model=List[Student])
async def list_students(user=Depends(verify_jwt)):
    data = _students_load()
    return [Student(**s) for s in data.get("students", {}).values()]

@app.get("/students/{sid}", response_model=Student)
async def get_student(sid: str, user=Depends(verify_jwt)):
    data = _students_load()
    s = data.get("students", {}).get(sid)
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    return Student(**s)

# ============================================================
# ========================== MAIN ============================
# ============================================================

def main():
    # When running `python api.py`
    _startup()
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)

if __name__ == "__main__":
    main()
