import Resend from '@auth/core/providers/resend'
import { Resend as ResendAPI } from 'resend'

/**
 * Email VERIFICATION code provider for sign-up (Convex Auth Password `verify`).
 * Runs INSIDE the Convex deployment, so it reads AUTH_RESEND_KEY / AUTH_EMAIL from
 * the Convex env (set via `npx convex env set`), NOT the Next.js .env.local.
 *
 * 8-digit numeric OTP generated inline with Web Crypto (no extra dependency).
 */
function generateNumericOtp(length: number): string {
  const digits = '0123456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) out += digits[bytes[i] % 10]
  return out
}

export const ResendOTP = Resend({
  id: 'resend-otp',
  apiKey: process.env.AUTH_RESEND_KEY,
  async generateVerificationToken() {
    return generateNumericOtp(8)
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey)
    const { error } = await resend.emails.send({
      from: process.env.AUTH_EMAIL ?? 'Laralis <noreply@laralis.com>',
      to: [email],
      subject: 'Verifica tu cuenta Laralis',
      text: `Tu código de verificación es ${token}`,
    })
    if (error) {
      throw new Error(JSON.stringify(error))
    }
  },
})
