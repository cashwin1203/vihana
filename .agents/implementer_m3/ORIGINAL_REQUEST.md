## 2026-07-25T00:57:30Z
Implement and verify Meta WhatsApp Cloud API Webhook Integration in `src/app/api/webhooks/whatsapp/route.ts` (and `src/lib/security.ts` if needed).

Requirements & Acceptance Criteria:
1. `GET /api/webhooks/whatsapp`:
   - Query params: `hub.mode`, `hub.verify_token`, `hub.challenge`.
   - If `hub.mode === 'subscribe'` and `hub.verify_token === (process.env.META_WA_VERIFY_TOKEN || 'VOLUNTEER_OS_WA_TOKEN')`, return `hub.challenge` plain text response with status 200.
   - AC: `GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=VOLUNTEER_OS_WA_TOKEN&hub.challenge=test123` returns `test123`.
2. `POST /api/webhooks/whatsapp`:
   - Signature Verification: When `x-hub-signature-256` header is present (or secret `META_APP_SECRET` configured and request is not explicit simulator fallback), compute `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')`. Compare with `x-hub-signature-256` (e.g. `sha256=...`).
   - If signature missing (when secret is configured/required) or invalid, return HTTP 401 Unauthorized `{"error": "Invalid signature"}`.
   - Action processing:
     - Parses action from Meta payload or simulator body (`RSVP_ATTENDING`, `RSVP_ABSENT`, `CHECK_IN`).
     - Finds target volunteer by `whatsappPhone` or `phone` or `volunteerId`.
     - `RSVP_ATTENDING`: Updates/upserts `VolunteerAttendance` record for the upcoming session setting `rsvpStatus = 'ATTENDING'`, returns confirmation reply.
     - `RSVP_ABSENT`: Sets `rsvpStatus = 'ABSENT'`.
     - `CHECK_IN`: Sets `checkInStatus = 'PRESENT'`, credits `hoursLogged = 3.0`, updates `Volunteer.totalHours`.
   - Fallback: Gracefully handles in-app WhatsApp simulator calls.
   - AC: `POST /api/webhooks/whatsapp` with valid HMAC-SHA256 signature and `action: RSVP_ATTENDING` returns confirmation reply and updates attendance record.
   - AC: `POST /api/webhooks/whatsapp` with invalid or missing signature returns HTTP 401.

3. Test & Verify:
   - Create a test script (e.g. `test_whatsapp_webhook.py` or node test) verifying:
     - Verification challenge returns `test123`.
     - Valid HMAC signature `POST` returns 200 with confirmation reply and updates database.
     - Invalid HMAC signature `POST` returns 401.
4. Write handoff report in `C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os\.agents\implementer_m3\handoff.md` and report to parent (`d900bdcd-fc29-418a-9bb4-bbb3b81aa5cf`).
