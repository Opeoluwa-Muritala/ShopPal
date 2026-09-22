from fastapi.testclient import TestClient

from app.main import app


def test_privacy_policy_is_public_and_contains_required_details():
    response = TestClient(app).get("/privacy")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "ShopPal Privacy Policy" in response.text
    assert "Information we collect" in response.text
    assert "request access, correction, or deletion" in response.text
