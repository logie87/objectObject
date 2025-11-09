import getpass
import os
import sqlite3
import logging
import hashlib

from logger import SimpleAppLogger

# ============================================================
# ======================= CONFIG =============================
# ============================================================

LOG_PATH = "logs"
DB_PATH = "instuctive.db"

# ============================================================
# ================= Command Line Application =================
# ============================================================


class CLApp:
    def __init__(self):
        self.init_db()
        self.logger = SimpleAppLogger(LOG_PATH, "instructive_api", logging.INFO)

    def hash_password(self, password: str) -> str:
        alg = hashlib.sha256()
        alg.update(password.encode("utf-8"))
        return alg.hexdigest()

    def get_db(self):
        conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        conn = self.get_db()
        c = conn.cursor()

        c.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL, 
                email TEXT NOT NULL UNIQUE,
                pwd TEXT NOT NULL
            );
            """
        )

        conn.commit()
        conn.close()
        self.logger.info("Database initialized.")

    def signup(self, name: str, email: str, password: str):
        password = self.hash_password(password)

        conn = self.get_db()
        c = conn.cursor()

        try:
            c.execute(
                "INSERT INTO users (name, email, pwd) VALUES (?, ?, ?);",
                (name, email.lower(), password),
            )
            conn.commit()

            return True
        except sqlite3.IntegrityError:
            return False
        finally:
            conn.close()

    def cli_signup(self, name: str, email: str, password: str):
        """Signup ONLY available through CLI"""

        while True:
            os.system("clear")  # Clear the terminal screen
            print("SIGNUP FORM")
            print("=" * 60)
            print("\n")

            try:
                # Collect user input
                name = input(f"{'Name:':<15}\n> ")  # Align field name to the left

                email = input(f"{'Email:':<15}\n> ")  # Align field name to the left

                password = getpass.getpass(
                    f"{'Password:':<15}\n> "
                )  # Align field name to the left

                # Attempt signup
                if self.signup(name, email, password):
                    self.logger.info(f"User '{email}' created via CLI.")
                    print(f"User '{email}' created via CLI.")
                    input("Press Enter to continue...")
                    break
                else:
                    self.logger.error("Email already exists.")
                    input("Press Enter to continue...")
            except EOFError:
                print("\nCtrl+D detected. Exiting signup...")
                self.app.disconnect_db()
                break

    def main(self):
        """
        Main function to handle the flow of the application.
        """
        while True:
            try:
                os.system("clear")  # Clear the terminal screen
                print("WELCOME TO THE APPLICATION")
                print("=" * 60)
                print("1. Signup")
                print("2. Exit")
                choice = input("Enter your choice: ").strip()

                if choice == "1":
                    self.cli_signup()
                elif choice == "2":
                    print("\nExiting application...")
                    break
                else:
                    print("Invalid choice. Please try again.")
            except EOFError:
                print("\nCtrl+D detected. Exiting application...")
                break
