"""Environment configuration; external services are initialized on demand."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, PostgresDsn, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
    )

    # Database & Cache
    database_url: PostgresDsn | None = Field(default=None, repr=False)
    redis_host: str = "localhost"
    redis_port: int = Field(default=6379, ge=1, le=65535)

    # Twilio / WhatsApp
    twilio_account_sid: str = ""
    twilio_auth_token: SecretStr = SecretStr("")
    twilio_whatsapp_number: str = ""
    frontend_api_key: SecretStr = SecretStr("")

    # Meta WhatsApp Cloud API webhook authentication
    whatsapp_verify_token: SecretStr = SecretStr("")
    whatsapp_app_secret: SecretStr = SecretStr("")

    # Customer AI (Google Gemma) and voice transcription (Groq Whisper)
    gemma_api_key: SecretStr = SecretStr("")
    gemma_model: str = "gemma-3-27b-it"
    gemma_api_url: str = ""
    groq_api_key: SecretStr = SecretStr("")
    groq_transcription_model: str = "whisper-large-v3-turbo"

    # Paystack Payments
    paystack_secret_key: SecretStr = SecretStr("")
    paystack_public_key: str = ""

    # JWT Authentication
    jwt_secret: SecretStr = SecretStr("default_demo_jwt_secret_32_chars_long_!")
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7


@lru_cache
def get_settings() -> Settings:
    return Settings()
