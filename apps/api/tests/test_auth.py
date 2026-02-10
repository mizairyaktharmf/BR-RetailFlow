"""
Test authentication endpoints: register, verify, login, logout
Run: cd apps/api && python -m pytest tests/test_auth.py -v
"""


# ============ REGISTER ============

def test_register_success(client, test_user_data):
    """Test successful user registration"""
    response = client.post("/api/v1/auth/register", json=test_user_data)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == test_user_data["email"]
    assert "verification_code" in data
    assert len(data["verification_code"]) == 6
    assert data["expires_in_minutes"] == 30


def test_register_duplicate_username(client, test_user_data):
    """Test registration fails with duplicate username"""
    client.post("/api/v1/auth/register", json=test_user_data)
    response = client.post("/api/v1/auth/register", json=test_user_data)
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"]


def test_register_duplicate_email(client, test_user_data):
    """Test registration fails with duplicate email"""
    client.post("/api/v1/auth/register", json=test_user_data)
    test_user_data["username"] = "different_user"
    response = client.post("/api/v1/auth/register", json=test_user_data)
    assert response.status_code == 400


def test_register_invalid_email(client, test_user_data):
    """Test registration fails with invalid email"""
    test_user_data["email"] = "not-an-email"
    response = client.post("/api/v1/auth/register", json=test_user_data)
    assert response.status_code == 422


def test_register_short_password(client, test_user_data):
    """Test registration fails with short password"""
    test_user_data["password"] = "12345"
    response = client.post("/api/v1/auth/register", json=test_user_data)
    assert response.status_code == 422


def test_register_missing_fields(client):
    """Test registration fails with missing required fields"""
    response = client.post("/api/v1/auth/register", json={})
    assert response.status_code == 422


# ============ VERIFY ============

def test_verify_success(client, test_user_data, registered_user):
    """Test successful account verification"""
    response = client.post("/api/v1/auth/verify", json={
        "email": test_user_data["email"],
        "verification_code": registered_user["verification_code"]
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == test_user_data["email"]
    assert data["user"]["is_verified"] == True


def test_verify_wrong_code(client, test_user_data, registered_user):
    """Test verification fails with wrong code"""
    response = client.post("/api/v1/auth/verify", json={
        "email": test_user_data["email"],
        "verification_code": "000000"
    })
    assert response.status_code == 400
    assert "Invalid verification code" in response.json()["detail"]


def test_verify_nonexistent_email(client):
    """Test verification fails with unknown email"""
    response = client.post("/api/v1/auth/verify", json={
        "email": "nobody@example.com",
        "verification_code": "123456"
    })
    assert response.status_code == 404


def test_verify_already_verified(client, test_user_data, registered_user):
    """Test verification fails if already verified"""
    # Verify first time
    client.post("/api/v1/auth/verify", json={
        "email": test_user_data["email"],
        "verification_code": registered_user["verification_code"]
    })
    # Try again
    response = client.post("/api/v1/auth/verify", json={
        "email": test_user_data["email"],
        "verification_code": registered_user["verification_code"]
    })
    assert response.status_code == 400
    assert "already verified" in response.json()["detail"]


# ============ LOGIN ============

def test_login_success(client, test_user_data, verified_user):
    """Test successful login after verification"""
    response = client.post("/api/v1/auth/login", json={
        "username": test_user_data["username"],
        "password": test_user_data["password"]
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["username"] == test_user_data["username"]
    assert data["user"]["role"] == "supreme_admin"


def test_login_with_email(client, test_user_data, verified_user):
    """Test login using email instead of username"""
    response = client.post("/api/v1/auth/login", json={
        "username": test_user_data["email"],
        "password": test_user_data["password"]
    })
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password(client, test_user_data, verified_user):
    """Test login fails with wrong password"""
    response = client.post("/api/v1/auth/login", json={
        "username": test_user_data["username"],
        "password": "wrongpassword"
    })
    assert response.status_code == 401


def test_login_nonexistent_user(client):
    """Test login fails with unknown username"""
    response = client.post("/api/v1/auth/login", json={
        "username": "nobody",
        "password": "password123"
    })
    assert response.status_code == 401


def test_login_unverified_user(client, test_user_data, registered_user):
    """Test login fails if account not verified"""
    response = client.post("/api/v1/auth/login", json={
        "username": test_user_data["username"],
        "password": test_user_data["password"]
    })
    assert response.status_code == 401
    assert "verify" in response.json()["detail"].lower()


# ============ ME / PROTECTED ============

def test_get_current_user(client, auth_headers):
    """Test getting current user info with token"""
    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testuser"
    assert data["is_verified"] == True


def test_get_current_user_no_token(client):
    """Test protected endpoint fails without token"""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_get_current_user_invalid_token(client):
    """Test protected endpoint fails with invalid token"""
    response = client.get("/api/v1/auth/me", headers={
        "Authorization": "Bearer fake-token-123"
    })
    assert response.status_code == 401


# ============ LOGOUT ============

def test_logout_success(client, auth_headers):
    """Test successful logout"""
    response = client.post("/api/v1/auth/logout", headers=auth_headers)
    assert response.status_code == 200
    assert "logged out" in response.json()["message"].lower()


def test_logout_no_token(client):
    """Test logout fails without authentication"""
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 401
