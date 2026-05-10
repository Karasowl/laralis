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

export const dynamic = 'force-dynamic'

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

