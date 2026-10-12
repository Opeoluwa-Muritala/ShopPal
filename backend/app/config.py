"""Environment configuration; external services are initialized on demand."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from cryptography.fernet import Fernet
from pydantic import AliasChoices, Field, PostgresDsn, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        populate_by_name=True,
        extra="ignore",
    )

    # Database & Cache
    database_url: PostgresDsn | None = Field(default=None, repr=False)
    redis_host: str = "localhost"
    redis_port: int = Field(default=6379, ge=1, le=65535)
    bumpa_base_url: str = "https://api.bumpa.xyz"
    bumpa_timeout_seconds: float = Field(default=10, gt=0, le=120)
    bumpa_sync_interval_minutes: int = Field(default=10, ge=1)
    key_encryption_secret: SecretStr = SecretStr("")

    # Twilio / WhatsApp
    twilio_account_sid: str = ""
    twilio_auth_token: SecretStr = SecretStr("")
    twilio_whatsapp_number: str = ""
    frontend_api_key: SecretStr = SecretStr("")
    # Comma-separated browser origins allowed to call the vendor API.
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Meta WhatsApp Cloud API webhook authentication
    whatsapp_verify_token: SecretStr = SecretStr("")
    whatsapp_app_secret: SecretStr = SecretStr("")
    whatsapp_access_token: SecretStr = Field(
        default=SecretStr(""),
        validation_alias=AliasChoices("WHATSAPP_TOKEN", "WHATSAPP_ACCESS_TOKEN"),
    )
    whatsapp_phone_number_id: str = ""
    whatsapp_api_base: str = "https://graph.facebook.com/v25.0"
    # Public, dialable business number used only for customer-facing wa.me links.
    whatsapp_public_number: str = ""
    whatsapp_reengagement_template_name: str = ""
    whatsapp_reengagement_template_language: str = "en_US"
    whatsapp_template_payment_instructions: str = ""
    whatsapp_template_payment_received: str = ""
    whatsapp_template_owner_transfer_alert: str = ""
    whatsapp_template_transfer_expiry: str = ""
    whatsapp_template_owner_transfer_expiry: str = ""
    whatsapp_template_owner_paid: str = ""
    meta_reply_worker_enabled: bool = False
    meta_reply_worker_concurrency: int = Field(default=4, ge=1, le=16)
    meta_reply_worker_poll_seconds: float = Field(default=1.0, ge=0.5, le=30.0)

    # Customer AI (Google Gemma) and voice transcription (Groq Whisper)
    gemma_api_key: SecretStr = SecretStr("")
    gemma_model: str = "gemma-4-26b-a4b-it"
    gemma_api_url: str = ""
    gemma_timeout_seconds: int = Field(default=20, ge=10, le=120)
    openrouter_api_key: SecretStr = SecretStr("")
    openrouter_model: str = "google/gemma-3-27b-it"
    groq_api_key: SecretStr = SecretStr("")
    groq_transcription_model: str = "whisper-large-v3-turbo"

    # Payment providers
    paystack_secret_key: SecretStr = SecretStr("")
    paystack_public_key: str = ""
    flutterwave_secret_key: SecretStr = SecretStr("")
    flutterwave_public_key: str = ""
    flutterwave_secret_hash: SecretStr = SecretStr("")
    flutterwave_redirect_url: str = ""
    flutterwave_platform_fee_percent: float = Field(default=0.02, ge=0, le=1)

    # Flutterwave v4 dynamic virtual accounts. These replace hosted checkout
    # for new WhatsApp payments; all values are server-side only.
    flw_client_id: SecretStr = SecretStr("")
    flw_client_secret: SecretStr = SecretStr("")
    flw_env: Literal["sandbox", "production"] = "sandbox"
    flw_webhook_secret_hash: SecretStr = SecretStr("")
    flw_encryption_key: SecretStr = SecretStr("")
    order_expiry_minutes: int = Field(default=30, ge=1, le=1440)

    @property
    def whatsapp_token(self) -> str:
        """Support the new WHATSAPP_TOKEN name without breaking old deployments."""
        return self.whatsapp_access_token.get_secret_value()

    def require_key_encryption_secret(self) -> bytes:
        """Validate the credential encryption key at startup."""
        value = self.key_encryption_secret.get_secret_value()
        if not value:
            raise ValueError("KEY_ENCRYPTION_SECRET is required")
        try:
            key = value.encode("ascii")
            Fernet(key)
        except (UnicodeEncodeError, ValueError) as exc:
            raise ValueError("KEY_ENCRYPTION_SECRET must be a Fernet key") from exc
        return key

    # JWT Authentication
    jwt_secret: SecretStr = SecretStr("default_demo_jwt_secret_32_chars_long_!")
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7


@lru_cache
def get_settings() -> Settings:
    return Settings()
