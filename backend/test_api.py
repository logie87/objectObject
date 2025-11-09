from pathlib import Path
import requests
import sqlite3

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "instuctive.db"

BASE_URL = (
    "http://127.0.0.1:8000"  # Update this if the server runs on a different host/port
)


def get_db():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
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


def insert_test_user():
    init_db()
    name = "User 1"
    email = "testuser@example.com"
    password = "d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2"
    conn = get_db()
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


def test_login_success():
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={
            "email": "testuser@example.com",
            "password": "d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2",
        },
    )
    assert response.status_code == 200
    data = response.json()
    print(f"Login success response: {data}")
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    return data["access_token"]


def test_login_failure():
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={
            "email": "testuser@example.com",
            "password": "wrongpassword",
        },
    )
    data = response.json()
    print(f"Login failure response: {data}")
    assert response.status_code == 401
    assert data == {"detail": "Invalid credentials"}


def test_secret_with_valid_token():
    token = test_login_success()  # Get a valid token from the login test
    response = requests.get(
        f"{BASE_URL}/secret",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    print(f"Secret endpoint response with valid token: {data}")
    assert data == {"message": "Welcome, testuser@example.com!"}


def test_secret_with_invalid_token():
    response = requests.get(
        f"{BASE_URL}/secret",
        headers={"Authorization": "Bearer invalidtoken"},
    )
    data = response.json()
    print(f"Secret endpoint response with invalid token: {data}")
    assert response.status_code == 401
    assert data == {"detail": "Invalid token"}


if __name__ == "__main__":
    insert_test_user()
    test_login_success()
    test_login_failure()
    test_secret_with_valid_token()
    test_secret_with_invalid_token()
