import { GET as getDashboard } from '../../src/app/api/dashboard/route';
import { prisma } from '../../src/lib/prisma';

async function runEmpiricalStressTest() {
  console.log('=== EMPIRICAL STRESS TEST FOR /api/dashboard ===');
  
  // 1. Fetch initial dashboard state
  const res1 = await getDashboard();
  const data1 = await res1.json();

  console.log('Initial metrics:', data1.metrics);
  console.log('Initial center count:', data1.centers.length);
  console.log('Initial atRiskList count:', data1.atRiskList.length);

  // 2. Mutate DB dynamically: Create a brand new Center and Volunteer with 3 consecutive absences
  const stressOrg = await prisma.organization.findFirst();
  const stressCity = await prisma.city.findFirst();
  
  const testCenter = await prisma.center.create({
    data: {
      name: `Dynamic Stress Center ${Date.now()}`,
      location: 'Indiranagar',
      dayOfWeek: 'Sunday',
      slotTime: '10:00 AM - 1:00 PM',
      cityId: stressCity!.id,
      targetVolunteerCount: 15,
      targetStudentCount: 50,
    },
  });

  const testVol = await prisma.volunteer.create({
    data: {
      name: 'Dynamic Stress Volunteer',
      email: `stress_vol_${Date.now()}@uandi.org`,
      phone: '+91 99900 11122',
      skills: 'Science',
      status: 'ACTIVE',
      centerId: testCenter.id,
      joinedDate: new Date(Date.now() - 90 * 86400000), // 3 months ago
    },
  });

  // Create 3 sessions with ABSENT attendance for testVol
  const sessions = [];
  for (let i = 0; i < 3; i++) {
    const s = await prisma.session.create({
      data: {
        centerId: testCenter.id,
        sessionDate: new Date(Date.now() - (3 - i) * 86400000),
        startTime: '10:00',
        endTime: '13:00',
        status: 'COMPLETED',
      },
    });
    sessions.push(s);
    await prisma.volunteerAttendance.create({
      data: {
        sessionId: s.id,
        volunteerId: testVol.id,
        rsvpStatus: 'ABSENT',
        checkInStatus: 'ABSENT',
      },
    });
  }

  // 3. Fetch second dashboard state
  const res2 = await getDashboard();
  const data2 = await res2.json();

  console.log('Updated metrics totalCenters:', data2.metrics.totalCenters);
  console.log('Updated metrics totalVolunteers:', data2.metrics.totalVolunteers);

  // Verify dynamic metrics updated
  const centerAdded = data2.metrics.totalCenters === data1.metrics.totalCenters + 1;
  const volAdded = data2.metrics.totalVolunteers === data1.metrics.totalVolunteers + 1;

  // Find dynamic volunteer in atRiskList
  const atRiskItem = data2.atRiskList.find((v: any) => v.id === testVol.id);
  console.log('Dynamic at-risk item for test volunteer:', atRiskItem);

  const hasHighRisk = atRiskItem && atRiskItem.riskLevel === 'HIGH';
  const hasConsecutiveAbsenceFactor = atRiskItem && atRiskItem.primaryRiskFactor === 'Multiple consecutive session absences';
  const hasCheckInAction = atRiskItem && atRiskItem.recommendedActions.includes('Schedule 1-on-1 check-in');
  const hasBuddyAction = atRiskItem && atRiskItem.recommendedActions.includes('Assign buddy mentor');

  // Clean up stress records
  await prisma.volunteerAttendance.deleteMany({ where: { sessionId: { in: sessions.map(s => s.id) } } });
  await prisma.session.deleteMany({ where: { centerId: testCenter.id } });
  await prisma.volunteer.delete({ where: { id: testVol.id } });
  await prisma.center.delete({ where: { id: testCenter.id } });

  console.log('\n--- Empirical Validation Results ---');
  console.log(`Dynamic Center count update: ${centerAdded ? 'PASSED' : 'FAILED'}`);
  console.log(`Dynamic Volunteer count update: ${volAdded ? 'PASSED' : 'FAILED'}`);
  console.log(`Dynamic High Risk classification: ${hasHighRisk ? 'PASSED' : 'FAILED'}`);
  console.log(`Dynamic Risk Factor calculation: ${hasConsecutiveAbsenceFactor ? 'PASSED' : 'FAILED'}`);
  console.log(`Dynamic Recommended Actions generation: ${hasCheckInAction && hasBuddyAction ? 'PASSED' : 'FAILED'}`);

  if (centerAdded && volAdded && hasHighRisk && hasConsecutiveAbsenceFactor && hasCheckInAction && hasBuddyAction) {
    console.log('\n=== EMPIRICAL STRESS TEST PASSED COMPLETELY ===');
  } else {
    console.error('\n=== EMPIRICAL STRESS TEST FAILED ===');
    process.exit(1);
  }
}

runEmpiricalStressTest().catch((err) => {
  console.error('Stress test failed:', err);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
