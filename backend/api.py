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
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr

from logger import SimpleAppLogger


# ============================================================
# ======================= CONFIG =============================
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
LOG_DIR = BASE_DIR / "logs"

DB_PATH = DATA_DIR / "instuctive.db"  # sqlite lives under data/
LIB_DIR = DATA_DIR / "library"  # PDFs live here
LIB_INDEX = LIB_DIR / "index.json"  # metadata index
STU_DIR = DATA_DIR / "students"  # students JSON store
STU_INDEX = STU_DIR / "index.json"

JWT_SECRET = os.environ.get(
    "JWT_SECRET",
    "48XDWJdPQUg34NkVdK2BwvrscDYyzuhKqZmSxYNk4xAgvL2T5rxrfwWFzKqnhsT6Y5jELHJe7KJQvmHSW6rSPNu7TQnwewYu33J9",
)
JWT_ALG = "HS256"

app = FastAPI()


# ============================================================
# ========================= LOGGING ==========================
# ============================================================

# IMPORTANT: call .get_logger() to get a real logger instance
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


security = HTTPBearer()


# ============================================================
# ==================== DATABASE HELPERS ======================
# ============================================================


def get_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_user_db():
    conn = get_db()
    c = conn.cursor()
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            pwd   TEXT NOT NULL
        );
        """
    )
    conn.commit()
    conn.close()
    logger.info("User database initialized.")


# ============================================================
# =================== LIBRARY (FS) HELPERS ===================
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
    return (
        "".join(c for c in name if c.isalnum() or c in keep).strip() or "document.pdf"
    )


def _now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


# ============================================================
# ================== STUDENTS (FS) HELPERS ===================
# ============================================================


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
        "http://localhost:5173",  # Vite
        "http://localhost:3000",  # CRA (if used)
        "https://instructive-ui.vercel.app",  # your prod UI
    ],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


# ============================================================
# ======================= AUTH ROUTES ========================
# ============================================================

@app.post("/auth/login")
async def login(req: LoginRequest):
    email = req.email.lower()
    password = req.password  # sha256 hex

    if len(password) != 64:
        raise HTTPException(status_code=400, detail="Invalid password hash length")

    conn = get_db()
    c = conn.cursor()
    c.execute(
        "SELECT id, email FROM users WHERE email = ? AND pwd = ?;",
        (email, password),
    )
    row = c.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_id, user_email = row
    token = create_jwt(user_id, user_email)
    logger.info(f"User '{user_email}' logged in successfully.")
    return {"access_token": token, "token_type": "bearer"}


@app.get("/secret")
async def secret(user=Depends(verify_jwt)):
    logger.info(
        f"User accessed /secret: {user['email']}, {user['sub']}, {user['name']}, {user['iat']}"
    )
    return {"message": f"Welcome, {user['email']}!"}


# ============================================================
# ===================== LIBRARY ROUTES =======================
# ============================================================


@app.get("/library", response_model=List[DocMeta])
async def list_documents(user=Depends(verify_jwt)):
    """List all documents in the library (metadata only)."""
    data = _load_index()
    docs = [DocMeta(**m) for m in data.get("docs", {}).values()]
    docs.sort(key=lambda d: d.uploaded_at, reverse=True)
    return docs


@app.post("/library/upload", response_model=DocMeta)
async def upload_document(
    user=Depends(verify_jwt),
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # comma-separated
):
    """Upload a PDF. Deduplicate by SHA-256. Store file + index.json."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    ensure_library()

    content = await file.read()
    size = len(content)
    sha256 = hashlib.sha256(content).hexdigest()
    doc_id = sha256[:16]

    data = _load_index()
    docs = data.setdefault("docs", {})

    # idempotent: if already present, return existing
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
async def get_document(
    doc_id: str = FPath(..., min_length=6, max_length=64),
    user=Depends(verify_jwt),
):
    data = _load_index()
    meta = data.get("docs", {}).get(doc_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Not found")
    return DocMeta(**meta)


@app.get("/library/{doc_id}/file")
async def download_document(
    doc_id: str = FPath(..., min_length=6, max_length=64),
    user=Depends(verify_jwt),
):
    data = _load_index()
    meta = data.get("docs", {}).get(doc_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Not found")
    path = LIB_DIR / meta["filename"]
    if not path.exists():
        raise HTTPException(status_code=410, detail="File missing on disk")
    return FileResponse(
        str(path), media_type="application/pdf", filename=meta["filename"]
    )


@app.put("/library/{doc_id}", response_model=DocMeta)
async def update_document(
    payload: DocMetaUpdate,
    doc_id: str = FPath(..., min_length=6, max_length=64),
    user=Depends(verify_jwt),
):
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
async def delete_document(
    doc_id: str = FPath(..., min_length=6, max_length=64),
    user=Depends(verify_jwt),
):
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
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    init_user_db()
    ensure_library()
    ensure_students_seed()
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
