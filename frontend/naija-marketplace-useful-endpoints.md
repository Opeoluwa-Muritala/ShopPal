# Naija Marketplace API --- Useful Endpoints

**API version:** 0.6.0\
**Specification:** OpenAPI 3.1

This is a concise extraction of the endpoints visible in the API
documentation screenshot. Repeated webhook entries are listed once.

## Authentication

  Method   Endpoint                      Purpose
  -------- ----------------------------- -------------------------
  `POST`   `/api/auth/login`             Log in
  `POST`   `/api/auth/refresh`           Refresh access tokens
  `POST`   `/api/auth/logout`            Log out
  `POST`   `/api/auth/logout-all`        Log out all sessions
  `POST`   `/api/auth/forgot-password`   Start password recovery
  `POST`   `/api/auth/reset-password`    Reset password

## Accounts & Vendor Onboarding

  ------------------------------------------------------------------------------
  Method                  Endpoint                       Purpose
  ----------------------- ------------------------------ -----------------------
  `POST`                  `/api/accounts/invite-staff`   Invite staff

  `POST`                  `/api/vendors/signup`          Vendor signup and
                                                         initial catalog import
  ------------------------------------------------------------------------------

## Products

  Method   Endpoint                     Purpose
  -------- ---------------------------- ------------------------------
  `GET`    `/api/products`              List vendor products
  `POST`   `/api/products`              Create a product
  `POST`   `/api/products/upload-csv`   Upload a product catalog CSV

## Orders

  Method    Endpoint                   Purpose
  --------- -------------------------- --------------------------
  `GET`     `/api/orders`              List vendor orders
  `PATCH`   `/api/orders/{order_id}`   Update an order's status

## Diagnostics & System

  Method   Endpoint             Purpose
  -------- -------------------- -----------------------------
  `GET`    `/api/logs/recent`   Get recent application logs
  `GET`    `/api/health`        Health check

## Provider Webhooks

  Method   Endpoint               Purpose
  -------- ---------------------- ------------------------------
  `POST`   `/webhook/whatsapp`    Twilio WhatsApp webhook
  `POST`   `/webhook/paystack`    Paystack payment webhook
  `GET`    `/webhooks/whatsapp`   Verify Meta WhatsApp webhook
  `POST`   `/webhooks/whatsapp`   Receive Meta WhatsApp events

## Legal

  Method   Endpoint     Purpose
  -------- ------------ ---------------------------------
  `GET`    `/privacy`   View the ShopPal privacy policy

## Notes

-   Endpoints marked with a lock icon in the screenshot appear to
    require authorization.
-   The screenshot does not show request/response schemas, query
    parameters, or server base URL details; consult the full API docs
    for those.
