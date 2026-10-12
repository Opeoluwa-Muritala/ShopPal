"""Small outbound WhatsApp interface and Meta Cloud API implementation."""

from typing import Any, Protocol
from urllib.parse import urlsplit

import httpx

MAX_MEDIA_BYTES = 10 * 1024 * 1024
ALLOWED_MEDIA_HOSTS = {"graph.facebook.com", "lookaside.fbsbx.com", "mmg.whatsapp.net"}


class WhatsAppClient(Protocol):
    async def send_text(self, to: str, body: str) -> None: ...
    async def send_buttons(self, to: str, body: str, buttons: list[tuple[str, str]]) -> None: ...
    async def send_list(self, to: str, body: str, rows: list[tuple[str, str]]) -> None: ...
    async def send_template(self, to: str, name: str, language: str, parameters: list[str]) -> None: ...
    async def get_media(self, media_id: str) -> bytes: ...


class MetaWhatsAppClient:
    def __init__(self, api_base: str, phone_number_id: str, access_token: str, http_client: httpx.AsyncClient) -> None:
        if not phone_number_id.isdigit() or not access_token:
            raise ValueError("WhatsApp sender is not configured")
        self._base = api_base.rstrip("/")
        self._phone_id = phone_number_id
        self._token = access_token
        self._http = http_client

    async def _send(self, to: str, payload: dict[str, Any]) -> None:
        response = await self._http.post(
            f"{self._base}/{self._phone_id}/messages",
            headers={"Authorization": f"Bearer {self._token}"},
            json={"messaging_product": "whatsapp", "to": to, **payload},
            timeout=20,
        )
        response.raise_for_status()

    async def send_text(self, to: str, body: str) -> None:
        await self._send(to, {"type": "text", "text": {"preview_url": False, "body": body[:4096]}})

    async def mark_read_and_typing(self, message_id: str) -> None:
        """Acknowledge a real inbound message while preparing its reply."""
        response = await self._http.post(
            f"{self._base}/{self._phone_id}/messages",
            headers={"Authorization": f"Bearer {self._token}"},
            json={"messaging_product": "whatsapp", "status": "read", "message_id": message_id,
                  "typing_indicator": {"type": "text"}},
            timeout=10,
        )
        response.raise_for_status()

    async def send_buttons(self, to: str, body: str, buttons: list[tuple[str, str]]) -> None:
        if not 1 <= len(buttons) <= 3:
            raise ValueError("WhatsApp supports one to three buttons")
        await self._send(to, {
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": body[:1024]},
                "action": {"buttons": [
                    {"type": "reply", "reply": {"id": identifier[:256], "title": title[:20]}}
                    for identifier, title in buttons
                ]},
            },
        })

    async def send_list(self, to: str, body: str, rows: list[tuple[str, str]]) -> None:
        if not 1 <= len(rows) <= 10:
            raise ValueError("WhatsApp lists support one to ten rows")
        await self._send(to, {
            "type": "interactive",
            "interactive": {
                "type": "list",
                "body": {"text": body[:1024]},
                "action": {
                    "button": "Choose a product",
                    "sections": [{"title": "Products", "rows": [
                        {"id": identifier[:200], "title": title[:24]} for identifier, title in rows
                    ]}],
                },
            },
        })

    async def send_template(self, to: str, name: str, language: str, parameters: list[str]) -> None:
        template: dict[str, Any] = {"name": name, "language": {"code": language}}
        if parameters:
            template["components"] = [{
                "type": "body",
                "parameters": [{"type": "text", "text": value} for value in parameters],
            }]
        await self._send(to, {"type": "template", "template": template})

    async def get_media(self, media_id: str) -> bytes:
        if not media_id or len(media_id) > 255 or "/" in media_id:
            raise ValueError("Invalid WhatsApp media ID")
        headers = {"Authorization": f"Bearer {self._token}"}
        metadata = await self._http.get(f"{self._base}/{media_id}", headers=headers, timeout=20)
        metadata.raise_for_status()
        url = metadata.json().get("url")
        parsed = urlsplit(url) if isinstance(url, str) else None
        if parsed is None or parsed.scheme != "https" or parsed.hostname not in ALLOWED_MEDIA_HOSTS:
            raise ValueError("Unexpected WhatsApp media URL")
        response = await self._http.get(url, headers=headers, timeout=20, follow_redirects=False)
        response.raise_for_status()
        if len(response.content) > MAX_MEDIA_BYTES:
            raise ValueError("WhatsApp media exceeds the size limit")
        return response.content
