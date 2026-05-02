import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const createClinicSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().or(z.literal('')).optional(),
  currency: z.string().min(2).max(10).optional(),
  locale: z.string().min(2).optional(),
})

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

    // Verify workspace belongs to current user
    const { data: ws, error: wsErr } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('id', params.id)
      .eq('owner_id', user.id)
      .single()

    if (wsErr || !ws) {
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

    // Verify workspace belongs to current user
    const { data: ws, error: wsErr } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('id', params.id)
      .eq('owner_id', user.id)
      .single()

    if (wsErr || !ws) {
      return NextResponse.json({ error: 'Workspace not found or unauthorized' }, { status: 404 })
    }

    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const parsed = validateSchema(createClinicSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const { name, address, phone, email, currency, locale } = parsed.data

    const { data, error } = await supabaseAdmin
      .from('clinics')
      .insert({
        workspace_id: params.id,
        name,
        address: address || null,
        phone: phone || null,
        email: email || null,
        currency: currency || 'MXN',
        locale: locale || 'es-MX',
        is_active: true,
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create clinic', message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (e) {
    console.error('POST /api/workspaces/[id]/clinics error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

