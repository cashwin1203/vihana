import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logSecurityAudit } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const centerId = searchParams.get('centerId');

    const where: any = {};
    if (centerId) where.centerId = centerId;

    const students = await prisma.student.findMany({
      where,
      include: {
        center: true,
      },
      orderBy: { studentCode: 'asc' },
    });

    return NextResponse.json(students);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { centerId, grade, studentCode } = body;

    if (!centerId) {
      return NextResponse.json({ error: 'Center ID is required' }, { status: 400 });
    }

    const center = await prisma.center.findUnique({ where: { id: centerId } });
    if (!center) {
      return NextResponse.json({ error: 'Center not found' }, { status: 404 });
    }

    // Task 6: Ensure anonymized student locus codes (e.g. Student VHN-01) - no full personal names of minors stored
    let codeToUse = studentCode;
    if (!codeToUse) {
      const existingCount = await prisma.student.count({ where: { centerId } });
      const prefix = center.name.substring(0, 3).toUpperCase();
      codeToUse = `Student ${prefix}-${(existingCount + 1).toString().padStart(2, '0')}`;
    }

    const student = await prisma.student.create({
      data: {
        studentCode: codeToUse,
        grade: grade || 'Grade 6',
        centerId,
      },
      include: {
        center: true,
      },
    });

    await logSecurityAudit('COORDINATOR', 'REGISTER_STUDENT', {
      studentId: student.id,
      studentCode: student.studentCode,
      centerId,
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
