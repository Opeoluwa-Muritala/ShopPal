"""Groq Whisper transcription for customer WhatsApp voice notes."""

import httpx

from app.config import Settings


class TranscriptionError(RuntimeError):
    """Raised when a voice note cannot be transcribed safely."""


def transcribe_audio(
    audio: bytes,
    content_type: str,
    settings: Settings,
) -> str:
    api_key = settings.groq_api_key.get_secret_value()
    if not api_key:
        raise TranscriptionError("Voice transcription is unavailable")
    if not audio:
        raise TranscriptionError("Voice note is empty")

    try:
        response = httpx.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            files={"file": ("voice-note", audio, content_type)},
            data={"model": settings.groq_transcription_model},
            timeout=30,
        )
        response.raise_for_status()
        transcript = str(response.json().get("text", "")).strip()
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        raise TranscriptionError("Voice transcription failed") from exc

    if not transcript:
        raise TranscriptionError("Voice transcription returned no text")
    return transcript
