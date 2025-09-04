import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current workspace
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!workspaceMember) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Get clinic_id from query params
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinicId')

    // Build query (use simpler FK syntax to avoid FK-name coupling)
    let query = supabase
      .from('marketing_campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    // Filter by clinic if provided
    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
    }

    const { data: campaigns, error } = await query

    if (error) {
      console.error('Error fetching campaigns:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Keep response shape compatible with useApi (accepts {data} or raw)
    return NextResponse.json({ data: campaigns || [] })
  } catch (error) {
    console.error('Error in GET /api/campaigns:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate required fields
    if (!body.clinic_id || !body.name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create campaign
    const { data: campaign, error } = await supabase
      .from('marketing_campaigns')
      .insert({
        clinic_id: body.clinic_id,
        name: body.name,
        platform_category_id: body.platform_category_id || body.platform_id,
        budget_cents: body.budget_cents || 0,
        spent_cents: body.spent_cents || 0,
        start_date: body.start_date,
        end_date: body.end_date,
        status: body.status || 'draft',
        is_active: body.is_active !== false,
        notes: body.notes
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating campaign:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(campaign)
  } catch (error) {
    console.error('Error in POST /api/campaigns:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    if (!body.id) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      )
    }

    // Update campaign
    const { data: campaign, error } = await supabase
      .from('marketing_campaigns')
      .update({
        name: body.name,
        platform_category_id: body.platform_category_id || body.platform_id,
        budget_cents: body.budget_cents,
        spent_cents: body.spent_cents,
        start_date: body.start_date,
        end_date: body.end_date,
        status: body.status,
        is_active: body.is_active,
        is_archived: body.is_archived,
        notes: body.notes
      })
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating campaign:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(campaign)
  } catch (error) {
    console.error('Error in PATCH /api/campaigns:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      )
    }

    // Delete campaign
    const { error } = await supabase
      .from('marketing_campaigns')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting campaign:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/campaigns:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
