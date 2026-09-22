from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.services.frontend_auth import require_frontend_api_key


def _settings():
    return Settings(_env_file=None, FRONTEND_API_KEY="frontend-test-secret")


def test_frontend_api_key_is_checked_before_route_validation():
    app.dependency_overrides.pop(require_frontend_api_key, None)
    app.dependency_overrides[get_settings] = _settings
    client = TestClient(app, raise_server_exceptions=False)
    try:
        missing = client.post("/api/auth/login", json={})
        invalid = client.post(
            "/api/auth/login", json={}, headers={"X-API-Key": "wrong"}
        )
        accepted = client.post(
            "/api/auth/login",
            json={},
            headers={"X-API-Key": "frontend-test-secret"},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert missing.status_code == 401
    assert invalid.status_code == 401
    assert accepted.status_code == 422


def test_health_does_not_require_frontend_api_key():
    app.dependency_overrides.pop(require_frontend_api_key, None)
    app.dependency_overrides[get_settings] = _settings
    client = TestClient(app, raise_server_exceptions=False)
    try:
        response = client.get("/api/health")
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
