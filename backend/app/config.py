"""Environment configuration; external services are initialized on demand."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

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
    whatsapp_access_token: SecretStr = SecretStr("")
    whatsapp_phone_number_id: str = ""
    whatsapp_reengagement_template_name: str = ""
    whatsapp_reengagement_template_language: str = "en_US"
    meta_reply_worker_enabled: bool = False
    meta_reply_worker_concurrency: int = Field(default=4, ge=1, le=16)
    meta_reply_worker_poll_seconds: float = Field(default=1.0, ge=0.5, le=30.0)

    # Customer AI (Google Gemma) and voice transcription (Groq Whisper)
    gemma_api_key: SecretStr = SecretStr("")
    gemma_model: str = "gemma-3-27b-it"
    gemma_api_url: str = ""
    gemma_timeout_seconds: int = Field(default=90, ge=10, le=120)
    gemma_thinking_level: Literal["minimal", "high"] = "minimal"
    openrouter_api_key: SecretStr = SecretStr("")
    openrouter_model: str = "google/gemma-3-27b-it"
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
