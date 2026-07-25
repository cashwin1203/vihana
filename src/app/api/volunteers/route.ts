import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { maskVolunteerPII, logSecurityAudit } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const centerId = searchParams.get('centerId');
    const status = searchParams.get('status');
    const isExport = searchParams.get('export') === 'csv' || searchParams.get('format') === 'csv';
    const unmask = searchParams.get('unmask') === 'true';

    const where: any = {};
    if (centerId) where.centerId = centerId;
    if (status) where.status = status;

    const volunteers = await prisma.volunteer.findMany({
      where,
      include: {
        center: true,
        _count: {
          select: {
            attendances: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    if (isExport) {
      await logSecurityAudit('ADMIN', 'CSV_EXPORT', {
        action: 'EXPORT_VOLUNTEERS_CSV',
        totalRecords: volunteers.length,
        centerId: centerId || 'ALL',
      });

      const csvHeader = 'Name,Email,Phone,Role,Status,Skills,Center\n';
      const csvRows = volunteers
        .map((v) => `"${v.name}","${v.email}","${v.phone}","${v.role}","${v.status}","${v.skills}","${v.center?.name || ''}"`)
        .join('\n');
      
      return new Response(csvHeader + csvRows, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="volunteers.csv"',
        },
      });
    }

    // Task 4: Ensure GET /api/volunteers does NOT expose raw phone numbers by default
    const output = unmask ? volunteers : volunteers.map(maskVolunteerPII);

    return NextResponse.json(output);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, role, skills, centerId } = body;

    const volunteer = await prisma.volunteer.create({
      data: {
        name,
        email,
        phone: phone || '',
        whatsappPhone: phone || '',
        role: role || 'VOLUNTEER',
        status: 'ACTIVE',
        skills: skills || 'Teaching, General',
        centerId: centerId || null,
      },
    });

    // Task 5: Immutable AuditLog for Volunteer creation / onboarding
    await logSecurityAudit('ADMIN', 'ONBOARD_VOLUNTEER', {
      volunteerId: volunteer.id,
      volunteerName: name,
      email,
      role: volunteer.role,
      centerId: volunteer.centerId,
    });

    return NextResponse.json(volunteer, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, status, role, centerId } = body;

    // Task 1: Deactivating volunteer sets status: INACTIVE while preserving attendance history
    const updated = await prisma.volunteer.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(role && { role }),
        ...(centerId !== undefined && { centerId }),
      },
      include: {
        center: true,
        attendances: true,
      },
    });

    const auditAction = status === 'INACTIVE' ? 'DEACTIVATE_VOLUNTEER' : 'UPDATE_VOLUNTEER_STATUS';
    await logSecurityAudit('ADMIN', auditAction, {
      volunteerId: id,
      volunteerName: updated.name,
      status: updated.status,
      preservedAttendancesCount: updated.attendances.length,
      role: updated.role,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
