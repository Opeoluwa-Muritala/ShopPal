from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["Legal"])


@router.get(
    "/privacy",
    response_class=HTMLResponse,
    summary="View the ShopPal privacy policy",
    description="Public privacy notice used by Meta app details and Login dialogs.",
    response_description="The current ShopPal privacy policy as HTML.",
)
def privacy_policy() -> HTMLResponse:
    return HTMLResponse(
        """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ShopPal Privacy Policy</title>
  <style>
    body { font: 16px/1.6 system-ui, sans-serif; margin: 0; color: #17211b; background: #f6faf7; }
    main { max-width: 760px; margin: 0 auto; padding: 48px 24px 72px; background: #fff; }
    h1, h2 { line-height: 1.25; color: #075e54; }
    h2 { margin-top: 2rem; }
  </style>
</head>
<body><main>
  <h1>ShopPal Privacy Policy</h1>
  <p><strong>Effective date:</strong> 22 September 2026</p>
  <p>ShopPal, also known as Naija Marketplace, helps customers communicate with participating
  vendors and place orders through WhatsApp.</p>

  <h2>Information we collect</h2>
  <p>We may process your WhatsApp phone number, profile information supplied by WhatsApp,
  messages, images or voice notes you send, shopping-cart activity, delivery details, and order
  and payment-status information. We do not collect or store your payment-card details.</p>

  <h2>How we use information</h2>
  <p>We use this information to answer product questions, manage carts and orders, connect you
  with the relevant vendor, provide delivery and payment updates, prevent abuse, and maintain
  the security and reliability of the service.</p>

  <h2>Service providers and sharing</h2>
  <p>Information is shared only as needed with the vendor serving your conversation and with
  providers that operate messaging, hosting, database, AI, transcription, and payment services.
  This may include Meta, Twilio, Google, Groq, Render, Neon, and Paystack. We do not sell your
  personal information.</p>

  <h2>Retention and security</h2>
  <p>We retain information only for as long as needed to provide the service, meet legal and
  accounting obligations, resolve disputes, and prevent fraud. We use access controls,
  encryption in transit, secret management, and authenticated webhooks to protect information.</p>

  <h2>Your choices</h2>
  <p>You may stop messaging the service at any time. To request access, correction, or deletion
  of your information, email <a href="mailto:oyinloyematthew6@gmail.com">oyinloyematthew6@gmail.com</a>
  with the WhatsApp number associated with your request. We may verify your identity before
  completing it.</p>

  <h2>Changes and contact</h2>
  <p>We may update this policy as the service changes. The effective date above shows the latest
  revision. Questions may be sent to
  <a href="mailto:oyinloyematthew6@gmail.com">oyinloyematthew6@gmail.com</a>.</p>
</main></body></html>"""
    )
