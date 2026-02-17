import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const campaignPatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    code: z.string().nullable().optional(),
    platform_id: z.string().uuid().optional(),
    is_active: z.boolean().optional(),
    is_archived: z.boolean().optional(),
    archived_at: z.string().nullable().optional(),
    reactivated_at: z.string().nullable().optional(),
  })
  .passthrough()


// GET /api/marketing/campaigns/[id] - Get a specific campaign
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = supabaseAdmin
    const cookieStore = cookies()
    const clinicId = cookieStore.get('clinicId')?.value

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic selected' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching campaign:', error)
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error in GET campaign:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/marketing/campaigns/[id] - Update a campaign (including archive/unarchive)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = supabaseAdmin
    const cookieStore = cookies()
    const clinicId = cookieStore.get('clinicId')?.value

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic selected' },
        { status: 400 }
      )
    }

    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const parsed = validateSchema(campaignPatchSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const body = parsed.data

    // Normalize archive toggling: if archived_at provided, set is_archived accordingly
    const nowIso = new Date().toISOString()
    const patch: any = { ...body, updated_at: nowIso }
    if (Object.prototype.hasOwnProperty.call(body, 'archived_at')) {
      const arch = body.archived_at
      patch.archived_at = arch
      patch.is_archived = !!arch
      if (!arch) {
        // Unarchive
        patch.reactivated_at = nowIso
      }
    }

    // Update the campaign
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .update(patch)
      .eq('id', params.id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating campaign:', error)
      return NextResponse.json(
        { error: 'Failed to update campaign' },
        { status: 400 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error in PATCH campaign:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/marketing/campaigns/[id] - Delete a campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = supabaseAdmin
    const cookieStore = cookies()
    const clinicId = cookieStore.get('clinicId')?.value

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic selected' },
        { status: 400 }
      )
    }

    // Check if campaign has any associated patients
    const { data: patients } = await supabase
      .from('patients')
      .select('id')
      .eq('campaign_id', params.id)
      .limit(1)

    if (patients && patients.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete campaign with associated patients' },
        { status: 400 }
      )
    }

    // Delete the campaign
    const { error } = await supabase
      .from('marketing_campaigns')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting campaign:', error)
      return NextResponse.json(
        { error: 'Failed to delete campaign' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE campaign:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
