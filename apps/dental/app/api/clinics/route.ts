import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ApiResponse, Clinic } from '@/lib/types'
import { cookies } from 'next/headers'
import { setClinicIdCookie } from '@/lib/clinic'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getConvexDocumentByLegacyId, listConvexTable, convexUserHasClinicAccess } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'
import { getAccessibleWorkspaceIds, userCanAccessWorkspace } from '@/lib/workspace-access'

// QA route contract: @qa-context-route authenticated clinic list and active-clinic selection.
export const dynamic = 'force-dynamic'

const selectClinicSchema = z.object({
  clinicId: z.string().uuid(),
})

const workspaceQuerySchema = z.object({
  workspaceId: z.string().uuid().optional(),
})

export async function GET(request: Request) {
  try {
    const cookieStore = cookies()
    const { searchParams } = new URL(request.url)
    // searchParams.get() returns null when the param is missing, but
    // z.string().uuid().optional() only accepts undefined. Coerce here
    // so that calling /api/clinics without any query string (the default
    // path used by useCurrentClinic) doesn't fail validation with
    // "Invalid payload".
    const workspaceId = searchParams.get('workspaceId') ?? undefined
    const queryValidation = validateSchema(workspaceQuerySchema, { workspaceId })
    if ('error' in queryValidation) {
      return queryValidation.error
    }

    const { user, error: authError } = await getCurrentUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json<ApiResponse<Clinic[]>>({
        error: 'Unauthorized',
        message: 'User not authenticated'
      }, { status: 401 })
    }

    // Obtener workspaces válidos
    let workspaceIds: string[] = []
    if (workspaceId) {
      const canAccessWorkspace = await userCanAccessWorkspace(user.id, workspaceId)
      if (!canAccessWorkspace) {
        return NextResponse.json<ApiResponse<Clinic[]>>({
          error: 'Workspace not found or unauthorized'
        }, { status: 404 })
      }
      workspaceIds = [workspaceId]
    } else {
      workspaceIds = await getAccessibleWorkspaceIds(user.id)

      if (workspaceIds.length === 0) {
        return NextResponse.json<ApiResponse<Clinic[]>>({ data: [] })
      }
    }

    const data = await readClinicsByWorkspaceIds(workspaceIds)

    return NextResponse.json<ApiResponse<Clinic[]>>({ data: data || [] })
  } catch (error) {
    console.error('Unexpected error fetching clinics:', error)
    return NextResponse.json<ApiResponse<Clinic[]>>({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// POST endpoint to set the selected clinic (context)
export async function POST(request: Request) {
  try {
    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const parsed = validateSchema(selectClinicSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const { clinicId } = parsed.data

    const cookieStore = cookies()
    const { user, error: authError } = await getCurrentUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>({
        error: 'Unauthorized'
      }, { status: 401 })
    }

    const { data: hasAccess, error: accessError } = await userCanSelectClinic(user.id, clinicId)

    if (accessError) {
      console.error('Error validating clinic access:', accessError)
      return NextResponse.json<ApiResponse<null>>({
        error: 'Failed to validate clinic access',
        message: accessError.message
      }, { status: 500 })
    }

    if (!hasAccess) {
      return NextResponse.json<ApiResponse<null>>({
        error: 'Access denied to clinic'
      }, { status: 403 })
    }

    const { clinic: selectedClinic, error: selectedClinicError } = await readClinicById(clinicId)

    if (selectedClinicError || !selectedClinic?.workspace_id) {
      return NextResponse.json<ApiResponse<null>>({
        error: 'Failed to resolve clinic workspace',
        message: selectedClinicError?.message
      }, { status: 500 })
    }

    setClinicIdCookie(clinicId, cookieStore)
    cookieStore.set('workspaceId', selectedClinic.workspace_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    return NextResponse.json<ApiResponse<null>>({
      message: 'Clinic selected successfully'
    })
  } catch (error) {
    console.error('Error setting clinic:', error)
    return NextResponse.json<ApiResponse<null>>({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

async function readClinicsByWorkspaceIds(workspaceIds: string[]) {
  if (workspaceIds.length === 0) return [] as Clinic[]

  if (shouldReturnConvexData('clinics')) {
    const workspaceIdSet = new Set(workspaceIds)
    const rows = await listConvexTable('clinics', 10000) as Array<Record<string, any>>
    return rows
      .filter((clinic) => workspaceIdSet.has(String(clinic.workspace_id)))
      .filter((clinic) => clinic.is_active !== false)
      .map(stripConvexMetadata)
      .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''))) as Clinic[]
  }

  const { data, error } = await supabaseAdmin
    .from('clinics')
    .select('*')
    .in('workspace_id', workspaceIds)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching clinics:', error)
    throw error
  }

  return (data || []) as Clinic[]
}

async function readClinicById(clinicId: string) {
  if (shouldReturnConvexData('clinics')) {
    const clinic = await getConvexDocumentByLegacyId('clinics', clinicId) as Record<string, any> | null
    return { clinic: clinic ? stripConvexMetadata(clinic) : null, error: null }
  }

  const { data, error } = await supabaseAdmin
    .from('clinics')
    .select('workspace_id')
    .eq('id', clinicId)
    .maybeSingle()

  return { clinic: data, error }
}

async function userCanSelectClinic(userId: string, clinicId: string) {
  if (shouldReturnConvexData('clinics')) {
    // convexUserHasClinicAccess replicates is_clinic_member exactly (direct
    // clinic_users membership OR workspace_users honoring allowed_clinics),
    // matching the user_has_clinic_access RPC byte-for-byte.
    const allowed = await convexUserHasClinicAccess(userId, clinicId)
    return { data: Boolean(allowed), error: null }
  }

  const supabase = createClient()
  return supabase.rpc('user_has_clinic_access', { clinic_id: clinicId })
}

function stripConvexMetadata(row: Record<string, any>) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}



