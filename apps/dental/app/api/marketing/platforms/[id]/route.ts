import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { readJson } from '@/lib/validation'

export const dynamic = 'force-dynamic'


// Proxy for update/delete using a dynamic route, to match client calls like
// fetch('/api/marketing/platforms/:id', { method: 'PUT' | 'DELETE' })

export async function PUT(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const bodyResult = await readJson(_req)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const body = bodyResult.data
    const cookieStore = cookies()
    const clinicContext = await resolveClinicContext({ requestedClinicId: body?.clinic_id, cookieStore })
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status })
    }
    const { clinicId, userId } = clinicContext
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'campaigns.edit')
    if (forbidden) return forbidden

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('categories')
      .select('id, clinic_id')
      .eq('id', id)
      .eq('entity_type', 'marketing_platform')
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: 'Failed to fetch marketing platform', message: existingError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 })
    }
    if (!existing.clinic_id) {
      return NextResponse.json({ error: 'System platforms are read-only' }, { status: 403 })
    }
    if (existing.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const patch: any = {}
    if (body.display_name !== undefined) patch.display_name = body.display_name
    if (body.is_active !== undefined) patch.is_active = body.is_active

    const { data, error } = await supabaseAdmin
      .from('categories')
      .update(patch)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update marketing platform', message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const cookieStore = cookies()
    const clinicContext = await resolveClinicContext({ cookieStore })
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status })
    }
    const { clinicId, userId } = clinicContext
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'campaigns.delete')
    if (forbidden) return forbidden

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('categories')
      .select('id, clinic_id')
      .eq('id', id)
      .eq('entity_type', 'marketing_platform')
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: 'Failed to fetch marketing platform', message: existingError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 })
    }
    if (!existing.clinic_id) {
      return NextResponse.json({ error: 'System platforms are read-only' }, { status: 403 })
    }
    if (existing.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('clinic_id', clinicId)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete marketing platform', message: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

