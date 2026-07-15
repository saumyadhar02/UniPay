UniPay Backend — Integration Guide

Overview
--------
This document explains how to integrate payment providers (PSPs) with UniPay backend, how the webhook security and idempotency works, and how to test locally using ngrok.

Environment
-----------
Set these env vars in your `.env` (or CI):

- `MONGO_URI` — your MongoDB connection string (Atlas recommended)
- `JWT_SECRET` — secret for signing JWTs
- `PROVIDER_WEBHOOK_SECRET` — HMAC secret used to verify incoming provider webhooks (optional but recommended)
- `PORT` — server port (defaults to 5000)

Webhook endpoint
----------------
The generic webhook endpoint is:

POST /api/webhooks/generic

- Body: JSON payload (provider-specific or normalized) with at least `amount` and one of `phone`, `walletId`, `topupId`, or a payee VPA (`pa`/`vpa`/`to`).
- Optional headers:
  - `x-provider-signature` (HMAC-SHA256 hex digest) — if `PROVIDER_WEBHOOK_SECRET` is set, the server will verify HMAC with the raw body bytes.

Idempotency
-----------
- If the webhook includes `providerPaymentId` or `topupId`, the server checks existing `Transaction` documents for `metadata.providerPaymentId` or `metadata.topupId` and ignores duplicates.
- This prevents double-crediting if a provider retries the webhook.

Sample unsigned payload (local test)
------------------------------------
curl -X POST http://localhost:5000/api/webhooks/generic \
  -H "Content-Type: application/json" \
  -d '{"provider":"test","providerPaymentId":"pay_123","amount":500,"phone":"9998887776","topupId":"tp_123"}'

Signed webhook (HMAC-SHA256)
---------------------------
If you set `PROVIDER_WEBHOOK_SECRET` to a value (e.g. `s3cr3t`), providers should sign the exact raw request body bytes and set the signature in header `x-provider-signature`.

Example (Node):

```js
const crypto = require('crypto');
const payload = JSON.stringify({ provider:'test', providerPaymentId:'pay_123', amount:500, phone:'9998887776' });
const sig = crypto.createHmac('sha256','s3cr3t').update(payload).digest('hex');
// then POST payload and include header 'x-provider-signature: <sig>'
```

Notes on public webhooks
-----------------------
- To receive webhooks from a PSP during development, expose your local server using a tunnel (e.g., `ngrok http 5000`).
- Use the public ngrok URL as the webhook URL in the PSP console.
- Ensure you set `PROVIDER_WEBHOOK_SECRET` in the PSP webhook settings and in your server.

Supporting payee VPAs (external UPI -> UniPay)
---------------------------------------------
If a PSP forwards a payment that was initiated via an external UPI app (for example: payer used a normal UPI app to transfer money to a UniPay VPA), make sure the webhook payload includes either:

- `pa` or `vpa` or `to` — the payee VPA. If it's in the form `walletid@unipay` the server will map the `walletid` to the UniPay user.
- OR `walletId` — the internal wallet identifier (recommended if provider supports notes/metadata).

The server will also try to match a user's saved `vpa` field if the incoming `pa` is a real bank VPA and users have saved their VPAs in their profile.

Next steps
----------
- Add provider-specific handlers for additional mapping (e.g., Razorpay already scaffolded in `controllers/webhooksController.js`).
- Implement reconciliation and payout flows for settled amounts if you plan to move funds out of UniPay wallets.
- Monitor webhook delivery and set up alerts for failures.

Contact
-------
If you need me to set up an ngrok tunnel and run a signed webhook test, say: "Expose webhook via ngrok and test" and I'll proceed.