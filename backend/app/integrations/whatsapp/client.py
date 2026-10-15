"""Small outbound WhatsApp interface and Meta Cloud API implementation."""

from asyncio import to_thread
from collections.abc import Sequence
from typing import Any, Protocol
from urllib.parse import urlsplit

import httpx

from app.logging_conf import logger
from app.services.product_images import (
    MAX_PRODUCT_IMAGE_UPLOAD_BYTES,
    compress_product_image,
)

MAX_MEDIA_BYTES = 10 * 1024 * 1024
ALLOWED_MEDIA_HOSTS = {"graph.facebook.com", "lookaside.fbsbx.com", "mmg.whatsapp.net"}
ListRow = tuple[str, str] | tuple[str, str, str]


class WhatsAppClient(Protocol):
    async def send_text(self, to: str, body: str) -> None: ...
    async def send_image(self, to: str, image_url: str, caption: str = "") -> None: ...
    async def send_buttons(self, to: str, body: str, buttons: list[tuple[str, str]]) -> None: ...
    async def send_list(self, to: str, body: str, rows: Sequence[ListRow]) -> None: ...
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
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError:
            logger.error(
                "Meta WhatsApp send rejected",
                extra={"step": "whatsapp_send", "status_code": response.status_code,
                       "error_body": response.text[:1000]},
            )
            raise

    async def send_text(self, to: str, body: str) -> None:
        await self._send(to, {"type": "text", "text": {"preview_url": False, "body": body[:4096]}})

    async def send_image(self, to: str, image_url: str, caption: str = "") -> None:
        """Send native image media; Meta fetches the public image without our token."""
        url = urlsplit(image_url)
        if url.scheme != "https" or not url.hostname or url.username or url.password or len(image_url) > 2048:
            raise ValueError("Invalid product image URL")
        if url.path.lower().endswith(".webp"):
            if url.hostname not in {"cdn.dummyjson.com", "raw.githubusercontent.com"}:
                raise ValueError("Unsupported product image source")
            # Fetch only trusted public hosts, never forwarding the Meta token.
            content = bytearray()
            async with self._http.stream("GET", image_url, timeout=10, follow_redirects=False) as response:
                response.raise_for_status()
                mime = response.headers.get("content-type", "").split(";", 1)[0]
                async for chunk in response.aiter_bytes():
                    content.extend(chunk)
                    if len(content) > MAX_PRODUCT_IMAGE_UPLOAD_BYTES:
                        raise ValueError("Product image exceeds the size limit")
            jpeg = await to_thread(compress_product_image, bytes(content), mime)
            uploaded = await self._http.post(
                f"{self._base}/{self._phone_id}/media",
                headers={"Authorization": f"Bearer {self._token}"},
                data={"messaging_product": "whatsapp", "type": "image/jpeg"},
                files={"file": ("product.jpg", jpeg, "image/jpeg")}, timeout=20,
            )
            uploaded.raise_for_status()
            media_id = uploaded.json().get("id")
            if not isinstance(media_id, str) or not media_id or len(media_id) > 255 or "/" in media_id:
                raise ValueError("Meta did not return an image media ID")
            await self._send(to, {"type": "image", "image": {"id": media_id, "caption": caption[:1024]}})
            return
        await self._send(to, {"type": "image", "image": {"link": image_url, "caption": caption[:1024]}})

    async def mark_read_and_typing(self, message_id: str) -> None:
        """Acknowledge a real inbound message while preparing its reply."""
        payload = {"messaging_product": "whatsapp", "status": "read", "message_id": message_id}
        try:
            response = await self._http.post(
                f"{self._base}/{self._phone_id}/messages",
                headers={"Authorization": f"Bearer {self._token}"},
                json={**payload, "typing_indicator": {"type": "text"}},
                timeout=10,
            )
            response.raise_for_status()
        except httpx.HTTPError:
            # Preserve the established read receipt even if typing is rejected.
            response = await self._http.post(
                f"{self._base}/{self._phone_id}/messages",
                headers={"Authorization": f"Bearer {self._token}"},
                json=payload, timeout=10,
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

    async def send_list(self, to: str, body: str, rows: Sequence[ListRow]) -> None:
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
                        {"id": row[0][:200], "title": row[1][:24],
                         **({"description": row[2][:72]} if len(row) == 3 else {})} for row in rows
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
