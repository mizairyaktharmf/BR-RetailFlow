"""
Test basic API health and root endpoints
Run: cd apps/api && python -m pytest tests/test_health.py -v
"""


def test_root_endpoint(client):
    """Test root endpoint returns API info"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "BR-RetailFlow API"
    assert data["version"] == "1.0.0"
    assert data["status"] == "running"


def test_health_check(client):
    """Test health endpoint returns healthy"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_docs_available(client):
    """Test Swagger docs are accessible"""
    response = client.get("/docs")
    assert response.status_code == 200


def test_invalid_endpoint(client):
    """Test 404 for non-existent endpoint"""
    response = client.get("/api/v1/nonexistent")
    assert response.status_code == 404
