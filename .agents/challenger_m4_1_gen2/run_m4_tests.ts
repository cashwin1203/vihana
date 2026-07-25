import { GET as getVolunteers, POST as postVolunteer, PATCH as patchVolunteer } from '../../../src/app/api/volunteers/route';
import { PATCH as patchAttendance } from '../../../src/app/api/attendance/route';
import { GET as getSessions, PATCH as patchSession } from '../../../src/app/api/sessions/route';
import { POST as sendWhatsApp } from '../../../src/app/api/whatsapp/send/route';
import { PATCH as patchCenter } from '../../../src/app/api/centers/route';
import { GET as getStudents, POST as postStudent } from '../../../src/app/api/students/route';
import { GET as getAuditLogs } from '../../../src/app/api/audit-log/route';
import { prisma } from '../../../src/lib/prisma';
import { maskPhoneNumber, maskVolunteerPII } from '../../../src/lib/security';

async function runAllM4Tests() {
  console.log('================================================================');
  console.log('=== MILESTONE 4 COMPREHENSIVE EMPIRICAL STRESS TEST SUITE ===');
  console.log('================================================================\n');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testTitle: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test ${totalTests}: ${testTitle}`);
      passedTests++;
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${testTitle} -> ${detail || 'Assertion failed'}`);
      failedTests++;
    }
  }

  // Ensure DB seed exists or seed test records
  let center = await prisma.center.findFirst({ include: { volunteers: true, sessions: true } });
  if (!center) {
    console.log('No center found. Creating test seed center...');
    const org = await prisma.organization.create({ data: { name: 'U&I India Test' } });
    const city = await prisma.city.create({ data: { name: 'Bangalore', organizationId: org.id } });
    center = await prisma.center.create({
      data: {
        name: 'Vihana Center Test',
        location: 'Whitefield',
        dayOfWeek: 'Saturday',
        slotTime: '2:30 PM - 5:30 PM',
        cityId: city.id,
      },
      include: { volunteers: true, sessions: true },
    });
  }

  // Helper volunteer
  let vol = await prisma.volunteer.findFirst({ where: { centerId: center.id } });
  if (!vol) {
    vol = await prisma.volunteer.create({
      data: {
        name: 'M4 Test Volunteer',
        email: `m4test_${Date.now()}@uandi.org`,
        phone: '+91 98765 43210',
        whatsappPhone: '+91 98765 43210',
        skills: 'Math, Science',
        centerId: center.id,
      },
    });
  }

  // Helper session & attendance
  let session = await prisma.session.findFirst({ where: { centerId: center.id, status: 'UPCOMING' } });
  if (!session) {
    session = await prisma.session.create({
      data: {
        centerId: center.id,
        sessionDate: new Date(),
        startTime: '14:30',
        endTime: '17:30',
        status: 'UPCOMING',
      },
    });
  }

  let attendance = await prisma.volunteerAttendance.findFirst({
    where: { sessionId: session.id, volunteerId: vol.id },
  });
  if (!attendance) {
    attendance = await prisma.volunteerAttendance.create({
      data: {
        sessionId: session.id,
        volunteerId: vol.id,
        rsvpStatus: 'ATTENDING',
        checkInStatus: 'PENDING',
        hoursLogged: 0,
      },
    });
  }

  // ==========================================
  // SECTION 1: BASELINE VERIFICATION
  // ==========================================
  console.log('\n--- SECTION 1: BASELINE VERIFICATION (R3, R5, R7, R8) ---');
  
  // 1.1 Deactivation baseline
  try {
    const pastSession = await prisma.session.create({
      data: {
        centerId: center.id,
        sessionDate: new Date(Date.now() - 86400000 * 7),
        startTime: '14:30',
        endTime: '17:30',
        status: 'COMPLETED',
      },
    });

    await prisma.volunteerAttendance.create({
      data: {
        sessionId: pastSession.id,
        volunteerId: vol.id,
        rsvpStatus: 'ATTENDING',
        checkInStatus: 'PRESENT',
        hoursLogged: 3.0,
      },
    });

    const patchReq = new Request('http://localhost:3000/api/volunteers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: vol.id, status: 'INACTIVE' }),
    });

    const patchRes = await patchVolunteer(patchReq);
    const patchJson = await patchRes.json();

    assert(
      patchRes.status === 200 && patchJson.status === 'INACTIVE',
      'PATCH /api/volunteers sets volunteer status to INACTIVE',
      `status: ${patchRes.status}, body: ${JSON.stringify(patchJson)}`
    );

    const dbVol = await prisma.volunteer.findUnique({ where: { id: vol.id } });
    assert(dbVol?.status === 'INACTIVE', 'Volunteer record status in database updated to INACTIVE');

    const historicalCount = await prisma.volunteerAttendance.count({ where: { volunteerId: vol.id } });
    assert(
      historicalCount >= 2,
      'Historical attendance records preserved after deactivation',
      `Count: ${historicalCount}`
    );

    // Reactivate for subsequent tests
    await prisma.volunteer.update({ where: { id: vol.id }, data: { status: 'ACTIVE' } });
  } catch (e: any) {
    assert(false, 'Volunteer Deactivation Baseline', e.message);
  }

  // 1.2 Manual Check-in Override baseline
  try {
    const overrideReq = new Request('http://localhost:3000/api/attendance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'VOLUNTEER',
        id: attendance.id,
        checkInStatus: 'PRESENT',
      }),
    });

    const overrideRes = await patchAttendance(overrideReq);
    const overrideJson = await overrideRes.json();

    assert(
      overrideRes.status === 200 &&
      overrideJson.checkInStatus === 'PRESENT' &&
      overrideJson.hoursLogged === 3.0,
      'Manual check-in override updates checkInStatus to PRESENT and logs 3.0 hours',
      `status: ${overrideRes.status}, checkInStatus: ${overrideJson.checkInStatus}, hoursLogged: ${overrideJson.hoursLogged}`
    );

    const dbAttendance = await prisma.volunteerAttendance.findUnique({ where: { id: attendance.id } });
    assert(
      dbAttendance?.checkInStatus === 'PRESENT' && dbAttendance?.hoursLogged === 3.0,
      'DB record VolunteerAttendance checkInStatus updated to PRESENT with hoursLogged = 3.0'
    );

    const updatedVol = await prisma.volunteer.findUnique({ where: { id: vol.id } });
    assert(
      (updatedVol?.totalHours || 0) >= 3.0,
      'Volunteer.totalHours aggregated and updated in DB',
      `totalHours: ${updatedVol?.totalHours}`
    );
  } catch (e: any) {
    assert(false, 'Manual Check-In Override Baseline', e.message);
  }

  // ==========================================
  // SECTION 2: STRESS TEST - VOLUNTEER DEACTIVATION WITH MULTIPLE ATTENDANCE RECORDS
  // ==========================================
  console.log('\n--- SECTION 2: STRESS TEST - VOLUNTEER DEACTIVATION WITH MULTIPLE ATTENDANCE RECORDS ---');
  try {
    // Create dedicated volunteer for multi-attendance test
    const multiVol = await prisma.volunteer.create({
      data: {
        name: 'Multi-Attendance Volunteer',
        email: `multivol_${Date.now()}@uandi.org`,
        phone: '+919998887770',
        whatsappPhone: '+919998887770',
        skills: 'Math, English',
        centerId: center.id,
        status: 'ACTIVE',
      },
    });

    // Create 5 different sessions with attendance records of varying states
    const states: { rsvp: string; checkIn: string; hours: number }[] = [
      { rsvp: 'ATTENDING', checkIn: 'PRESENT', hours: 3.0 },
      { rsvp: 'ATTENDING', checkIn: 'PRESENT', hours: 2.5 },
      { rsvp: 'ABSENT', checkIn: 'ABSENT', hours: 0 },
      { rsvp: 'BACKUP', checkIn: 'PRESENT', hours: 4.0 },
      { rsvp: 'PENDING', checkIn: 'PENDING', hours: 0 },
    ];

    const attIds: string[] = [];
    for (let i = 0; i < states.length; i++) {
      const sess = await prisma.session.create({
        data: {
          centerId: center.id,
          sessionDate: new Date(Date.now() - 86400000 * (i + 1)),
          startTime: '14:30',
          endTime: '17:30',
          status: 'COMPLETED',
        },
      });

      const att = await prisma.volunteerAttendance.create({
        data: {
          sessionId: sess.id,
          volunteerId: multiVol.id,
          rsvpStatus: states[i].rsvp,
          checkInStatus: states[i].checkIn,
          hoursLogged: states[i].hours,
        },
      });
      attIds.push(att.id);
    }

    // Aggregate expected hours (3.0 + 2.5 + 0 + 4.0 + 0 = 9.5)
    const expectedHours = 9.5;

    // Trigger deactivation
    const deactReq = new Request('http://localhost:3000/api/volunteers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: multiVol.id, status: 'INACTIVE' }),
    });

    const deactRes = await patchVolunteer(deactReq);
    const deactJson = await deactRes.json();

    assert(
      deactRes.status === 200 && deactJson.status === 'INACTIVE',
      'Multi-attendance volunteer status updated to INACTIVE via API'
    );

    // Check count of attendance records in DB
    const postDeactAttCount = await prisma.volunteerAttendance.count({
      where: { volunteerId: multiVol.id },
    });

    assert(
      postDeactAttCount === 5,
      `All 5 historical attendance records retained after deactivation (found ${postDeactAttCount})`
    );

    // Verify individual attendance records remain intact with correct hours and statuses
    const fetchedAtts = await prisma.volunteerAttendance.findMany({
      where: { volunteerId: multiVol.id },
    });
    const preservedHoursSum = fetchedAtts.reduce((acc, curr) => acc + curr.hoursLogged, 0);

    assert(
      preservedHoursSum === expectedHours,
      `Historical logged hours sum matches original (${preservedHoursSum} === ${expectedHours})`
    );

    // Verify GET /api/volunteers?status=INACTIVE returns this volunteer with attendance count
    const getDeactReq = new Request(`http://localhost:3000/api/volunteers?status=INACTIVE`, { method: 'GET' });
    const getDeactRes = await getVolunteers(getDeactReq);
    const deactList = await getDeactRes.json();
    const foundDeact = deactList.find((v: any) => v.id === multiVol.id);

    assert(
      foundDeact !== undefined && foundDeact._count?.attendances === 5,
      'GET /api/volunteers?status=INACTIVE returns deactivated volunteer with correct _count.attendances'
    );
  } catch (e: any) {
    assert(false, 'Stress Test: Deactivation with Multiple Attendance Records', e.message);
  }

  // ==========================================
  // SECTION 3: STRESS TEST - MANUAL OVERRIDE WITH VARIOUS INITIAL STATES
  // ==========================================
  console.log('\n--- SECTION 3: STRESS TEST - MANUAL OVERRIDE WITH VARIOUS INITIAL STATES ---');
  try {
    const testVol2 = await prisma.volunteer.create({
      data: {
        name: 'Override Test Volunteer',
        email: `overridevol_${Date.now()}@uandi.org`,
        phone: '+919876500000',
        skills: 'English',
        centerId: center.id,
      },
    });

    // Case 3a: PENDING -> PRESENT (default 3.0 hours)
    const sessA = await prisma.session.create({
      data: { centerId: center.id, sessionDate: new Date(), startTime: '14:30', endTime: '17:30' },
    });
    const attA = await prisma.volunteerAttendance.create({
      data: { sessionId: sessA.id, volunteerId: testVol2.id, checkInStatus: 'PENDING', hoursLogged: 0 },
    });

    const resA = await patchAttendance(new Request('http://localhost:3000/api/attendance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'VOLUNTEER', id: attA.id, checkInStatus: 'PRESENT' }),
    }));
    const jsonA = await resA.json();
    assert(jsonA.hoursLogged === 3.0, 'Override PENDING -> PRESENT defaults hoursLogged to 3.0');

    // Case 3b: ABSENT -> PRESENT (custom hours override, e.g. 4.5 hours)
    const sessB = await prisma.session.create({
      data: { centerId: center.id, sessionDate: new Date(), startTime: '14:30', endTime: '17:30' },
    });
    const attB = await prisma.volunteerAttendance.create({
      data: { sessionId: sessB.id, volunteerId: testVol2.id, checkInStatus: 'ABSENT', hoursLogged: 0 },
    });

    const resB = await patchAttendance(new Request('http://localhost:3000/api/attendance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'VOLUNTEER', id: attB.id, checkInStatus: 'PRESENT', hoursLogged: 4.5 }),
    }));
    const jsonB = await resB.json();
    assert(jsonB.hoursLogged === 4.5, 'Override ABSENT -> PRESENT with custom hoursLogged = 4.5');

    // Case 3c: PRESENT -> ABSENT (check status update & hours total recalculation)
    const resC = await patchAttendance(new Request('http://localhost:3000/api/attendance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'VOLUNTEER', id: attA.id, checkInStatus: 'ABSENT', hoursLogged: 0 }),
    }));
    const jsonC = await resC.json();
    assert(jsonC.checkInStatus === 'ABSENT', 'Override PRESENT -> ABSENT updates checkInStatus to ABSENT');

    // Check volunteer totalHours aggregation: attA is now ABSENT (0), attB is PRESENT (4.5). Total should be 4.5.
    const checkVol2 = await prisma.volunteer.findUnique({ where: { id: testVol2.id } });
    assert(
      checkVol2?.totalHours === 4.5,
      `Volunteer totalHours aggregate recalculated accurately (${checkVol2?.totalHours} === 4.5)`
    );

    // Case 3d: Student attendance override
    const stud = await prisma.student.create({
      data: { studentCode: 'Student TST-99', grade: 'Grade 8', centerId: center.id },
    });
    const studAtt = await prisma.studentAttendance.create({
      data: { sessionId: sessA.id, studentId: stud.id, status: 'PRESENT' },
    });

    const resStud = await patchAttendance(new Request('http://localhost:3000/api/attendance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'STUDENT', id: studAtt.id, studentStatus: 'NEEDS_HELP', notes: 'Requires math assistance' }),
    }));
    const jsonStud = await resStud.json();

    assert(
      resStud.status === 200 && jsonStud.status === 'NEEDS_HELP' && jsonStud.notes === 'Requires math assistance',
      'Student attendance override updates status to NEEDS_HELP with notes'
    );
  } catch (e: any) {
    assert(false, 'Stress Test: Manual Override with Various Initial States', e.message);
  }

  // ==========================================
  // SECTION 4: STRESS TEST - EMERGENCY CANCELLATION BROADCAST PAYLOADS
  // ==========================================
  console.log('\n--- SECTION 4: STRESS TEST - EMERGENCY CANCELLATION BROADCAST PAYLOADS ---');
  try {
    // 4a. Emergency cancel with null/undefined reason (fallback verification)
    const emReq1 = new Request('http://localhost:3000/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ centerId: center.id, type: 'EMERGENCY_CANCEL' }),
    });
    const emRes1 = await sendWhatsApp(emReq1);
    const emJson1 = await emRes1.json();
    assert(
      emRes1.status === 200 && emJson1.sampleMessage.includes('Weather/Emergency'),
      'Emergency broadcast with empty reason falls back to "Weather/Emergency"'
    );

    // 4b. Emergency cancel with custom Unicode / long reason
    const customReason = 'Severe Cyclonic Storm & Local Curfew In Effect (🚨⚠️)';
    const emReq2 = new Request('http://localhost:3000/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ centerId: center.id, type: 'EMERGENCY_CANCEL', reason: customReason }),
    });
    const emRes2 = await sendWhatsApp(emReq2);
    const emJson2 = await emRes2.json();
    assert(
      emRes2.status === 200 && emJson2.sampleMessage.includes(customReason),
      'Emergency broadcast handles special characters and Unicode in reason'
    );

    // 4c. Non-existent centerId return 404
    const errReq = new Request('http://localhost:3000/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ centerId: 'invalid-center-id-9999', type: 'EMERGENCY_CANCEL' }),
    });
    const errRes = await sendWhatsApp(errReq);
    assert(errRes.status === 404, 'Emergency broadcast to non-existent center returns HTTP 404');
  } catch (e: any) {
    assert(false, 'Stress Test: Emergency Cancellation Broadcast Payloads', e.message);
  }

  // ==========================================
  // SECTION 5: STRESS TEST - PII MASKING ON VARIOUS PHONE FORMATS & ENFORCE IN GET API
  // ==========================================
  console.log('\n--- SECTION 5: STRESS TEST - PII MASKING ON VARIOUS PHONE FORMATS ---');
  try {
    const phoneFormats = [
      { raw: '+919876543210', expected: '+91 ***** 43210' },
      { raw: '9876543210', expected: '+91 ***** 43210' },
      { raw: '+91 98765 43210', expected: '+91 ***** 43210' },
      { raw: '+91-98765-43210', expected: '+91 ***** 43210' },
      { raw: '09876543210', expected: '+91 ***** 43210' },
      { raw: null, expected: null },
      { raw: undefined, expected: null },
    ];

    let maskingCorrect = true;
    for (const item of phoneFormats) {
      const masked = maskPhoneNumber(item.raw);
      if (masked !== item.expected) {
        maskingCorrect = false;
        console.error(`Masking failed for raw: "${item.raw}" -> got "${masked}", expected "${item.expected}"`);
      }
    }

    assert(maskingCorrect, 'maskPhoneNumber correctly formats all standard & non-standard Indian phone inputs');

    // Test maskVolunteerPII helper directly
    const sampleVolPII = {
      id: 'vol-123',
      name: 'Secret Volunteer',
      email: 'secret.volunteer@uandi.org',
      phone: '+919876543210',
      whatsappPhone: '9876543210',
    };

    const maskedVol = maskVolunteerPII(sampleVolPII);
    assert(
      maskedVol.phone === '+91 ***** 43210' &&
      maskedVol.whatsappPhone === '+91 ***** 43210' &&
      maskedVol.email.includes('*') &&
      !maskedVol.email.includes('secret.volunteer'),
      'maskVolunteerPII masks phone, whatsappPhone, and email correctly'
    );

    // Verify GET /api/volunteers response default vs unmask
    const getDefault = await getVolunteers(new Request('http://localhost:3000/api/volunteers'));
    const defaultData = await getDefault.json();
    const firstVol = defaultData[0];
    assert(
      firstVol && firstVol.phone && firstVol.phone.includes('*'),
      'GET /api/volunteers returns masked phone by default'
    );

    const getUnmasked = await getVolunteers(new Request('http://localhost:3000/api/volunteers?unmask=true'));
    const unmaskedData = await getUnmasked.json();
    const firstUnmasked = unmaskedData.find((v: any) => v.id === firstVol.id);
    assert(
      firstUnmasked && !firstUnmasked.phone.includes('*'),
      'GET /api/volunteers?unmask=true returns unmasked phone for admin export'
    );
  } catch (e: any) {
    assert(false, 'Stress Test: PII Masking on Various Phone Formats', e.message);
  }

  // ==========================================
  // SECTION 6: STRESS TEST - AUDITLOG TABLE SCHEMA & PERSISTENCE
  // ==========================================
  console.log('\n--- SECTION 6: STRESS TEST - AUDITLOG TABLE SCHEMA & PERSISTENCE ---');
  try {
    // 6a. Direct DB insertion check
    const testAction = `TEST_AUDIT_${Date.now()}`;
    const testDetails = { foo: 'bar', timestamp: Date.now() };

    const createdLog = await prisma.auditLog.create({
      data: {
        actorName: 'CHALLENGER_BOT',
        action: testAction,
        details: JSON.stringify(testDetails),
      },
    });

    assert(
      typeof createdLog.id === 'string' && createdLog.action === testAction,
      'AuditLog table schema accepts actorName, action, details JSON, and generates UUID id'
    );

    // 6b. Query via GET /api/audit-log API
    const auditApiReq = new Request(`http://localhost:3000/api/audit-log?action=${testAction}`, { method: 'GET' });
    const auditApiRes = await getAuditLogs(auditApiReq);
    const auditApiData = await auditApiRes.json();

    assert(
      auditApiRes.status === 200 &&
      Array.isArray(auditApiData) &&
      auditApiData.length > 0 &&
      auditApiData[0].action === testAction,
      'GET /api/audit-log filters logs by action and returns persisted entries'
    );

    // Validate details JSON parseability
    const parsedDetails = JSON.parse(auditApiData[0].details);
    assert(
      parsedDetails.foo === 'bar',
      'AuditLog details string is valid parseable JSON payload'
    );
  } catch (e: any) {
    assert(false, 'Stress Test: AuditLog Table Schema & Persistence', e.message);
  }

  console.log('\n================================================================');
  console.log(`=== STRESS TEST SUITE COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED out of ${totalTests} TESTS ===`);
  console.log('================================================================\n');

  await prisma.$disconnect();

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllM4Tests().catch(async (err) => {
  console.error('Fatal Stress Test Error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
