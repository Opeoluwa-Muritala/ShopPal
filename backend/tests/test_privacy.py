from fastapi.testclient import TestClient

from app.main import app


def test_privacy_policy_is_public_and_contains_required_details():
    response = TestClient(app).get("/privacy")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "ShopPal Privacy Policy" in response.text
    assert "Information we collect" in response.text
    assert "request access, correction, or deletion" in response.text


def test_meta_and_privacy_routes_are_described_in_openapi():
    schema = TestClient(app).get("/openapi.json").json()

    assert schema["paths"]["/privacy"]["get"]["summary"] == (
        "View the ShopPal privacy policy"
    )
    assert schema["paths"]["/webhooks/whatsapp"]["get"]["summary"] == (
        "Verify the Meta WhatsApp webhook"
    )
    assert schema["paths"]["/webhooks/whatsapp"]["post"]["summary"] == (
        "Receive Meta WhatsApp events"
    )
