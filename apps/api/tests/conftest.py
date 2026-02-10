"""
Test configuration - SQLite in-memory database for fast testing
No real database needed!
"""

import sys
import os

# MUST set env variable BEFORE importing anything from the app
# This makes the app use SQLite instead of PostgreSQL
os.environ["DATABASE_URL"] = "sqlite://"

# Add parent directory to path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from utils.database import Base, get_db
from main import app

# In-memory SQLite with StaticPool so all connections share the same DB
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# SQLite doesn't support Enum natively - this helps with PostgreSQL Enum columns
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=OFF")
    cursor.close()


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_database():
    """Create fresh database tables before each test, drop after"""
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
