import { GET, POST } from './src/app/api/webhooks/whatsapp/route';
import { prisma } from './src/lib/prisma';
import crypto from 'crypto';

async function runTests() {
  console.log('--- Starting WhatsApp Webhook Integration Verification Tests ---\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  const SECRET = process.env.META_APP_SECRET || 'VOLUNTEER_OS_WA_SECRET';

  // 1. GET Webhook Challenge Verification
  try {
    const url = 'http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=VOLUNTEER_OS_WA_TOKEN&hub.challenge=test123';
    const req = new Request(url, { method: 'GET' });
    const res = await GET(req);
    const text = await res.text();

    assert(
      res.status === 200 && text === 'test123',
      'GET /api/webhooks/whatsapp verification challenge returns test123',
      `status: ${res.status}, body: "${text}"`
    );
  } catch (e: any) {
    assert(false, 'GET /api/webhooks/whatsapp verification challenge', e.message);
  }

  // 1b. GET Invalid Token returns 403
  try {
    const url = 'http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=WRONG_TOKEN&hub.challenge=test123';
    const req = new Request(url, { method: 'GET' });
    const res = await GET(req);
    assert(res.status === 403, 'GET /api/webhooks/whatsapp with invalid token returns 403');
  } catch (e: any) {
    assert(false, 'GET /api/webhooks/whatsapp invalid token', e.message);
  }

  // Find a target volunteer for POST tests
  let volunteer: any = await prisma.volunteer.findFirst({ include: { center: true } });
  if (!volunteer) {
    console.log('No volunteer found in DB, creating test volunteer...');
    const center = await prisma.center.create({
      data: {
        name: 'Test Center',
        location: 'Test Location',
        dayOfWeek: 'Saturday',
        slotTime: '2:30 PM - 5:30 PM',
        city: { create: { name: 'Test City', organization: { create: { name: 'Test Org' } } } },
      },
    });
    volunteer = await prisma.volunteer.create({
      data: {
        name: 'Test Volunteer',
        email: 'testvol@example.com',
        phone: '+919999988888',
        whatsappPhone: '+919999988888',
        skills: 'Math, English',
        centerId: center.id,
      },
      include: { center: true },
    });
  }

  // 2. POST with Invalid Signature returns 401
  try {
    const payload = JSON.stringify({ action: 'RSVP_ATTENDING', volunteerId: volunteer.id });
    const req = new Request('http://localhost:3000/api/webhooks/whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=invalid_hash_signature_1234567890abcdef',
      },
      body: payload,
    });
    const res = await POST(req);
    const json = await res.json();

    assert(
      res.status === 401 && json.error === 'Invalid signature',
      'POST /api/webhooks/whatsapp with invalid signature returns HTTP 401',
      `status: ${res.status}, json: ${JSON.stringify(json)}`
    );
  } catch (e: any) {
    assert(false, 'POST /api/webhooks/whatsapp invalid signature', e.message);
  }

  // 3. POST with Missing Signature returns 401 (non-simulator)
  try {
    const payload = JSON.stringify({ action: 'RSVP_ATTENDING', phone: '+919999988888' });
    const req = new Request('http://localhost:3000/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    const res = await POST(req);
    const json = await res.json();

    assert(
      res.status === 401 && json.error === 'Invalid signature',
      'POST /api/webhooks/whatsapp with missing signature returns HTTP 401',
      `status: ${res.status}, json: ${JSON.stringify(json)}`
    );
  } catch (e: any) {
    assert(false, 'POST /api/webhooks/whatsapp missing signature', e.message);
  }

  // 4. POST Valid HMAC Signature + RSVP_ATTENDING action
  try {
    const rawBody = JSON.stringify({ action: 'RSVP_ATTENDING', volunteerId: volunteer.id });
    const sig = 'sha256=' + crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');

    const req = new Request('http://localhost:3000/api/webhooks/whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': sig,
      },
      body: rawBody,
    });
    const res = await POST(req);
    const json = await res.json();

    assert(
      res.status === 200 && json.updatedRsvp === 'ATTENDING' && typeof json.reply === 'string',
      'POST with valid HMAC signature and RSVP_ATTENDING returns HTTP 200 and confirmation reply',
      `status: ${res.status}, json: ${JSON.stringify(json)}`
    );

    // Verify DB update
    const attendance = await prisma.volunteerAttendance.findFirst({
      where: { volunteerId: volunteer.id },
      orderBy: { updatedAt: 'desc' },
    });
    assert(
      attendance?.rsvpStatus === 'ATTENDING',
      'DB Record VolunteerAttendance rsvpStatus updated to ATTENDING',
      `rsvpStatus: ${attendance?.rsvpStatus}`
    );
  } catch (e: any) {
    assert(false, 'POST valid HMAC signature RSVP_ATTENDING', e.message);
  }

  // 5. POST Valid HMAC Signature + RSVP_ABSENT action
  try {
    const rawBody = JSON.stringify({ action: 'RSVP_ABSENT', volunteerId: volunteer.id });
    const sig = 'sha256=' + crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');

    const req = new Request('http://localhost:3000/api/webhooks/whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': sig,
      },
      body: rawBody,
    });
    const res = await POST(req);
    const json = await res.json();

    assert(
      res.status === 200 && json.updatedRsvp === 'ABSENT',
      'POST RSVP_ABSENT sets rsvpStatus to ABSENT',
      `status: ${res.status}, json: ${JSON.stringify(json)}`
    );

    const attendance = await prisma.volunteerAttendance.findFirst({
      where: { volunteerId: volunteer.id },
      orderBy: { updatedAt: 'desc' },
    });
    assert(
      attendance?.rsvpStatus === 'ABSENT',
      'DB Record VolunteerAttendance rsvpStatus updated to ABSENT',
      `rsvpStatus: ${attendance?.rsvpStatus}`
    );
  } catch (e: any) {
    assert(false, 'POST RSVP_ABSENT', e.message);
  }

  // 6. POST Valid HMAC Signature + CHECK_IN action
  try {
    const rawBody = JSON.stringify({ action: 'CHECK_IN', volunteerId: volunteer.id });
    const sig = 'sha256=' + crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');

    const req = new Request('http://localhost:3000/api/webhooks/whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': sig,
      },
      body: rawBody,
    });
    const res = await POST(req);
    const json = await res.json();

    assert(
      res.status === 200 && json.updatedCheckIn === 'PRESENT',
      'POST CHECK_IN sets checkInStatus to PRESENT and credits hours',
      `status: ${res.status}, json: ${JSON.stringify(json)}`
    );

    const attendance = await prisma.volunteerAttendance.findFirst({
      where: { volunteerId: volunteer.id },
      orderBy: { updatedAt: 'desc' },
    });
    assert(
      attendance?.checkInStatus === 'PRESENT' && attendance?.hoursLogged === 3.0,
      'DB Record checkInStatus updated to PRESENT with hoursLogged = 3.0',
      `checkInStatus: ${attendance?.checkInStatus}, hoursLogged: ${attendance?.hoursLogged}`
    );

    const updatedVol = await prisma.volunteer.findUnique({ where: { id: volunteer.id } });
    assert(
      (updatedVol?.totalHours || 0) >= 3.0,
      'Volunteer.totalHours updated in DB',
      `totalHours: ${updatedVol?.totalHours}`
    );
  } catch (e: any) {
    assert(false, 'POST CHECK_IN', e.message);
  }

  // 7. POST In-App WhatsApp Simulator Call Fallback
  try {
    const req = new Request('http://localhost:3000/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        volunteerId: volunteer.id,
        action: 'RSVP_ATTENDING',
        text: 'Testing from simulator',
        isSimulator: true,
      }),
    });
    const res = await POST(req);
    const json = await res.json();

    assert(
      res.status === 200 && json.updatedRsvp === 'ATTENDING',
      'In-App WhatsApp Simulator fallback gracefully handled',
      `status: ${res.status}, json: ${JSON.stringify(json)}`
    );
  } catch (e: any) {
    assert(false, 'In-App WhatsApp Simulator fallback', e.message);
  }

  // 8. Meta Cloud API Payload structure verification
  try {
    const metaPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '100001',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                contacts: [{ profile: { name: volunteer.name }, wa_id: volunteer.phone.replace(/[^\d]/g, '') }],
                messages: [
                  {
                    from: volunteer.phone.replace(/[^\d]/g, ''),
                    id: 'wamid.test123',
                    timestamp: '1670000000',
                    type: 'interactive',
                    interactive: {
                      type: 'button_reply',
                      button_reply: { id: 'RSVP_ATTENDING', title: 'Attending' },
                    },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    const rawBody = JSON.stringify(metaPayload);
    const sig = 'sha256=' + crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');

    const req = new Request('http://localhost:3000/api/webhooks/whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': sig,
      },
      body: rawBody,
    });

    const res = await POST(req);
    const json = await res.json();

    assert(
      res.status === 200 && json.updatedRsvp === 'ATTENDING',
      'Meta WhatsApp Cloud API payload format parsed and processed correctly',
      `status: ${res.status}, json: ${JSON.stringify(json)}`
    );
  } catch (e: any) {
    assert(false, 'Meta WhatsApp Cloud API payload format', e.message);
  }

  // 9. Unknown phone number returns unregistered error message
  try {
    const rawBody = JSON.stringify({ action: 'RSVP_ATTENDING', phone: '+910000000000' });
    const sig = 'sha256=' + crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');

    const req = new Request('http://localhost:3000/api/webhooks/whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': sig,
      },
      body: rawBody,
    });

    const res = await POST(req);
    const json = await res.json();

    const expectedMsg = 'Sorry, your WhatsApp number (+910000000000) is not registered in Volunteer OS. Please contact your Chapter Leader.';
    assert(
      res.status === 200 && json.reply === expectedMsg,
      'Unknown phone number responds with unregistered error message',
      `status: ${res.status}, json: ${JSON.stringify(json)}`
    );
  } catch (e: any) {
    assert(false, 'Unknown phone number response check', e.message);
  }

  console.log(`\n--- Verification Summary: ${passed} passed, ${failed} failed ---`);
  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(async (e) => {
  console.error('Fatal test error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
