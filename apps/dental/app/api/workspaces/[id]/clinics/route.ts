import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'
import {
  forbiddenIfMissingWorkspacePermission,
  userCanAccessWorkspace,
} from '@/lib/workspace-access'
import {
  listConvexDocumentsByWorkspace,
  upsertConvexDocumentByLegacyId,
  patchConvexDocumentByLegacyId,
} from '@/lib/convex/server'
import {
  shouldReturnConvexData,
  shouldUseConvexOnlyWritePath,
  shouldWriteConvexData,
} from '@/lib/data-backend'
import { seedClinicDefaultsInConvex } from '@/lib/convex/clinic-seed'

export const dynamic = 'force-dynamic'

type ConvexRecord = Record<string, any>

function normalizeConvexRecord(row: ConvexRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

const createClinicSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().or(z.literal('')).optional(),
  currency: z.string().min(2).max(10).optional(),
  locale: z.string().min(2).optional(),
})

const PRIVILEGED_WORKSPACE_ROLES = new Set(['owner', 'admin', 'super_admin'])

function nextAllowedClinics(current: unknown, clinicId: string) {
  if (!Array.isArray(current) || current.length === 0) return null
  const ids = current.filter((value): value is string => typeof value === 'string')
  return ids.includes(clinicId) ? ids : [...ids, clinicId]
}

/**
 * Convex-only port of the POST handler's multi-table write. Replicates every
 * Supabase write the Supabase path performs, in the same order:
 *   1. INSERT clinics            -> upsert clinics
 *   2. seedClinicDefaultsInConvex (after_clinic_insert triggers)
 *   3. read privileged workspace_users -> UPDATE allowed_clinics + INSERT clinic_users
 *   4. read privileged workspace_members -> UPDATE allowed_clinics / clinic_ids
 * The DB-generated columns (id, created_at, updated_at) are stamped here since
 * Postgres is unreachable on this path. Returns the same `{ data }` shape/status
 * the Supabase branch returns (the inserted clinic row).
 */
async function createClinicInConvex(
  workspaceId: string,
  input: { name: string; address?: string; phone?: string; email?: string }
) {
  const now = new Date().toISOString()
  const clinicId = crypto.randomUUID()

  // 1. clinics insert — mirror EXACTLY the Supabase insert columns + DB defaults.
  const clinicRow = {
    id: clinicId,
    workspace_id: workspaceId,
    name: input.name,
    address: input.address || null,
    phone: input.phone || null,
    email: input.email || null,
    is_active: true,
    created_at: now,
    updated_at: now,
  }
  await upsertConvexDocumentByLegacyId('clinics', clinicId, clinicRow)

  // 2. Seed clinic defaults (patient_sources / custom_categories / whatsapp_templates).
  await seedClinicDefaultsInConvex(clinicId)

  // 3. workspace_users: grant privileged members access + admin clinic membership.
  const workspaceUsers = (await listConvexDocumentsByWorkspace(
    'workspace_users',
    workspaceId
  )) as ConvexRecord[]
  const privilegedUsers = workspaceUsers.filter(
    (member) =>
      member?.is_active === true && PRIVILEGED_WORKSPACE_ROLES.has(String(member.role))
  )

  for (const member of privilegedUsers) {
    const allowedClinics = nextAllowedClinics(member.allowed_clinics, clinicId)
    if (allowedClinics) {
      await patchConvexDocumentByLegacyId('workspace_users', String(member.id), {
        allowed_clinics: allowedClinics,
      })
    }

    const clinicUserId = crypto.randomUUID()
    await upsertConvexDocumentByLegacyId('clinic_users', clinicUserId, {
      id: clinicUserId,
      clinic_id: clinicId,
      user_id: member.user_id,
      role: 'admin',
      custom_permissions: {},
      custom_role_id: null,
      is_active: true,
      joined_at: now,
      can_access_all_patients: true,
      assigned_chair: null,
      schedule: {},
    })
  }

  // 4. workspace_members: grant privileged members access (legacy membership table).
  const workspaceMembers = (await listConvexDocumentsByWorkspace(
    'workspace_members',
    workspaceId
  )) as ConvexRecord[]

  for (const member of workspaceMembers) {
    if (member?.is_active !== true) continue
    if (!PRIVILEGED_WORKSPACE_ROLES.has(String(member.role))) continue

    const patch: Record<string, string[]> = {}
    const allowedClinics = nextAllowedClinics(member.allowed_clinics, clinicId)
    const clinicIds = nextAllowedClinics(member.clinic_ids, clinicId)
    if (allowedClinics) patch.allowed_clinics = allowedClinics
    if (clinicIds) patch.clinic_ids = clinicIds
    if (Object.keys(patch).length === 0) continue

    await patchConvexDocumentByLegacyId('workspace_members', String(member.id), patch)
  }

  return NextResponse.json({ data: clinicRow })
}

// GET /api/workspaces/[id]/clinics - list clinics for a workspace owned by the user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canAccessWorkspace = await userCanAccessWorkspace(user.id, params.id)
    if (!canAccessWorkspace) {
      return NextResponse.json({ error: 'Workspace not found or unauthorized' }, { status: 404 })
    }

    // Convex read branch (flag-gated). Guarded by getUser() + userCanAccessWorkspace
    // above, since the Convex bridge has no RLS. clinics is keyed by workspace_id
    // (NO clinic_id column) so scope by workspace, not by clinic.
    if (shouldReturnConvexData('clinics')) {
      const rows = await listConvexDocumentsByWorkspace('clinics', params.id, 10000) as ConvexRecord[]
      const data = rows
        .map(normalizeConvexRecord)
        .sort((left, right) =>
          String(left.name || '').localeCompare(String(right.name || ''))
        )
      return NextResponse.json({ data: data || [] })
    }

    const { data, error } = await supabaseAdmin
      .from('clinics')
      .select('*')
      .eq('workspace_id', params.id)
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch clinics', message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (e) {
    console.error('GET /api/workspaces/[id]/clinics error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/workspaces/[id]/clinics - create clinic inside workspace
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canAccessWorkspace = await userCanAccessWorkspace(user.id, params.id)
    if (!canAccessWorkspace) {
      return NextResponse.json({ error: 'Workspace not found or unauthorized' }, { status: 404 })
    }

    const forbidden = await forbiddenIfMissingWorkspacePermission(user.id, params.id, 'settings.edit')
    if (forbidden) return forbidden

    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const parsed = validateSchema(createClinicSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const { name, address, phone, email } = parsed.data

    // Convex-only write path (DATA_WRITE_MODE=convex): Supabase is unreachable, so
    // replicate every Supabase write of this multi-table handler against Convex
    // BEFORE touching supabaseAdmin. Auth/permission guards above are convex-aware.
    if (shouldUseConvexOnlyWritePath('clinics')) {
      return await createClinicInConvex(params.id, { name, address, phone, email })
    }

    const { data, error } = await supabaseAdmin
      .from('clinics')
      .insert({
        workspace_id: params.id,
        name,
        address: address || null,
        phone: phone || null,
        email: email || null,
        is_active: true,
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create clinic', message: error.message }, { status: 500 })
    }

    // Seed clinic defaults into Convex (port of the after_clinic_insert triggers).
    // Idempotent + best-effort; default Supabase => no-op (clinic row mirrors via
    // the wrapped supabaseAdmin client).
    if (shouldWriteConvexData('clinics')) {
      await seedClinicDefaultsInConvex(data.id)
    }

    const { data: workspaceUsers, error: workspaceUsersError } = await supabaseAdmin
      .from('workspace_users')
      .select('id, user_id, role, allowed_clinics')
      .eq('workspace_id', params.id)
      .eq('is_active', true)

    if (workspaceUsersError) {
      return NextResponse.json({ error: 'Failed to resolve workspace members', message: workspaceUsersError.message }, { status: 500 })
    }

    const privilegedUsers = (workspaceUsers || []).filter((member) =>
      PRIVILEGED_WORKSPACE_ROLES.has(String(member.role))
    )

    for (const member of privilegedUsers) {
      const allowedClinics = nextAllowedClinics(member.allowed_clinics, data.id)
      if (allowedClinics) {
        const { error: updateAllowedError } = await supabaseAdmin
          .from('workspace_users')
          .update({ allowed_clinics: allowedClinics })
          .eq('id', member.id)

        if (updateAllowedError) {
          return NextResponse.json({ error: 'Failed to grant new clinic access', message: updateAllowedError.message }, { status: 500 })
        }
      }

      const { error: clinicUserError } = await supabaseAdmin
        .from('clinic_users')
        .insert({
          clinic_id: data.id,
          user_id: member.user_id,
          role: 'admin',
          custom_permissions: {},
          custom_role_id: null,
          is_active: true,
          joined_at: new Date().toISOString(),
          can_access_all_patients: true,
          assigned_chair: null,
          schedule: {},
        })

      if (clinicUserError) {
        return NextResponse.json({ error: 'Failed to create clinic admin membership', message: clinicUserError.message }, { status: 500 })
      }
    }

    const { data: workspaceMembers } = await supabaseAdmin
      .from('workspace_members')
      .select('id, role, allowed_clinics, clinic_ids')
      .eq('workspace_id', params.id)
      .eq('is_active', true)

    for (const member of workspaceMembers || []) {
      if (!PRIVILEGED_WORKSPACE_ROLES.has(String(member.role))) continue

      const patch: Record<string, string[]> = {}
      const allowedClinics = nextAllowedClinics(member.allowed_clinics, data.id)
      const clinicIds = nextAllowedClinics(member.clinic_ids, data.id)
      if (allowedClinics) patch.allowed_clinics = allowedClinics
      if (clinicIds) patch.clinic_ids = clinicIds
      if (Object.keys(patch).length === 0) continue

      await supabaseAdmin
        .from('workspace_members')
        .update(patch)
        .eq('id', member.id)
    }

    return NextResponse.json({ data })
  } catch (e) {
    console.error('POST /api/workspaces/[id]/clinics error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

