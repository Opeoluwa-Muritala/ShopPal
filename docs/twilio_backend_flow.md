# Twilio backend flow

## Flow

Twilio POSTs an inbound WhatsApp form to `POST /webhook/whatsapp`. The handler
normalizes the sender, verifies `X-Twilio-Signature` against the full request URL
and form fields, applies the per-phone rate limit, and validates any
`MediaUrl0` against the Twilio allowlist before loading the active vendor and
conversation. Text goes to `LLMService.ask`; an audio URL is downloaded and
transcribed with Groq Whisper before the same LLM path, while an image is
matched against the vendor catalog. The exchange is persisted, then the
handler returns TwiML containing the reply; Twilio delivers that XML response
back to the customer as a WhatsApp message.

## Sample messages

Greeting

Inbound: Hello

Outbound: Heyy! Welcome to Naija Marketplace. How can I help you shop today?

Product selection

Inbound: Show me perfumes

Outbound: I found these perfumes: 1. Oud - NGN 25,000. Reply with the number and quantity you want.

Checkout

Inbound: Checkout. Deliver to 12 Marina Road, Lagos

Outbound: Your order is ready. Total: NGN 25,000. Delivery address: 12 Marina Road, Lagos. I'll share the payment link next.

## Outbound payload

This backend does not call `twilio_client.messages.create`. It replies to the
Twilio webhook with TwiML, and Twilio performs the outbound WhatsApp send. The
function below is the actual response builder in `backend/app/routers/webhook.py`:

```python
def _twiml(message: str) -> Response:
    content = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f"<Response><Message>{escape(message)}</Message></Response>"
    )
    return Response(content=content, media_type="application/xml", status_code=200)
```
