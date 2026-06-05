import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { convexUserHasClinicAccess } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'
import { getAuthBackend } from '@/lib/auth/convex-session'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Authorization flips together with the rest of the permission subsystem: either
// a full auth cutover (AUTH_BACKEND=convex) or DATA_READ_BACKEND_ROLE_PERMISSIONS.
function useConvexAuthorization() {
  return getAuthBackend() === 'convex' || shouldReturnConvexData('role_permissions')
}

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

  // Convex branch (flag-gated, default Supabase) — replicates is_clinic_member.
  if (useConvexAuthorization()) {
    try {
      return Boolean(await convexUserHasClinicAccess(userId, clinicId))
    } catch (convexError) {
      console.error('[verify-clinic-access] Convex error:', convexError)
      return false
    }
  }

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
  // Under Convex authorization, skip the Supabase session-client RPC entirely
  // (it throws in convex-auth mode) and use the explicit-user Convex check.
  if (useConvexAuthorization()) {
    if (await verifyClinicAccess(userId, clinicId)) return null
    return new Response(
      JSON.stringify({ error: 'You do not have access to this clinic' }),
      { status: 403, headers: { 'content-type': 'application/json' } }
    )
  }

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
