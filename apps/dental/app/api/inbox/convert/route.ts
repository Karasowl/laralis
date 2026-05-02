import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withAllPermissions } from '@/lib/middleware/with-permission'
import { readJson, validateSchema } from '@/lib/validation'

const schema = z.object({
  conversationId: z.string().uuid(),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(4).max(40).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

/**
 * Promote a lead to a patient and link the conversation to that patient.
 * Idempotent: if the lead is already converted we return the existing
 * patient instead of duplicating it.
 */
export const POST = withAllPermissions(
  ['inbox.view', 'patients.create'],
  async (request, context) => {
    const bodyResult = await readJson(request)
    if ('error' in bodyResult) return bodyResult.error
    const parsed = validateSchema(schema, bodyResult.data, 'Invalid payload')
    if ('error' in parsed) return parsed.error

    const { conversationId, firstName, lastName, email, phone, notes } = parsed.data
    const { clinicId } = context

    const { data: conversation, error: convError } = await supabaseAdmin
      .from('inbox_conversations')
      .select('id, clinic_id, lead_id, patient_id, contact_address, contact_name, campaign_id')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    if (conversation.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (conversation.patient_id) {
      const { data: existingPatient } = await supabaseAdmin
        .from('patients')
        .select('id, first_name, last_name, phone, email')
        .eq('id', conversation.patient_id)
        .maybeSingle()
      return NextResponse.json({
        data: { patient: existingPatient, conversation, alreadyLinked: true },
      })
    }

    let lead: {
      id: string
      phone: string | null
      email: string | null
      full_name: string | null
      campaign_id: string | null
      source_id: string | null
    } | null = null
    if (conversation.lead_id) {
      const { data: leadRow } = await supabaseAdmin
        .from('leads')
        .select('id, phone, email, full_name, converted_patient_id, campaign_id, source_id')
        .eq('id', conversation.lead_id)
        .maybeSingle()
      lead = leadRow
        ? {
            id: leadRow.id,
            phone: leadRow.phone,
            email: leadRow.email,
            full_name: leadRow.full_name,
            campaign_id: leadRow.campaign_id,
            source_id: leadRow.source_id,
          }
        : null

      if (leadRow?.converted_patient_id) {
        await supabaseAdmin
          .from('inbox_conversations')
          .update({ patient_id: leadRow.converted_patient_id })
          .eq('id', conversationId)

        const { data: patientRow } = await supabaseAdmin
          .from('patients')
          .select('id, first_name, last_name, phone, email')
          .eq('id', leadRow.converted_patient_id)
          .maybeSingle()

        return NextResponse.json({
          data: { patient: patientRow, conversation, alreadyLinked: true },
        })
      }
    }

    const finalPhone = phone || lead?.phone || null
    const finalEmail = email || lead?.email || null
    const campaignId = lead?.campaign_id || conversation.campaign_id || null
    const sourceId = lead?.source_id || null

    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .insert({
        clinic_id: clinicId,
        first_name: firstName,
        last_name: lastName || null,
        email: finalEmail,
        phone: finalPhone,
        notes: notes || null,
        ...(campaignId ? { campaign_id: campaignId } : {}),
        ...(sourceId ? { source_id: sourceId } : {}),
        first_visit_date: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single()

    if (patientError || !patient) {
      return NextResponse.json(
        {
          error: 'Failed to create patient',
          message: patientError?.message,
        },
        { status: 500 }
      )
    }

    if (lead?.id) {
      await supabaseAdmin
        .from('leads')
        .update({
          status: 'converted',
          converted_patient_id: patient.id,
          converted_at: new Date().toISOString(),
        })
        .eq('id', lead.id)
    }

    await supabaseAdmin
      .from('inbox_conversations')
      .update({ patient_id: patient.id })
      .eq('id', conversationId)

    return NextResponse.json({
      data: { patient, conversation, alreadyLinked: false },
    })
  }
)
