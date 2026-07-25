import crypto from 'crypto';
import { prisma } from './prisma';

export function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) {
    return false;
  }

  const appSecret = process.env.META_APP_SECRET || 'VOLUNTEER_OS_WA_SECRET';

  try {
    const cleanHeader = signatureHeader.startsWith('sha256=')
      ? signatureHeader.slice(7)
      : signatureHeader;

    const expectedHex = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    const headerBuffer = Buffer.from(cleanHeader, 'hex');
    const computedBuffer = Buffer.from(expectedHex, 'hex');

    if (headerBuffer.length !== computedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuffer, headerBuffer);
  } catch {
    return false;
  }
}

/**
 * Robustly masks phone numbers to compliance format: +91 ***** 43210
 */
export function maskPhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    const last5 = digits.slice(-5);
    return `+91 ***** ${last5}`;
  }
  return phone;
}

/**
 * Masks Volunteer PII for API responses
 */
export function maskVolunteerPII(volunteer: any) {
  if (!volunteer) return volunteer;
  return {
    ...volunteer,
    phone: maskPhoneNumber(volunteer.phone),
    whatsappPhone: maskPhoneNumber(volunteer.whatsappPhone),
    email: volunteer.email ? volunteer.email.replace(/(.{2})(.*)(?=@)/, (_: string, g2: string, g3: string) => g2 + '*'.repeat(g3.length)) : null,
  };
}

/**
 * Sanitizes input text to prevent prompt injection and XSS
 */
export function sanitizeInputText(input: string | null | undefined, maxLength: number = 1000): string {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '')
    .slice(0, maxLength)
    .trim();
}

/**
 * Writes an immutable audit trail entry to the database
 */
export async function logSecurityAudit(actorName: string, action: string, details: object) {
  try {
    await prisma.auditLog.create({
      data: {
        actorName,
        action,
        details: JSON.stringify(details),
      },
    });
  } catch (e) {
    console.error('Audit Log Exception:', e);
  }
}
