import { Password } from '@convex-dev/auth/providers/Password'
import { convexAuth } from '@convex-dev/auth/server'
import { ResendOTP } from './ResendOTP'
import { ResendOTPPasswordReset } from './ResendOTPPasswordReset'

/**
 * Convex Auth — EMAIL/PASSWORD ONLY (no Google/social, per product decision).
 *
 * Password flows exposed: 'signIn', 'signUp', 'reset', 'reset-verification',
 * 'email-verification'. verify = ResendOTP (sign-up email code), reset =
 * ResendOTPPasswordReset (password-reset email code).
 *
 * profile() maps signUp params -> the users doc, keeping email + name parallel to
 * the Supabase user_metadata the rest of the app reads.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      verify: ResendOTP,
      reset: ResendOTPPasswordReset,
      profile(params) {
        return {
          email: params.email as string,
          name: (params.name as string) ?? undefined,
        }
      },
    }),
  ],
})
