# Meta WhatsApp Cloud API Setup

## Public URLs

| Purpose | URL |
| --- | --- |
| Callback and verification | `https://shoppal.onrender.com/webhooks/whatsapp` |
| Privacy policy | `https://shoppal.onrender.com/privacy` |
| Swagger UI | `https://shoppal.onrender.com/docs` |

The Meta callback is separate from Twilio's `/webhook/whatsapp` route.

## Render environment

```env
WHATSAPP_VERIFY_TOKEN=<random value also entered in Meta>
WHATSAPP_APP_SECRET=<Meta App Settings > Basic > App secret>
WHATSAPP_ACCESS_TOKEN=<permanent system-user access token>
WHATSAPP_PHONE_NUMBER_ID=<WhatsApp > API Setup > Phone number ID>
```

Do not commit these values. The verification token handles the GET handshake,
the app secret verifies POST signatures, and the access token and phone number ID
authorize outbound replies.

## Meta dashboard

1. Open **WhatsApp > Configuration** in Meta for Developers.
2. Enter the callback URL and verification token above.
3. Subscribe to the `messages` webhook field.
4. In development mode, add and verify each test recipient under **API Setup**.
5. Configure a permanent System User token before production use.

The vendor row's `bot_number` must equal the incoming payload's
`metadata.display_phone_number` (with or without `+` and spaces). This maps the
Meta number to the correct shop.

## Processing and security

- POST signatures are HMAC-SHA256 over the raw request body.
- Payloads larger than 3 MB are rejected.
- Valid callbacks return `200` before database and AI processing.
- The unique message ID prevents Meta retries from running the agent twice.
- Text messages use the same bounded Gemma customer tools as Twilio.
- Delivery statuses update the stored message record.
- Phone numbers are masked in application logs.

After deployment, check `/api/health`, complete Meta's callback verification, and
send a text from a verified recipient. Replies also require Gemma credentials and
a matching vendor `bot_number`.
