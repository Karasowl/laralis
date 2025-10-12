import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

const ISSUER = 'Laralis';

function getEncryptionKey(): Buffer {
  const secret = process.env.TOTP_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('TOTP_ENCRYPTION_KEY is not configured');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(secret: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptSecret(payload: string): string {
  try {
    const buffer = Buffer.from(payload, 'base64');
    const iv = buffer.subarray(0, 12);
    const authTag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error('Failed to decrypt TOTP secret');
  }
}

export function generateRecoveryCodes(count = 8): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  const hashed: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const code = crypto.randomBytes(5).toString('hex').toUpperCase();
    plain.push(code);
    hashed.push(crypto.createHash('sha256').update(code).digest('hex'));
  }

  return { plain, hashed };
}

export async function generateTotpSetup(email: string) {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, ISSUER, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth, { type: 'image/png' });

  return {
    secret,
    otpauth,
    qrCodeDataUrl,
  };
}

export function verifyTotpToken(secret: string, token: string): boolean {
  try {
    return authenticator.check(token, secret);
  } catch {
    return false;
  }
}

export function verifyRecoveryCode(code: string, hashedCodes: string[]): { valid: boolean; remaining: string[] } {
  const normalized = code.trim().toUpperCase();
  const hashed = crypto.createHash('sha256').update(normalized).digest('hex');
  const index = hashedCodes.indexOf(hashed);
  if (index === -1) {
    return { valid: false, remaining: hashedCodes };
  }

  const remaining = [...hashedCodes];
  remaining.splice(index, 1);
  return { valid: true, remaining };
}
