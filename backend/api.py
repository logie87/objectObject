# import argparse
import hashlib

# import hmac
import logging
import os

# import secrets
import sqlite3
import time

# from typing import Optional

import jwt
import uvicorn

from logger import SimpleAppLogger

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr


# ============================================================
# ======================= CONFIG =============================
# ============================================================
LOG_PATH = "logs"

DB_PATH = "instuctive.db"
JWT_SECRET = os.environ.get(
    "JWT_SECRET",
    "48XDWJdPQUg34NkVdK2BwvrscDYyzuhKqZmSxYNk4xAgvL2T5rxrfwWFzKqnhsT6Y5jELHJe7KJQvmHSW6rSPNu7TQnwewYu33J9",
)
JWT_ALG = "HS256"

app = FastAPI()

# ============================================================
# ========================= LOGGING ==========================
# ============================================================

logger = SimpleAppLogger(LOG_PATH, "instructive_api", logging.INFO)

# ============================================================
# ====================== MODELS ==============================
# ============================================================


class LoginRequest(BaseModel):
    email: EmailStr
    password: str  # frontend hashed password


security = HTTPBearer()


# ============================================================
# ==================== DATABASE HELPERS ======================
# ============================================================


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute(
        """
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        pwd TEXT NOT NULL
    );
    """
    )

    conn.commit()
    conn.close()
    logger.info("Database initialized.")


# ============================================================
# ======================= JWT HELPERS ========================
# ============================================================


def create_jwt(user_id, email: str):
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
# ======================= API ROUTES =========================
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://instructive-ui.vercel.app/"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


@app.post("/auth/login")
async def login(req: LoginRequest):
    email = req.email.lower()
    password = req.password

    if len(password) != 64:
        raise HTTPException(status_code=400, detail="Invalid password hash length")

    conn = get_db()
    c = conn.cursor()

    c.execute(
        "SELECT id, email FROM users WHERE email = ? AND pwd = ?;",
        (email, password),
    )
    user = c.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # stored_hash = user["hash"]

    # if not hmac.compare_digest(stored_hash, client_hash):
    #     raise HTTPException(status_code=401, detail="Invalid credentials")

    id, email = user

    token = create_jwt(id, email)
    logger.info(f"User '{email}' logged in successfully.")

    return {"access_token": token, "token_type": "bearer"}


# ---------- Example protected endpoint -----------


@app.get("/secret")
async def secret(user=Depends(verify_jwt)):
    logger.info(f"User accessed /secret: {user['email']}, {user['sub']}, {user['iat']}")
    return {"message": f"Welcome, {user['email']}!"}


# ============================================================
# ========================== MAIN ============================
# ============================================================


def main():
    # parser = argparse.ArgumentParser(description="FastAPI Auth Server")
    # sub = parser.add_subparsers(dest="command")

    # signup_cmd = sub.add_parser("signup")
    # signup_cmd.add_argument("--email", required=True)
    # signup_cmd.add_argument("--hash", required=True)

    # serve_cmd = sub.add_parser("serve")

    # args = parser.parse_args()

    init_db()

    # if args.command == "signup":
    #     cli_signup(args.email, args.hash)

    # elif args.command == "serve":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)

    # else:
    #     parser.print_help()


if __name__ == "__main__":
    main()
