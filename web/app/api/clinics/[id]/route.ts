import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'


async function ensureClinicOwnership(userId: string, clinicId: string) {
  // Load clinic to get workspace_id
  const { data: clinic, error: clinicErr } = await supabaseAdmin
    .from('clinics')
    .select('id, workspace_id')
    .eq('id', clinicId)
    .single()
  if (clinicErr || !clinic) return { ok: false, status: 404 as const }

  // Verify workspace belongs to user
  const { data: ws, error: wsErr } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .eq('id', clinic.workspace_id)
    .eq('owner_id', userId)
    .single()
  if (wsErr || !ws) return { ok: false, status: 403 as const }

  return { ok: true as const }
}

export async function PUT(
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

    const guard = await ensureClinicOwnership(user.id, params.id)
    if (!guard.ok) {
      return NextResponse.json({ error: guard.status === 404 ? 'Clinic not found' : 'Forbidden' }, { status: guard.status })
    }

    const body = await request.json()
    const patch: any = {}
    if (body.name !== undefined) patch.name = body.name
    if (body.address !== undefined) patch.address = body.address || null
    if (body.phone !== undefined) patch.phone = body.phone || null
    if (body.email !== undefined) patch.email = body.email || null
    if (body.currency !== undefined) patch.currency = body.currency || 'MXN'
    if (body.locale !== undefined) patch.locale = body.locale || 'es-MX'
    if (body.is_active !== undefined) patch.is_active = !!body.is_active
    if (body.auto_complete_appointments !== undefined) patch.auto_complete_appointments = !!body.auto_complete_appointments
    patch.updated_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('clinics')
      .update(patch)
      .eq('id', params.id)
      .select('*')
      .single()
    if (error) {
      return NextResponse.json({ error: 'Failed to update clinic', message: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e) {
    console.error('PUT /api/clinics/[id] error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
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

    const guard = await ensureClinicOwnership(user.id, params.id)
    if (!guard.ok) {
      return NextResponse.json({ error: guard.status === 404 ? 'Clinic not found' : 'Forbidden' }, { status: guard.status })
    }

    // Get the clinic to find its workspace
    const { data: clinic, error: clinicErr } = await supabaseAdmin
      .from('clinics')
      .select('id, workspace_id')
      .eq('id', params.id)
      .single()

    if (clinicErr || !clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    // Count how many clinics are in this workspace
    const { count: clinicsInWorkspace, error: countErr } = await supabaseAdmin
      .from('clinics')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', clinic.workspace_id)

    if (countErr) {
      return NextResponse.json({ error: 'Failed to count clinics', message: countErr.message }, { status: 500 })
    }

    // Check if there are other workspaces with clinics for this user
    const { data: otherWorkspaces, error: wsErr } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .neq('id', clinic.workspace_id)

    if (wsErr) {
      return NextResponse.json({ error: 'Failed to check workspaces', message: wsErr.message }, { status: 500 })
    }

    let hasOtherWorkspacesWithClinics = false
    if (otherWorkspaces && otherWorkspaces.length > 0) {
      for (const ws of otherWorkspaces) {
        const { count, error: otherCountErr } = await supabaseAdmin
          .from('clinics')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', ws.id)

        if (!otherCountErr && count && count > 0) {
          hasOtherWorkspacesWithClinics = true
          break
        }
      }
    }

    // Business rule: Cannot delete the last clinic in a workspace unless there's another workspace with clinics
    if (clinicsInWorkspace === 1 && !hasOtherWorkspacesWithClinics) {
      return NextResponse.json({
        error: 'Cannot delete the last clinic. Create another clinic in a different workspace first.',
        code: 'LAST_CLINIC'
      }, { status: 400 })
    }

    // Delete the clinic (cascade will delete all related data)
    const { error } = await supabaseAdmin
      .from('clinics')
      .delete()
      .eq('id', params.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete clinic', message: error.message }, { status: 500 })
    }

    // If the deleted clinic was the current one, clear cookies
    const currentClinicId = cookieStore.get('clinicId')?.value
    if (currentClinicId === params.id) {
      const response = NextResponse.json({ success: true })
      response.cookies.delete('clinicId')
      return response
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/clinics/[id] error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

