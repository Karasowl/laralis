import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { z } from 'zod';

export const dynamic = 'force-dynamic'


const updatePatientSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  email: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
  phone: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  first_visit_date: z.string().optional().nullable(),
  gender: z.union([z.enum(['male', 'female', 'other']), z.literal(''), z.null()]).optional(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional(),
  source_id: z.string().optional().nullable(),
  referred_by_patient_id: z.string().optional().nullable(),
  campaign_id: z.string().optional().nullable(),
  acquisition_date: z.string().optional().nullable()
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('patients')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Patient not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching patient:', error);
      return NextResponse.json(
        { error: 'Failed to fetch patient', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Unexpected error in GET /api/patients/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // Clean empty strings from body - similar to POST
    const cleanedBody = {
      ...(body.first_name && { first_name: body.first_name }),
      ...(body.last_name && { last_name: body.last_name }),
      ...(body.email && body.email.trim() && { email: body.email.trim() }),
      ...(body.phone && { phone: body.phone }),
      ...(body.birth_date && { birth_date: body.birth_date }),
      ...(body.first_visit_date && { first_visit_date: body.first_visit_date }),
      ...(body.gender && { gender: body.gender }),
      ...(body.address && { address: body.address }),
      ...(body.city && { city: body.city }),
      ...(body.postal_code && { postal_code: body.postal_code }),
      ...(body.notes && { notes: body.notes }),
      ...(body.active !== undefined && { active: body.active }),
      ...(body.source_id && { source_id: body.source_id }),
      ...(body.referred_by_patient_id && { referred_by_patient_id: body.referred_by_patient_id }),
      ...(body.campaign_id && { campaign_id: body.campaign_id }),
      ...(
        (body.acquisition_date || body.first_visit_date)
          ? { acquisition_date: (body.acquisition_date || body.first_visit_date) }
          : {}
      )
    };

    // Validate request body
    const validationResult = updatePatientSchema.safeParse(cleanedBody);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          message: validationResult.error.errors.map(e => e.message).join(', ')
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('patients')
      .update({
        ...validationResult.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating patient:', error);
      return NextResponse.json(
        { error: 'Failed to update patient', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      data,
      message: 'Patient updated successfully'
    });
  } catch (error) {
    console.error('Unexpected error in PUT /api/patients/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    try {
      const { data: treatmentUsage, error: treatmentError } = await supabaseAdmin
        .from('treatments')
        .select(
          'id, treatment_date, services:services!treatments_service_id_fkey(name)'
        )
        .eq('patient_id', params.id)
        .limit(5)

      if (treatmentError) {
        console.error('[patients DELETE] Unable to check treatment usage:', treatmentError)
      } else if (treatmentUsage && treatmentUsage.length > 0) {
        const serviceNames = treatmentUsage
          .map((row: any) => row?.services?.name)
          .filter(Boolean) as string[]
        const listed = serviceNames.slice(0, 3).join(', ')
        const remaining = Math.max(0, serviceNames.length - 3)
        return NextResponse.json(
          {
            error: 'patient_in_use',
            message: serviceNames.length > 0
              ? `No puedes eliminar este paciente porque tiene ${serviceNames.length} tratamiento(s) registrados (${listed}${remaining > 0 ? ` y ${remaining} más` : ''}). Elimina o reasigna esos tratamientos primero.`
              : 'No puedes eliminar este paciente porque tiene tratamientos registrados.'
          },
          { status: 409 }
        )
      }
    } catch (err) {
      console.error('[patients DELETE] Unexpected usage check error:', err)
    }

    const { error } = await supabaseAdmin
      .from('patients')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting patient:', error);
      return NextResponse.json(
        { error: 'Failed to delete patient', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: 'Patient deleted successfully'
    });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/patients/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
