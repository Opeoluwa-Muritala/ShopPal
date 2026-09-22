import pytest
from pydantic import ValidationError

from app.config import Settings, get_settings


def test_settings_load_stage1_environment(monkeypatch):
    values = {
        "DATABASE_URL": "postgresql://shop:test-password@localhost/shop",
        "REDIS_HOST": "redis",
        "REDIS_PORT": "6380",
        "TWILIO_ACCOUNT_SID": "ACtest",
        "TWILIO_AUTH_TOKEN": "test-token",
        "TWILIO_WHATSAPP_NUMBER": "whatsapp:+14155238886",
        "GEMMA_API_KEY": "test-gemma-key",
        "GROQ_API_KEY": "test-groq-key",
        "WHATSAPP_ACCESS_TOKEN": "test-meta-token",
        "WHATSAPP_PHONE_NUMBER_ID": "123456789",
    }
    for key, value in values.items():
        monkeypatch.setenv(key, value)

    settings = Settings(_env_file=None)
    assert str(settings.database_url) == values["DATABASE_URL"]
    assert settings.redis_host == "redis"
    assert settings.redis_port == 6380
    assert settings.twilio_account_sid == "ACtest"
    assert settings.twilio_auth_token.get_secret_value() == "test-token"
    assert settings.twilio_whatsapp_number == values["TWILIO_WHATSAPP_NUMBER"]
    assert settings.gemma_api_key.get_secret_value() == "test-gemma-key"
    assert settings.groq_api_key.get_secret_value() == "test-groq-key"
    assert settings.whatsapp_access_token.get_secret_value() == "test-meta-token"
    assert settings.whatsapp_phone_number_id == "123456789"
    for secret in ("test-password", "test-token", "test-gemma-key", "test-groq-key"):
        assert secret not in repr(settings)


def test_settings_read_dotenv_and_environment_takes_precedence(tmp_path, monkeypatch):
    dotenv = tmp_path / ".env"
    dotenv.write_text("REDIS_HOST=from-file\nREDIS_PORT=6381\n", encoding="utf-8")
    monkeypatch.delenv("REDIS_PORT", raising=False)
    monkeypatch.setenv("REDIS_HOST", "from-environment")
    settings = Settings(_env_file=dotenv)
    assert settings.redis_host == "from-environment"
    assert settings.redis_port == 6381


@pytest.mark.parametrize("port", ["0", "65536", "not-a-port"])
def test_settings_reject_invalid_redis_port(port, monkeypatch):
    monkeypatch.setenv("REDIS_PORT", port)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_settings_reject_non_postgresql_database(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite:///shop.db")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_settings_dependency_is_cached():
    get_settings.cache_clear()
    try:
        assert get_settings() is get_settings()
    finally:
        get_settings.cache_clear()
