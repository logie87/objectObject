# cli.py
import getpass
import logging
import os
import sqlite3
import hashlib
from pathlib import Path

from logger import SimpleAppLogger

# ============================================================
# ======================= CONFIG =============================
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
LOG_DIR = BASE_DIR / "logs"
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "instuctive.db"


# ============================================================
# ================= Command Line Application =================
# ============================================================

class CLApp:
    def __init__(self):
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.logger = SimpleAppLogger(str(LOG_DIR), "instructive_api", logging.INFO).get_logger()
        self.init_db()

    def hash_password(self, password: str) -> str:
        alg = hashlib.sha256()
        alg.update(password.encode("utf-8"))
        return alg.hexdigest()

    def get_db(self):
        conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        conn = self.get_db()
        c = conn.cursor()
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                pwd   TEXT NOT NULL
            );
            """
        )
        conn.commit()
        conn.close()
        self.logger.info(f"Database initialized at {DB_PATH}")

    def signup(self, email: str, password: str):
        password = self.hash_password(password)
        conn = self.get_db()
        c = conn.cursor()
        try:
            c.execute(
                "INSERT INTO users (email, pwd) VALUES (?, ?);",
                (email.lower(), password),
            )
            conn.commit()
            self.logger.info(f"User '{email}' created.")
            return True
        except sqlite3.IntegrityError:
            self.logger.error("Email already exists.")
            return False
        finally:
            conn.close()

    def cli_signup(self):
        """Interactive CLI for creating a user (admin-only)."""
        while True:
            os.system("cls" if os.name == "nt" else "clear")
            print("SIGNUP FORM")
            print("=" * 60)
            print("\n")
            try:
                email = input("Email:\n> ").strip()
                password = getpass.getpass("Password:\n> ")
                if not email or not password:
                    input("Email and password required. Press Enter…")
                    continue

                if self.signup(email, password):
                    print(f"User '{email}' created.")
                    input("Press Enter to continue…")
                    break
                else:
                    input("Failed (likely duplicate). Press Enter…")
            except EOFError:
                print("\nCtrl+D detected. Exiting signup…")
                break

    def main(self):
        while True:
            try:
                os.system("cls" if os.name == "nt" else "clear")
                print("WELCOME")
                print("=" * 60)
                print("1. Signup")
                print("2. Exit")
                choice = input("Enter your choice: ").strip()

                if choice == "1":
                    self.cli_signup()
                elif choice == "2":
                    print("\nExiting…")
                    break
                else:
                    print("Invalid choice. Press Enter…")
                    input()
            except EOFError:
                print("\nCtrl+D detected. Exiting…")
                break


if __name__ == "__main__":
    CLApp().main()
