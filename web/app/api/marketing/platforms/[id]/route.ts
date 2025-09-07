import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(supabaseUrl, supabaseKey)
}

// GET /api/marketing/platforms/[id] - Get a specific platform
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient()
    const cookieStore = cookies()
    const clinicId = cookieStore.get('clinicId')?.value

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic selected' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('marketing_platforms')
      .select('*')
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .single()

    if (error) {
      console.error('Error fetching platform:', error)
      return NextResponse.json(
        { error: 'Platform not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error in GET platform:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/marketing/platforms/[id] - Update a platform
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient()
    const cookieStore = cookies()
    const clinicId = cookieStore.get('clinicId')?.value

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic selected' },
        { status: 400 }
      )
    }

    const body = await request.json()

    const { data, error } = await supabase
      .from('marketing_platforms')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .select()
      .single()

    if (error) {
      console.error('Error updating platform:', error)
      return NextResponse.json(
        { error: 'Failed to update platform' },
        { status: 400 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error in PATCH platform:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/marketing/platforms/[id] - Delete a platform
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient()
    const cookieStore = cookies()
    const clinicId = cookieStore.get('clinicId')?.value

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic selected' },
        { status: 400 }
      )
    }

    // First, check if platform has campaigns
    const { data: campaigns } = await supabase
      .from('marketing_campaigns')
      .select('id')
      .eq('platform_id', params.id)
      .limit(1)

    if (campaigns && campaigns.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete platform with existing campaigns' },
        { status: 400 }
      )
    }

    // Delete the platform
    const { error } = await supabase
      .from('marketing_platforms')
      .delete()
      .eq('id', params.id)
      .eq('clinic_id', clinicId)

    if (error) {
      console.error('Error deleting platform:', error)
      return NextResponse.json(
        { error: 'Failed to delete platform' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE platform:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}