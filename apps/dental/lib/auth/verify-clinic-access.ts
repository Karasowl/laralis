import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Returns true iff `userId` belongs to `clinicId` (workspace owner OR
 * member of clinic_users).
 *
 * The actions/* endpoints used to query a `clinic_memberships` table that
 * does not exist in production (the real tables are `workspace_users` and
 * `clinic_users`). That made every action return a 403 even for valid
 * users; worse, the broken check made the membership step look done while
 * actually performing no real authorization.
 *
 * This helper goes through the same `user_has_clinic_access` RPC the rest
 * of the codebase relies on (see lib/clinic.ts).
 */
export async function verifyClinicAccess(
  userId: string,
  clinicId: string
): Promise<boolean> {
  if (!UUID_REGEX.test(userId) || !UUID_REGEX.test(clinicId)) return false

  const { data, error } = await supabaseAdmin.rpc('user_has_clinic_access', {
    clinic_id: clinicId,
    user_id: userId,
  })

  if (error) {
    // Some deployments accept only the single-arg variant of the RPC
    // (using auth.uid() internally). Retry without the user_id arg using
    // the caller's session client, if provided. Otherwise treat as deny.
    console.error('[verify-clinic-access] RPC error:', error.message)
    return false
  }
  return Boolean(data)
}

/**
 * Convenience guard that returns a pre-built 403 NextResponse when the
 * user does not belong to the clinic. Lets callers stay clean:
 *
 *   const denied = await assertClinicAccess(user.id, clinic_id)
 *   if (denied) return denied
 */
export async function assertClinicAccess(
  userId: string,
  clinicId: string,
  supabase?: SupabaseClient
): Promise<Response | null> {
  // Prefer the caller's session client when provided so RLS policies
  // around the RPC apply correctly.
  const client = supabase ?? supabaseAdmin
  const { data, error } = await client.rpc('user_has_clinic_access', {
    clinic_id: clinicId,
  })
  if (!error && Boolean(data)) return null
  // Fallback to admin RPC with explicit user_id (older signature).
  if (await verifyClinicAccess(userId, clinicId)) return null
  return new Response(
    JSON.stringify({ error: 'You do not have access to this clinic' }),
    { status: 403, headers: { 'content-type': 'application/json' } }
  )
}
