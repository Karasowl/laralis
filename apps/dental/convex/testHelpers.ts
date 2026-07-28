'use node'

import { v } from 'convex/values'
import { action } from './_generated/server'
import { Scrypt } from 'lucia'
import { api } from './_generated/api'

/**
 * TEST-ONLY (secret-gated): create/replace a Convex Auth password account for an
 * existing seeded user, so automated tests can log in without an OTP email. Uses the
 * SAME hashing (lucia Scrypt) as @convex-dev/auth's Password provider. Runs in the
 * Node runtime because scrypt needs node:crypto.
 *
 * Two gates, not one. The secret alone is not enough because this sets an arbitrary
 * password hash for any email, which is account takeover if the shared secret ever
 * leaks. CONVEX_TEST_HELPERS_ENABLED must ALSO be set on the deployment, and it is
 * only ever set on dev — so this is inert in production even with a valid secret.
 * (Phase F runbook says to delete this file before prod; keeping it gated instead
 * means the Convex-auth E2E specs still run against dev.)
 */
export const createTestPasswordAccount = action({
  args: { secret: v.string(), email: v.string(), password: v.string() },
  handler: async (ctx, args): Promise<unknown> => {
    if (process.env.CONVEX_TEST_HELPERS_ENABLED !== '1') {
      throw new Error('Test helpers are disabled on this deployment')
    }
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
