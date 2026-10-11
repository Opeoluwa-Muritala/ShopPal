"""Encrypt merchant credentials before storing them in PostgreSQL."""

from cryptography.fernet import Fernet

from app.config import Settings


def encrypt_credential(value: str, settings: Settings) -> str:
    if not value:
        raise ValueError("Credential is required")
    return Fernet(settings.require_key_encryption_secret()).encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_credential(value: str, settings: Settings) -> str:
    return Fernet(settings.require_key_encryption_secret()).decrypt(value.encode("ascii")).decode("utf-8")
