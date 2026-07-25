## 2026-07-25T01:20:09Z
You are Implementer M3 Fix. Your working directory is `C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os\.agents\implementer_m3_fix`.
Project root: `C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os`

DO NOT CHEAT. All implementations must be genuine.

Task:
Apply security hardening fixes based on Reviewer M3 feedback:
1. In `src/lib/security.ts`:
   - In `verifyWhatsAppSignature`, remove any string equality `===` check before `crypto.timingSafeEqual`. Ensure signature comparison strictly uses `crypto.timingSafeEqual(computedBuffer, headerBuffer)`.
2. In `src/app/api/webhooks/whatsapp/route.ts`:
   - Enforce `verifyWhatsAppSignature` when `x-hub-signature-256` is present or `META_APP_SECRET` is set.
   - For unknown phone numbers, remove the `prisma.volunteer.findFirst()` fallback! When `volunteer` is null, respond with message: `"Sorry, your WhatsApp number (+91 ...) is not registered in Volunteer OS. Please contact your Chapter Leader."`
3. Run `cmd /c npx tsx test_whatsapp_webhook.ts` and `cmd /c npm run build` to verify everything builds and passes cleanly.
4. Write `handoff.md` in your working directory and notify parent (`d900bdcd-fc29-418a-9bb4-bbb3b81aa5cf`).
