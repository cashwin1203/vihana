import { GET as getVolunteers, POST as postVolunteer, PATCH as patchVolunteer } from './src/app/api/volunteers/route';
import { PATCH as patchAttendance } from './src/app/api/attendance/route';
import { GET as getSessions, PATCH as patchSession } from './src/app/api/sessions/route';
import { POST as sendWhatsApp } from './src/app/api/whatsapp/send/route';
import { PATCH as patchCenter } from './src/app/api/centers/route';
import { GET as getStudents, POST as postStudent } from './src/app/api/students/route';
import { GET as getAuditLogs } from './src/app/api/audit-log/route';
import { prisma } from './src/lib/prisma';

async function runMilestone4Verification() {
  console.log('================================================================');
  console.log('=== MILESTONE 4 AUTOMATED INTEGRITY & FUNCTIONALITY VERIFIER ===');
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
    const org = await prisma.organization.create({ data: { name: 'U&I India' } });
    const city = await prisma.city.create({ data: { name: 'Bangalore', organizationId: org.id } });
    center = await prisma.center.create({
      data: {
        name: 'Vihana Center',
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

  console.log('--- 1. VOLUNTEER DEACTIVATION (R5) ---');
  try {
    // Create dummy attendance record to ensure historical records are preserved
    const pastSession = await prisma.session.create({
      data: {
        centerId: center.id,
        sessionDate: new Date(Date.now() - 86400000 * 7),
        startTime: '14:30',
        endTime: '17:30',
        status: 'COMPLETED',
      },
    });

    const pastAttendance = await prisma.volunteerAttendance.create({
      data: {
        sessionId: pastSession.id,
        volunteerId: vol.id,
        rsvpStatus: 'ATTENDING',
        checkInStatus: 'PRESENT',
        hoursLogged: 3.0,
      },
    });

    // Deactivate volunteer via PATCH /api/volunteers
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

    // Verify DB state
    const dbVol = await prisma.volunteer.findUnique({ where: { id: vol.id } });
    assert(dbVol?.status === 'INACTIVE', 'Volunteer record status in database updated to INACTIVE');

    // Verify historical attendance preservation
    const historicalCount = await prisma.volunteerAttendance.count({ where: { volunteerId: vol.id } });
    assert(
      historicalCount >= 2,
      'Historical attendance records (VolunteerAttendance) preserved after deactivation',
      `Count: ${historicalCount}`
    );

    // Reactivate volunteer for remaining tests
    await prisma.volunteer.update({ where: { id: vol.id }, data: { status: 'ACTIVE' } });
  } catch (e: any) {
    assert(false, 'Volunteer Deactivation (R5)', e.message);
  }

  console.log('\n--- 2. MANUAL CHECK-IN OVERRIDE (R5) ---');
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
    assert(false, 'Manual Check-In Override (R5)', e.message);
  }

  console.log('\n--- 3. EMERGENCY SESSION CANCELLATION & WHATSAPP BROADCAST (R7) ---');
  try {
    // Test emergency cancel broadcast via POST /api/whatsapp/send
    const waReq = new Request('http://localhost:3000/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        centerId: center.id,
        type: 'EMERGENCY_CANCEL',
        reason: 'Heavy Monsoons & Flooding',
      }),
    });

    const waRes = await sendWhatsApp(waReq);
    const waJson = await waRes.json();

    assert(
      waRes.status === 200 &&
      waJson.status === 'SUCCESS' &&
      waJson.type === 'EMERGENCY_CANCEL' &&
      typeof waJson.sampleMessage === 'string',
      'Emergency Session Cancellation WhatsApp broadcast API succeeds with alert message',
      `status: ${waRes.status}, json: ${JSON.stringify(waJson)}`
    );

    // Verify session status updated to CANCELLED in DB
    const cancelledSession = await prisma.session.findFirst({
      where: { centerId: center.id, status: 'CANCELLED' },
      orderBy: { updatedAt: 'desc' },
    });

    assert(
      cancelledSession?.status === 'CANCELLED',
      'Session status updated to CANCELLED in database',
      `status: ${cancelledSession?.status}`
    );

    // Also test session cancellation via PATCH /api/sessions
    const newUpcoming = await prisma.session.create({
      data: {
        centerId: center.id,
        sessionDate: new Date(),
        startTime: '14:30',
        endTime: '17:30',
        status: 'UPCOMING',
      },
    });

    const patchSessReq = new Request('http://localhost:3000/api/sessions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: newUpcoming.id,
        status: 'CANCELLED',
        challengesFaced: 'Facility power outage',
      }),
    });

    const patchSessRes = await patchSession(patchSessReq);
    const patchSessJson = await patchSessRes.json();

    assert(
      patchSessRes.status === 200 && patchSessJson.status === 'CANCELLED',
      'PATCH /api/sessions updates status to CANCELLED',
      `status: ${patchSessRes.status}`
    );
  } catch (e: any) {
    assert(false, 'Emergency Session Cancellation (R7)', e.message);
  }

  console.log('\n--- 4. PII PHONE MASKING (R8 / SECURITY) ---');
  try {
    const getVolReq = new Request('http://localhost:3000/api/volunteers', { method: 'GET' });
    const getVolRes = await getVolunteers(getVolReq);
    const volsList = await getVolRes.json();

    assert(
      getVolRes.status === 200 && Array.isArray(volsList) && volsList.length > 0,
      'GET /api/volunteers returns HTTP 200 array of volunteers'
    );

    let allMasked = true;
    for (const v of volsList) {
      if (v.phone && !v.phone.includes('*')) {
        allMasked = false;
        console.error(`Unmasked phone exposed: ${v.name} -> ${v.phone}`);
      }
      if (v.whatsappPhone && !v.whatsappPhone.includes('*')) {
        allMasked = false;
        console.error(`Unmasked whatsappPhone exposed: ${v.name} -> ${v.whatsappPhone}`);
      }
    }

    assert(
      allMasked,
      'GET /api/volunteers response JSON masks raw phone numbers (e.g. +91 ***** 43210)',
      `Sample phone output: ${volsList[0]?.phone}`
    );
  } catch (e: any) {
    assert(false, 'PII Phone Masking (R8)', e.message);
  }

  console.log('\n--- 5. IMMUTABLE AUDITLOG ENTRIES (R8) ---');
  try {
    // 5a. Onboard volunteer
    const newVolEmail = `audit_test_${Date.now()}@uandi.org`;
    const onboardReq = new Request('http://localhost:3000/api/volunteers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Audit Test Vol',
        email: newVolEmail,
        phone: '+91 91234 56789',
        skills: 'English',
        centerId: center.id,
      }),
    });
    await postVolunteer(onboardReq);

    // 5b. CSV export
    const exportReq = new Request('http://localhost:3000/api/volunteers?export=csv', { method: 'GET' });
    const exportRes = await getVolunteers(exportReq);
    assert(exportRes.status === 200, 'GET /api/volunteers?export=csv returns 200 CSV payload');

    // 5c. Holiday pause toggle
    const pauseReq = new Request('http://localhost:3000/api/centers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: center.id,
        isPausedForHoliday: true,
      }),
    });
    await patchCenter(pauseReq);

    // Check AuditLog table for entries of all 4 administrative actions
    const auditLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const actionsFound = new Set(auditLogs.map((l) => l.action));

    assert(
      actionsFound.has('ONBOARD_VOLUNTEER') || actionsFound.has('BULK_CSV_IMPORT'),
      'AuditLog contains entry for Volunteer creation / onboarding'
    );
    assert(
      actionsFound.has('EMERGENCY_SESSION_CANCEL') || actionsFound.has('CANCEL_SESSION'),
      'AuditLog contains entry for Session cancellation'
    );
    assert(
      actionsFound.has('CSV_EXPORT'),
      'AuditLog contains entry for CSV export'
    );
    assert(
      actionsFound.has('TOGGLE_HOLIDAY_PAUSE'),
      'AuditLog contains entry for Holiday pause toggle'
    );
  } catch (e: any) {
    assert(false, 'Immutable AuditLog Entries (R8)', e.message);
  }

  console.log('\n--- 6. ANONYMIZED STUDENT LOCUS CODES (R8) ---');
  try {
    // Post new student
    const studentReq = new Request('http://localhost:3000/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        centerId: center.id,
        grade: 'Grade 7',
      }),
    });

    const studentRes = await postStudent(studentReq);
    const studentJson = await studentRes.json();

    assert(
      studentRes.status === 201 && typeof studentJson.studentCode === 'string',
      'POST /api/students creates student record with studentCode',
      `studentCode: ${studentJson.studentCode}`
    );

    // Fetch students list
    const getStudReq = new Request('http://localhost:3000/api/students', { method: 'GET' });
    const getStudRes = await getStudents(getStudReq);
    const studList = await getStudRes.json();

    assert(
      getStudRes.status === 200 && Array.isArray(studList) && studList.length > 0,
      'GET /api/students returns student list'
    );

    let allAnonymized = true;
    for (const s of studList) {
      if (!s.studentCode || !s.studentCode.startsWith('Student ')) {
        allAnonymized = false;
        console.error(`Invalid student code found: ${JSON.stringify(s)}`);
      }
    }

    assert(
      allAnonymized,
      'All student records use anonymized locus codes (e.g. Student VHN-01) with no minor PII',
      `Sample student code: ${studList[0]?.studentCode}`
    );
  } catch (e: any) {
    assert(false, 'Anonymized Student Locus Codes (R8)', e.message);
  }

  console.log('\n================================================================');
  console.log(`=== VERIFICATION COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED out of ${totalTests} TESTS ===`);
  console.log('================================================================\n');

  await prisma.$disconnect();

  if (failedTests > 0) {
    process.exit(1);
  }
}

runMilestone4Verification().catch(async (err) => {
  console.error('Fatal Verification Error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
