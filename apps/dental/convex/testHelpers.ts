'use node'

import { v } from 'convex/values'
import { action } from './_generated/server'
import { Scrypt } from 'lucia'
import { api } from './_generated/api'

/**
 * TEST-ONLY (secret-gated): create/replace a Convex Auth password account for an
 * existing seeded user, so automated tests can log in without an OTP email. Uses the
 * SAME hashing (lucia Scrypt) as @convex-dev/auth's Password provider. Runs in the
 * Node runtime because scrypt needs node:crypto. Gate is CONVEX_AUTH_BRIDGE_SECRET.
 *
 * Not used by the app; safe to delete after testing.
 */
export const createTestPasswordAccount = action({
  args: { secret: v.string(), email: v.string(), password: v.string() },
  handler: async (ctx, args): Promise<unknown> => {
    if (!process.env.CONVEX_AUTH_BRIDGE_SECRET || args.secret !== process.env.CONVEX_AUTH_BRIDGE_SECRET) {
      throw new Error('Unauthorized test-helper request')
    }
    const hash = await new Scrypt().hash(args.password)
    return await ctx.runMutation(api.authMigration.linkPasswordAccount, {
      secret: args.secret,
      email: args.email.toLowerCase(),
      hash,
    })
  },
})
