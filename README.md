# demo-workforce-applications

A Polyguard integration demo: a job-application page where the candidate's
submission is gated on a successful **Polyguard Trust Check**. The form is
built in Jotform; the submission is held until the candidate has verified
their authentic identity, location, and on-device attestation through the
Polyguard SDK.

Use this as a reference for **Talent / Recruiting** integrations — wherever
a business needs to confirm the person on the other end of an application
is real before accepting their data into the pipeline.

## How it works

```
candidate fills Jotform           Polyguard modal opens          webhook lands
        ↓                                ↓                             ↓
clicks Submit with Polyguard  ──→  candidate verifies on   ──→  decrypted payload
                                    their phone                  stored by link_uuid
                                                                       ↓
                                                          page posts a postMessage
                                                          to the iframe with the
                                                          raw JWT → form submits
```

1. The page embeds your Jotform form as an iframe. The form's native
   submit is hidden; the only path to submission is the page-level
   **"Submit with Polyguard"** button.
2. Clicking the button opens the Polyguard SDK modal. The candidate
   completes a Trust Check on their phone (face + document + region +
   on-device attestation — biometric data never leaves their device).
3. The SDK resolves with a verification bundle. The page then polls
   `/api/status/{linkUuid}` until the matching encrypted webhook lands on
   `/api/webhook` and is decrypted server-side.
4. If the webhook says `trust_check.completed`, the page sends the raw
   JWT to the Jotform iframe via `postMessage`. The form's injected
   Custom Code receives the message, stuffs the JWT into a hidden field
   named `polyguard_jwt`, and submits.
5. If verification fails, is cancelled, or the webhook times out, the
   button resets so the candidate can try again. No partial submission
   ever reaches Jotform.

## Prerequisites

- A Polyguard application (get the `appId` and webhook secret from the
  Polyguard dashboard).
- An Upstash Redis (free tier is fine). Required for production deploys
  where `/api/webhook` and `/api/status/…` run in separate serverless
  instances. Skip it for local `next dev` — the store falls back to an
  in-process Map.
- A Jotform account with a job-application form. See **Configure your
  Jotform** below.

## Configure your Jotform

1. Build your job application in Jotform.
2. Add a **Short Text** field, label it `polyguard_jwt`, and in
   *Properties → Advanced* set its **Unique Name** to `polyguard_jwt`.
   Mark it Hidden.
3. Hide the native submit. Either delete it (the form will submit
   programmatically) or hide via *Conditions*.
4. In *Settings → Form Tags / Inject Custom CSS or JavaScript*, paste:

   ```javascript
   window.addEventListener('message', function (e) {
     if (!e.data || e.data.type !== 'polyguard-submit') return;
     var input = document.querySelector('input[name="q_polyguard_jwt"]')
       || document.querySelector('input[name*="polyguard_jwt"]');
     if (input) input.value = e.data.polyguard_jwt;
     var form = document.querySelector('form.jotform-form');
     if (form) form.submit();
   });
   ```

   The exact `name` attribute Jotform generates depends on the field's
   QID — open the form, inspect the hidden input, and use that selector.
5. Copy the form ID from your Jotform URL
   (`https://www.jotform.com/build/<FORM_ID>` → that's your form ID) and
   set it as `NEXT_PUBLIC_JOTFORM_ID` in `.env.local`.

## Local development

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_POLYGUARD_APP_ID, POLYGUARD_WEBHOOK_SECRET,
# NEXT_PUBLIC_JOTFORM_ID
npm install
npm run dev
```

Open <http://localhost:3000>.

To exercise the full flow locally, expose the dev server (e.g.
`ngrok http 3000`) and register the public URL as your Polyguard
application's webhook destination. Verifications completed on a phone will
then fire webhooks back to your laptop.

## Environment variables

| Variable | Where it's used | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_POLYGUARD_APP_ID` | Client. Identifies your app to the SDK. | Yes |
| `NEXT_PUBLIC_POLYGUARD_API_SERVER` | Client. Defaults to `api.polyguard.ai`. | No |
| `NEXT_PUBLIC_JOTFORM_ID` | Client. The Jotform form to embed. | Yes |
| `POLYGUARD_WEBHOOK_SECRET` | Server. 32-byte base64 key for AES-256-GCM. | Yes |
| `UPSTASH_REDIS_REST_URL` | Server. Webhook payload store. | Production |
| `UPSTASH_REDIS_REST_TOKEN` | Server. | Production |

## Deploy

Targeted at Vercel. Push the repo, import in Vercel, set the environment
variables above, and point your Polyguard webhook at
`https://<your-domain>/api/webhook`.

## Project layout

```
app/
  api/webhook/route.ts            Polyguard webhook receiver (AES-256-GCM)
  api/status/[linkUuid]/route.ts  Client poll endpoint
  layout.tsx, page.tsx            Application page
components/
  JobApplicationForm.tsx          Jotform iframe + submit button
  PolyguardSubmitButton.tsx       verify → poll → postMessage → submit
lib/
  polyguard.ts                    SDK config + required proofs
  load-polyguard.ts               dynamic import of @polyguard/sdk
  run-polyguard-verify.ts         imperative wrapper around client.verify()
  webhook-crypto.ts               envelope decrypt + replay window
  webhook-store.ts                Upstash Redis with in-memory fallback
```

The webhook and crypto modules are lifted from the
[demo-neobank-origination](https://github.com/polyguard-ai/demo-neobank-origination)
("beigebank") reference repo so the integration pattern stays consistent
across verticals.

## License

MIT.
