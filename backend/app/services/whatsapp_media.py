"""Fetch, persist, and transcribe media received through Meta WhatsApp."""

from __future__ import annotations

from urllib.parse import urlparse

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import WhatsAppMedia
from app.db.session import get_engine
from app.logging_conf import logger
from app.services.transcription import TranscriptionError, transcribe_audio

GRAPH_MEDIA_URL = "https://graph.facebook.com/v20.0/{media_id}"
MAX_MEDIA_BYTES = 25 * 1024 * 1024
ALLOWED_MEDIA_HOSTS = {"graph.facebook.com", "lookaside.fbsbx.com", "mmg.whatsapp.net"}


def _is_allowed_media_url(value: str) -> bool:
    parsed = urlparse(value)
    return (
        parsed.scheme == "https"
        and parsed.hostname in ALLOWED_MEDIA_HOSTS
        and not parsed.username
        and not parsed.password
        and not parsed.fragment
    )


def fetch_whatsapp_media(
    media_id: str, settings: Settings | None = None
) -> tuple[bytes, str]:
    """Resolve a temporary Meta media URL and immediately download its bytes."""
    if not media_id or len(media_id) > 255 or not media_id.isprintable():
        raise ValueError("Invalid WhatsApp media id")

    settings = settings or get_settings()
    access_token = settings.whatsapp_access_token.get_secret_value()
    if not access_token:
        raise RuntimeError("WhatsApp access token is not configured")
    headers = {"Authorization": f"Bearer {access_token}"}

    metadata_response = httpx.get(
        GRAPH_MEDIA_URL.format(media_id=media_id),
        headers=headers,
        timeout=15,
    )
    metadata_response.raise_for_status()
    metadata = metadata_response.json()
    if not isinstance(metadata, dict):
        raise ValueError("Meta media metadata is malformed")
    media_url = metadata.get("url")
    mime_type = metadata.get("mime_type")
    if not isinstance(media_url, str) or not _is_allowed_media_url(media_url):
        raise ValueError("Meta returned an unsafe media URL")
    if not isinstance(mime_type, str) or not mime_type or len(mime_type) > 120:
        raise ValueError("Meta returned an invalid media type")

    media_response = httpx.get(
        media_url,
        headers=headers,
        timeout=30,
        follow_redirects=False,
    )
    media_response.raise_for_status()
    content_length = media_response.headers.get("content-length")
    if content_length and content_length.isdigit() and int(content_length) > MAX_MEDIA_BYTES:
        raise ValueError("WhatsApp media exceeds the size limit")
    content = media_response.content
    if len(content) > MAX_MEDIA_BYTES:
        raise ValueError("WhatsApp media exceeds the size limit")
    return content, mime_type.split(";", 1)[0].strip().lower()


def process_whatsapp_media(
    media_id: str,
    message_type: str,
    settings: Settings | None = None,
    payload_mime_type: str | None = None,
) -> None:
    """Background-safe media worker; all failures are logged and swallowed."""
    if message_type not in {"image", "voice"}:
        return
    if payload_mime_type is not None and (
        not payload_mime_type or len(payload_mime_type) > 120
    ):
        return
    settings = settings or get_settings()
    try:
        with Session(get_engine()) as session:
            existing = session.scalar(
                select(WhatsAppMedia).where(WhatsAppMedia.wa_media_id == media_id)
            )
            if existing is not None:
                return

        content, mime_type = fetch_whatsapp_media(media_id, settings)
        with Session(get_engine()) as session:
            media = WhatsAppMedia(
                wa_media_id=media_id,
                mime_type=mime_type,
                content=content,
                message_type=message_type,
            )
            session.add(media)
            session.commit()
            media_id_db = media.id

        if message_type != "voice":
            return
        try:
            transcript = transcribe_audio(content, mime_type, settings)
        except (TranscriptionError, httpx.HTTPError, ValueError, TypeError) as exc:
            logger.warning(
                "WhatsApp voice transcription failed",
                extra={"step": "whatsapp_media_transcription", "status": "failed", "error_type": type(exc).__name__},
            )
            return
        with Session(get_engine()) as session:
            media = session.get(WhatsAppMedia, media_id_db)
            if media is not None:
                media.transcript = transcript
                # Voice bytes are temporary processing data; retain the text only.
                media.content = None
                session.commit()
    except Exception as exc:
        logger.warning(
            "WhatsApp media processing failed",
            extra={"step": "whatsapp_media_processing", "status": "failed", "error_type": type(exc).__name__},
        )
