import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

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
    if (body.is_active !== undefined) patch.is_active = !!body.is_active
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

    const { error } = await supabaseAdmin
      .from('clinics')
      .delete()
      .eq('id', params.id)
    if (error) {
      return NextResponse.json({ error: 'Failed to delete clinic', message: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/clinics/[id] error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

