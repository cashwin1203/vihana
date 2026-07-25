import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWhatsAppSignature, logSecurityAudit, sanitizeInputText } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const expectedToken = process.env.META_WA_VERIFY_TOKEN || 'VOLUNTEER_OS_WA_TOKEN';

  if (mode === 'subscribe' && token === expectedToken) {
    return new Response(challenge || '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

interface ParsedPayload {
  action?: string;
  volunteerId?: string;
  phone?: string;
  text?: string;
  isSimulator?: boolean;
}

function parseWebhookBody(body: any): ParsedPayload {
  if (!body) return {};

  // Check if it's explicit simulator call
  if (body.volunteerId || body.isSimulator) {
    return {
      action: body.action,
      volunteerId: body.volunteerId,
      phone: body.whatsappPhone || body.phone,
      text: body.text,
      isSimulator: true,
    };
  }

  // Meta Cloud API Payload structure
  if (body.object === 'whatsapp_business_account' && Array.isArray(body.entry)) {
    for (const entry of body.entry) {
      if (Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          const value = change?.value;
          if (value && Array.isArray(value.messages) && value.messages.length > 0) {
            const msg = value.messages[0];
            const phone = msg.from;
            let action: string | undefined = undefined;
            let text: string | undefined = undefined;

            if (msg.type === 'interactive' && msg.interactive) {
              action = msg.interactive.button_reply?.id || msg.interactive.list_reply?.id;
              text = msg.interactive.button_reply?.title || msg.interactive.list_reply?.title;
            } else if (msg.type === 'button' && msg.button) {
              action = msg.button.payload;
              text = msg.button.text;
            } else if (msg.type === 'text' && msg.text) {
              text = msg.text.body;
              const normalized = (text || '').trim().toUpperCase();
              if (normalized === 'RSVP_ATTENDING' || normalized === 'ATTENDING' || normalized === 'YES') {
                action = 'RSVP_ATTENDING';
              } else if (normalized === 'RSVP_ABSENT' || normalized === 'ABSENT' || normalized === 'NO') {
                action = 'RSVP_ABSENT';
              } else if (normalized === 'CHECK_IN' || normalized === 'CHECKIN') {
                action = 'CHECK_IN';
              }
            }

            return {
              action,
              phone,
              text,
              isSimulator: false,
            };
          }
        }
      }
    }
  }

  // Simple JSON payload fallback
  return {
    action: body.action,
    volunteerId: body.volunteerId,
    phone: body.whatsappPhone || body.phone,
    text: body.text,
    isSimulator: false,
  };
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('x-hub-signature-256');

    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = parseWebhookBody(body);

    // Signature Verification
    const secretConfigured = !!process.env.META_APP_SECRET;
    if (signatureHeader || secretConfigured) {
      const isValid = verifyWhatsAppSignature(rawBody, signatureHeader);
      if (!isValid) {
        await logSecurityAudit('UNAUTHORIZED_WEBHOOK_CALLER', 'WEBHOOK_SIGNATURE_FAILED', {
          ip: req.headers.get('x-forwarded-for') || 'unknown',
        });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else if (!parsed.isSimulator) {
      await logSecurityAudit('UNAUTHORIZED_WEBHOOK_CALLER', 'WEBHOOK_SIGNATURE_MISSING', {
        ip: req.headers.get('x-forwarded-for') || 'unknown',
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const volunteerId = parsed.volunteerId;
    const action = parsed.action;
    const textContent = sanitizeInputText(parsed.text, 1000);
    const phone = parsed.phone;

    // Find Target Volunteer
    let volunteer = null;

    if (volunteerId) {
      volunteer = await prisma.volunteer.findUnique({
        where: { id: volunteerId },
        include: { center: true },
      });
    }

    if (!volunteer && phone) {
      const digitsOnly = phone.replace(/[^\d]/g, '');
      const last10 = digitsOnly.slice(-10);

      volunteer = await prisma.volunteer.findFirst({
        where: {
          OR: [
            { whatsappPhone: phone },
            { phone: phone },
            { whatsappPhone: `+${digitsOnly}` },
            { phone: `+${digitsOnly}` },
            { whatsappPhone: digitsOnly },
            { phone: digitsOnly },
          ],
        },
        include: { center: true },
      });

      if (!volunteer && last10.length === 10) {
        const allVols = await prisma.volunteer.findMany({
          select: { id: true, phone: true, whatsappPhone: true },
        });
        const matched = allVols.find((v) => {
          const vWp = (v.whatsappPhone || '').replace(/[^\d]/g, '');
          const vPh = (v.phone || '').replace(/[^\d]/g, '');
          return (vWp && vWp.endsWith(last10)) || (vPh && vPh.endsWith(last10));
        });

        if (matched) {
          volunteer = await prisma.volunteer.findUnique({
            where: { id: matched.id },
            include: { center: true },
          });
        }
      }
    }

    if (!volunteer) {
      const displayPhone = phone
        ? (phone.startsWith('+') ? phone : `+${phone}`)
        : 'unknown';
      return NextResponse.json({
        reply: `Sorry, your WhatsApp number (${displayPhone}) is not registered in Volunteer OS. Please contact your Chapter Leader.`,
      });
    }

    // Find Session
    let session = await prisma.session.findFirst({
      where: volunteer.centerId ? { centerId: volunteer.centerId, status: { in: ['UPCOMING', 'COMPLETED'] } } : { status: { in: ['UPCOMING', 'COMPLETED'] } },
      orderBy: { sessionDate: 'desc' },
      include: { volunteerAttendances: { include: { volunteer: true } } },
    });

    if (!session) {
      const upcomingDate = new Date();
      upcomingDate.setDate(upcomingDate.getDate() + 7);
      session = await prisma.session.create({
        data: {
          centerId: volunteer.centerId || (await prisma.center.findFirst())?.id || '',
          sessionDate: upcomingDate,
          startTime: '14:30',
          endTime: '17:30',
          status: 'UPCOMING',
        },
        include: { volunteerAttendances: { include: { volunteer: true } } },
      });
    }

    // Process Actions:
    // 1. RSVP_ATTENDING
    if (action === 'RSVP_ATTENDING' || action === 'ACCEPT_BACKUP') {
      const attendance = await prisma.volunteerAttendance.upsert({
        where: {
          sessionId_volunteerId: {
            sessionId: session.id,
            volunteerId: volunteer.id,
          },
        },
        update: {
          rsvpStatus: 'ATTENDING',
          botState: 'IDLE',
        },
        create: {
          sessionId: session.id,
          volunteerId: volunteer.id,
          rsvpStatus: 'ATTENDING',
          botState: 'IDLE',
        },
      });

      await logSecurityAudit(volunteer.name, 'WHATSAPP_RSVP_CONFIRMED', {
        volunteerId: volunteer.id,
        status: 'ATTENDING',
        attendanceId: attendance.id,
      });

      return NextResponse.json({
        reply: `Awesome, ${volunteer.name}! ✅ Your RSVP for Saturday (${volunteer.center?.slotTime || '2:30 PM - 5:30 PM'}) at ${volunteer.center?.name || 'Center'} is confirmed. See you there!`,
        updatedRsvp: 'ATTENDING',
        attendanceId: attendance.id,
      });
    }

    // 2. RSVP_ABSENT
    if (action === 'RSVP_ABSENT') {
      const attendance = await prisma.volunteerAttendance.upsert({
        where: {
          sessionId_volunteerId: {
            sessionId: session.id,
            volunteerId: volunteer.id,
          },
        },
        update: {
          rsvpStatus: 'ABSENT',
          botState: 'IDLE',
        },
        create: {
          sessionId: session.id,
          volunteerId: volunteer.id,
          rsvpStatus: 'ABSENT',
          botState: 'IDLE',
        },
      });

      // Standby Backup Escalation Logic
      const backupVolunteer = session.volunteerAttendances.find(
        (a) => a.rsvpStatus === 'BACKUP' || (a.rsvpStatus === 'PENDING' && a.volunteerId !== volunteer.id)
      );

      await logSecurityAudit(volunteer.name, 'WHATSAPP_RSVP_ABSENT_ESCALATED', {
        volunteerId: volunteer.id,
        backupEscalatedTo: backupVolunteer?.volunteer?.name || 'None',
        attendanceId: attendance.id,
      });

      return NextResponse.json({
        reply: `Thanks for letting us know, ${volunteer.name}. ❌ Your absence has been logged. Your Centre Leader has been notified to assign a standby backup.`,
        updatedRsvp: 'ABSENT',
        backupEscalated: backupVolunteer ? backupVolunteer.volunteer?.name : null,
        attendanceId: attendance.id,
      });
    }

    // 3. CHECK_IN
    if (action === 'CHECK_IN') {
      const attendance = await prisma.volunteerAttendance.upsert({
        where: {
          sessionId_volunteerId: {
            sessionId: session.id,
            volunteerId: volunteer.id,
          },
        },
        update: {
          checkInStatus: 'PRESENT',
          hoursLogged: 3.0,
          botState: 'AWAITING_NOTES',
        },
        create: {
          sessionId: session.id,
          volunteerId: volunteer.id,
          checkInStatus: 'PRESENT',
          hoursLogged: 3.0,
          botState: 'AWAITING_NOTES',
        },
      });

      const total = await prisma.volunteerAttendance.aggregate({
        where: { volunteerId: volunteer.id, checkInStatus: 'PRESENT' },
        _sum: { hoursLogged: true },
      });

      const updatedTotalHours = Number(total._sum.hoursLogged || 0);

      await prisma.volunteer.update({
        where: { id: volunteer.id },
        data: { totalHours: updatedTotalHours },
      });

      await logSecurityAudit(volunteer.name, 'WHATSAPP_FIELD_CHECKIN', {
        volunteerId: volunteer.id,
        hoursLogged: 3.0,
        attendanceId: attendance.id,
      });

      return NextResponse.json({
        reply: `📍 Check-in verified at ${volunteer.center?.name || 'Center'}! +3.0 volunteer hours added to your profile (Total: ${updatedTotalHours} hrs). Enjoy teaching today! 📚`,
        updatedCheckIn: 'PRESENT',
        attendanceId: attendance.id,
      });
    }

    // 4. Text Notes or Commands
    if (action === 'LOG_NOTES' || textContent) {
      if (textContent?.startsWith('/status')) {
        const attendingCount = session.volunteerAttendances.filter((a) => a.rsvpStatus === 'ATTENDING').length;
        const totalRoster = session.volunteerAttendances.length;
        return NextResponse.json({
          reply: `📊 *${volunteer.center?.name || 'Center'} Status*\n• Attending: ${attendingCount}/${totalRoster} volunteers\n• Slot: ${volunteer.center?.slotTime || 'N/A'}\n• Session Status: ${session.status}`,
        });
      }

      await prisma.session.update({
        where: { id: session.id },
        data: {
          topicCovered: textContent,
          activitiesCompleted: 'Submitted via WhatsApp Bot',
        },
      });

      await logSecurityAudit(volunteer.name, 'WHATSAPP_LOGGED_NOTES', {
        volunteerId: volunteer.id,
        topic: textContent,
      });

      return NextResponse.json({
        reply: `📝 Thank you ${volunteer.name}! Your session topic ("${textContent}") has been recorded in the ${volunteer.center?.name || 'Center'} logbook!`,
        loggedTopic: textContent,
      });
    }

    return NextResponse.json({ reply: `Hi ${volunteer.name}! Type /status to check roster status or select an RSVP option.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
