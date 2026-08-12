import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { getConvexDocumentByLegacyId, patchConvexDocumentByLegacyId } from '@/lib/convex/server'
import { shouldUseConvexOnlyWritePath } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

async function ensureClinicExistsConvex(clinicId: string) {
  const row = await getConvexDocumentByLegacyId('clinics', clinicId) as ImportedRecord | null
  if (!row) return null
  return { id: row.id ?? row.legacyId ?? clinicId, workspace_id: row.workspace_id ?? row.workspaceId }
}

const updateClinicSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().or(z.literal('')).optional(),
  currency: z.string().min(2).max(10).optional(),
  locale: z.string().min(2).optional(),
  is_active: z.boolean().optional(),
  auto_complete_appointments: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
})

async function ensureClinicExists(clinicId: string) {
  const { data: clinic, error: clinicErr } = await supabaseAdmin
    .from('clinics')
    .select('id, workspace_id')
    .eq('id', clinicId)
    .single()
  if (clinicErr || !clinic) return null

  return clinic
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const convexOnly = shouldUseConvexOnlyWritePath('clinics')

    if (!(convexOnly ? await ensureClinicExistsConvex(params.id) : await ensureClinicExists(params.id))) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const forbidden = await forbiddenIfMissingPermission(user.id, params.id, 'settings.edit')
    if (forbidden) return forbidden

    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const parsed = validateSchema(updateClinicSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const body = parsed.data
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

    if (convexOnly) {
      const current = normalizeConvexRecord(
        await getConvexDocumentByLegacyId('clinics', params.id) as ImportedRecord | null
      )
      await patchConvexDocumentByLegacyId('clinics', params.id, patch)
      return NextResponse.json({ data: { ...(current ?? {}), id: params.id, ...patch } })
    }

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
    const supabase = createClient(cookieStore)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existingClinic = await ensureClinicExists(params.id)
    if (!existingClinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const forbidden = await forbiddenIfMissingPermission(user.id, params.id, 'settings.edit')
    if (forbidden) return forbidden

    const clinic = existingClinic

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

    // NOTE (convex decommission): DELETE intentionally has NO convex-only write branch.
    // The Supabase delete below relies on Postgres ON DELETE CASCADE to remove every row
    // related to the clinic across many tables (patients, treatments, services, supplies,
    // expenses, fixed_costs, memberships, etc.). Convex has no FK cascade, so
    // deleteConvexDocumentByLegacyId('clinics', id) would delete only the clinic document
    // and orphan all related data. Replicating the full multi-table cascade safely is a
    // shared change (a dedicated Convex mutation that enumerates and deletes every child
    // table for the clinic), not something to inline here. Until that exists, clinic
    // deletion must stay on the Supabase write path.

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
