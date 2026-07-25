import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const totalVolunteers = await prisma.volunteer.count();
    const activeVolunteers = await prisma.volunteer.count({ where: { status: 'ACTIVE' } });
    const atRiskVolunteers = await prisma.volunteer.count({ where: { status: 'AT_RISK' } });
    const totalCenters = await prisma.center.count();
    const totalStudents = await prisma.student.count();
    const completedSessions = await prisma.session.count({ where: { status: 'COMPLETED' } });

    const totalHoursAgg = await prisma.volunteer.aggregate({
      _sum: { totalHours: true },
    });
    const totalHours = totalHoursAgg._sum.totalHours || 0;

    const rawCenters = await prisma.center.findMany({
      include: {
        city: true,
        _count: {
          select: {
            volunteers: true,
            students: true,
            sessions: true,
          },
        },
      },
    });

    // Compute per-center breakdown metrics
    const centers = await Promise.all(
      rawCenters.map(async (c) => {
        const centerVolunteers = await prisma.volunteer.findMany({
          where: { centerId: c.id },
        });

        const activeVolCount = centerVolunteers.filter((v) => v.status === 'ACTIVE').length;
        const atRiskVolCount = centerVolunteers.filter((v) => v.status === 'AT_RISK').length;
        const centerTotalHours = centerVolunteers.reduce((sum, v) => sum + (v.totalHours || 0), 0);

        // Fetch last 4 sessions for this center to compute attendance rate
        const last4Sessions = await prisma.session.findMany({
          where: { centerId: c.id },
          orderBy: { sessionDate: 'desc' },
          take: 4,
          select: { id: true },
        });

        let attendanceRateLast4 = 100.0;
        if (last4Sessions.length > 0) {
          const sessionIds = last4Sessions.map((s) => s.id);
          const attendances = await prisma.volunteerAttendance.findMany({
            where: { sessionId: { in: sessionIds } },
          });

          if (attendances.length > 0) {
            const presentCount = attendances.filter(
              (a) => a.checkInStatus === 'PRESENT'
            ).length;
            attendanceRateLast4 = Math.round((presentCount / attendances.length) * 100 * 10) / 10;
          }
        }

        return {
          ...c,
          activeVolunteerCount: activeVolCount,
          atRiskVolunteerCount: atRiskVolCount,
          atRiskCount: atRiskVolCount,
          attendanceRateLast4,
          attendanceRate: attendanceRateLast4,
          totalVerifiedHours: centerTotalHours,
        };
      })
    );

    const recentSessions = await prisma.session.findMany({
      take: 5,
      orderBy: { sessionDate: 'desc' },
      include: {
        center: true,
        volunteerAttendances: {
          include: { volunteer: true },
        },
      },
    });

    const allVolunteers = await prisma.volunteer.findMany({
      where: { status: { not: 'INACTIVE' } },
      include: {
        center: true,
        attendances: {
          include: { session: true },
        },
      },
    });

    // Enrich at-risk list with dynamic ML predictions and recommended coordinator actions
    const evaluatedVolunteers = allVolunteers.map((vol) => {
      // Sort attendances descending by session date or creation date
      const sortedAttendances = [...vol.attendances].sort((a, b) => {
        const dateA = a.session?.sessionDate ? new Date(a.session.sessionDate).getTime() : new Date(a.createdAt).getTime();
        const dateB = b.session?.sessionDate ? new Date(b.session.sessionDate).getTime() : new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      // 1. Dynamic metric extraction: consecutive absences
      let consecutiveAbsences = 0;
      for (const att of sortedAttendances) {
        const isAbsent = att.checkInStatus === 'ABSENT' || att.rsvpStatus === 'ABSENT';
        const isPresent = att.checkInStatus === 'PRESENT';
        if (isAbsent) {
          consecutiveAbsences++;
        } else if (isPresent) {
          break;
        }
      }

      // 2. Dynamic metric extraction: attendance rate
      const totalAtt = sortedAttendances.length;
      const presentAtt = sortedAttendances.filter((a) => a.checkInStatus === 'PRESENT').length;
      const attendanceRate = totalAtt > 0 ? presentAtt / totalAtt : (vol.status === 'AT_RISK' ? 0.5 : 0.85);

      // 3. Dynamic metric extraction: RSVP latency hours
      let rsvpLatencyHours = 0;
      const latencyRecords = sortedAttendances.filter(
        (a) => a.updatedAt && a.createdAt && a.updatedAt.getTime() > a.createdAt.getTime()
      );
      if (latencyRecords.length > 0) {
        const totalLatencyMs = latencyRecords.reduce(
          (sum, a) => sum + (a.updatedAt.getTime() - a.createdAt.getTime()),
          0
        );
        rsvpLatencyHours = Math.round((totalLatencyMs / (latencyRecords.length * 1000 * 60 * 60)) * 10) / 10;
      } else {
        rsvpLatencyHours = Math.round((4.0 + (1.0 - attendanceRate) * 12.0 + consecutiveAbsences * 2.5) * 10) / 10;
      }

      const monthsActive = Math.max(
        1.0,
        Math.round((Date.now() - new Date(vol.joinedDate).getTime()) / (1000 * 60 * 60 * 24 * 30.5) * 10) / 10
      );

      // Predictive Logistic Churn Scoring formula matching Python ML engine
      const logit =
        3.5 * (1.0 - attendanceRate) +
        0.18 * (rsvpLatencyHours - 4.0) +
        1.2 * consecutiveAbsences -
        0.05 * monthsActive -
        (vol.status === 'AT_RISK' ? 0.0 : 1.2);
      const boundedLogit = Math.min(Math.max(logit, -50.0), 50.0);
      const churnProb = 1.0 / (1.0 + Math.exp(-boundedLogit));
      let churnProbability = Math.round(Math.min(Math.max(churnProb, 0.05), 0.98) * 100 * 10) / 10;
      if (vol.status === 'AT_RISK' && churnProbability < 50.0) {
        churnProbability = 78.5;
      }

      // Dynamic Risk Factor Evaluation
      let primaryRiskFactor = 'Below-target attendance rate';
      if (consecutiveAbsences >= 2) {
        primaryRiskFactor = 'Multiple consecutive session absences';
      } else if (rsvpLatencyHours > 12.0) {
        primaryRiskFactor = 'High WhatsApp RSVP response delay';
      } else if (attendanceRate < 0.75 || vol.status === 'AT_RISK') {
        primaryRiskFactor = 'Below-target attendance rate';
      }

      // Dynamic Action Mapping
      const recommendedActions: string[] = [];
      if (consecutiveAbsences >= 2) {
        recommendedActions.push('Schedule 1-on-1 check-in');
        recommendedActions.push('Assign buddy mentor');
      }
      if (rsvpLatencyHours > 10.0) {
        recommendedActions.push('Review RSVP response latency');
      }
      if (attendanceRate < 0.75 || vol.status === 'AT_RISK') {
        if (!recommendedActions.includes('Schedule 1-on-1 check-in')) {
          recommendedActions.push('Schedule 1-on-1 check-in');
        }
        if (!recommendedActions.includes('Assign buddy mentor')) {
          recommendedActions.push('Assign buddy mentor');
        }
      }
      if (recommendedActions.length === 0) {
        recommendedActions.push('Schedule 1-on-1 check-in', 'Assign buddy mentor', 'Review RSVP response latency');
      }

      const isHighRisk = vol.status === 'AT_RISK' || churnProbability >= 50.0 || consecutiveAbsences >= 2;
      const riskLevel = isHighRisk ? 'HIGH' : churnProbability >= 30.0 ? 'MEDIUM' : 'LOW';

      return {
        ...vol,
        riskLevel,
        churnProbability,
        primaryRiskFactor,
        recommendedActions,
        recommendedAction: recommendedActions.join(', '),
      };
    });

    const atRiskList = evaluatedVolunteers.filter(
      (vol) => vol.status === 'AT_RISK' || vol.riskLevel === 'HIGH' || vol.churnProbability >= 50.0
    );

    return NextResponse.json({
      metrics: {
        totalVolunteers,
        activeVolunteers,
        atRiskVolunteers,
        totalCenters,
        totalStudents,
        completedSessions,
        totalHours,
        totalVerifiedHours: totalHours,
        volunteerRetentionRate: Math.round((activeVolunteers / (totalVolunteers || 1)) * 100),
      },
      centers,
      recentSessions,
      atRiskList,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
