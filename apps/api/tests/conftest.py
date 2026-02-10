"""
Test configuration - SQLite in-memory database for fast testing
No real database needed!
"""

import sys
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add parent directory to path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from utils.database import Base, get_db
from main import app

# SQLite in-memory database for tests (no PostgreSQL needed!)
TEST_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_database():
    """Create fresh database tables before each test"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    """FastAPI test client with test database"""
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_user_data():
    """Sample user data for tests"""
    return {
        "email": "test@example.com",
        "username": "testuser",
        "password": "Test@123456",
        "full_name": "Test User",
        "phone": "+971501234567",
        "role": "supreme_admin"
    }


@pytest.fixture
def registered_user(client, test_user_data):
    """Register a user and return the response data"""
    response = client.post("/api/v1/auth/register", json=test_user_data)
    return response.json()


@pytest.fixture
def verified_user(client, test_user_data, registered_user):
    """Register and verify a user, return tokens"""
    verify_response = client.post("/api/v1/auth/verify", json={
        "email": test_user_data["email"],
        "verification_code": registered_user["verification_code"]
    })
    return verify_response.json()


@pytest.fixture
def auth_headers(verified_user):
    """Get authorization headers for authenticated requests"""
    return {"Authorization": f"Bearer {verified_user['access_token']}"}
