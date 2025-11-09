#
# NOTE: ONLY RUN AFTER RUNNING `python cli.py`
# NOTE: You don't need to signup any user as default is email: "a@a.a"; pass: "a".
#
import requests

BASE_URL = (
    "http://127.0.0.1:8000"  # Update this if the server runs on a different host/port
)


def test_login_success():
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={
            "email": "a@a.a",
            "password": "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
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
            "email": "a@a.a",
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
    assert data == {"message": "Welcome, a@a.a!"}


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
    test_login_success()
    test_login_failure()
    test_secret_with_valid_token()
    test_secret_with_invalid_token()
