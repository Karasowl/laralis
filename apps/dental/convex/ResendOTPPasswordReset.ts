import Resend from '@auth/core/providers/resend'
import { Resend as ResendAPI } from 'resend'

/**
 * Password RESET code provider (Convex Auth Password `reset`). Same shape as
 * ResendOTP but a distinct id + subject. Runs inside the Convex deployment and
 * reads AUTH_RESEND_KEY / AUTH_EMAIL from the Convex env.
 */
function generateNumericOtp(length: number): string {
  const digits = '0123456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) out += digits[bytes[i] % 10]
  return out
}

export const ResendOTPPasswordReset = Resend({
  id: 'resend-otp-reset',
  apiKey: process.env.AUTH_RESEND_KEY,
  async generateVerificationToken() {
    return generateNumericOtp(8)
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey)
    const { error } = await resend.emails.send({
      from: process.env.AUTH_EMAIL ?? 'Laralis <noreply@laralis.com>',
      to: [email],
      subject: 'Restablece tu contraseña Laralis',
      text: `Tu código para restablecer la contraseña es ${token}`,
    })
    if (error) {
      throw new Error(JSON.stringify(error))
    }
  },
})
