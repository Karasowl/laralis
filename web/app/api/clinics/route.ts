import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ApiResponse, Clinic } from '@/lib/types'
import { cookies } from 'next/headers'
import { setClinicIdCookie } from '@/lib/clinic'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: Request) {
  try {
    const cookieStore = cookies()
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    // Crear cliente de Supabase para el servidor con el usuario autenticado
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

    // Obtener el usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json<ApiResponse<Clinic[]>>({
        error: 'Unauthorized',
        message: 'User not authenticated'
      }, { status: 401 })
    }

    // Obtener workspaces válidos
    let workspaceIds: string[] = []
    if (workspaceId) {
      const { data: ws, error: wsErr } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('id', workspaceId)
        .eq('owner_id', user.id)
        .single()
      if (wsErr || !ws) {
        return NextResponse.json<ApiResponse<Clinic[]>>({
          error: 'Workspace not found or unauthorized'
        }, { status: 404 })
      }
      workspaceIds = [ws.id]
    } else {
      const { data: workspaces, error: wsError } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
      if (wsError) {
        console.error('Error fetching workspaces:', wsError)
        return NextResponse.json<ApiResponse<Clinic[]>>({
          error: 'Failed to fetch workspaces',
          message: wsError.message
        }, { status: 500 })
      }
      if (!workspaces || workspaces.length === 0) {
        return NextResponse.json<ApiResponse<Clinic[]>>({ data: [] })
      }
      workspaceIds = workspaces.map(w => w.id)
    }

    // Obtener solo las clínicas de los workspaces válidos
    const { data, error } = await supabaseAdmin
      .from('clinics')
      .select('*')
      .in('workspace_id', workspaceIds)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching clinics:', error)
      return NextResponse.json<ApiResponse<Clinic[]>>({
        error: 'Failed to fetch clinics',
        message: error.message
      }, { status: 500 })
    }

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
    const { clinicId } = await request.json()

    if (!clinicId) {
      return NextResponse.json<ApiResponse<null>>({
        error: 'Clinic ID is required'
      }, { status: 400 })
    }

    // Verify the clinic exists
    const { data: clinic, error } = await supabaseAdmin
      .from('clinics')
      .select('id')
      .eq('id', clinicId)
      .single()

    if (error || !clinic) {
      return NextResponse.json<ApiResponse<null>>({
        error: 'Invalid clinic ID'
      }, { status: 400 })
    }

    // Set the cookie
    setClinicIdCookie(clinicId)

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

