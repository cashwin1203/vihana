import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logSecurityAudit } from '@/lib/security';

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { type, id, rsvpStatus, checkInStatus, hoursLogged, notes, studentStatus } = body;

    if (type === 'VOLUNTEER') {
      // Task 2: Manual Check-In Override logs 3.0 hours by default when PRESENT
      const effectiveHours = checkInStatus === 'PRESENT'
        ? (hoursLogged !== undefined && hoursLogged !== null ? Number(hoursLogged) : 3.0)
        : (hoursLogged !== undefined ? Number(hoursLogged) : undefined);

      const attendance = await prisma.volunteerAttendance.update({
        where: { id },
        data: {
          ...(rsvpStatus && { rsvpStatus }),
          ...(checkInStatus && { checkInStatus }),
          ...(effectiveHours !== undefined && { hoursLogged: effectiveHours }),
          ...(notes !== undefined && { notes }),
        },
        include: {
          volunteer: true,
        },
      });

      // Recalculate volunteer total hours if checkInStatus is PRESENT
      if (attendance.checkInStatus === 'PRESENT') {
        const total = await prisma.volunteerAttendance.aggregate({
          where: {
            volunteerId: attendance.volunteerId,
            checkInStatus: 'PRESENT',
          },
          _sum: {
            hoursLogged: true,
          },
        });

        await prisma.volunteer.update({
          where: { id: attendance.volunteerId },
          data: { totalHours: total._sum.hoursLogged || 0 },
        });

        await logSecurityAudit('COORDINATOR', 'MANUAL_CHECKIN_OVERRIDE', {
          attendanceId: id,
          volunteerId: attendance.volunteerId,
          volunteerName: attendance.volunteer?.name,
          checkInStatus: 'PRESENT',
          hoursLogged: attendance.hoursLogged,
        });
      }

      return NextResponse.json(attendance);
    } else if (type === 'STUDENT') {
      const attendance = await prisma.studentAttendance.update({
        where: { id },
        data: {
          ...(studentStatus && { status: studentStatus }),
          ...(notes !== undefined && { notes }),
        },
      });

      return NextResponse.json(attendance);
    }

    return NextResponse.json({ error: 'Invalid attendance type' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
