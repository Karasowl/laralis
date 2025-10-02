import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { z } from 'zod';

const patientSourceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  icon: z.string().optional().nullable(),
  is_active: z.boolean().optional()
});

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const searchParams = request.nextUrl.searchParams;
    const clinicContext = await resolveClinicContext({ requestedClinicId: searchParams.get('clinicId'), cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId } = clinicContext;
    const activeOnly = searchParams.get('active') === 'true';

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from('patient_sources')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('is_system', { ascending: false })
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching patient sources:', error);
      return NextResponse.json(
        { error: 'Failed to fetch patient sources', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Unexpected error in GET /api/patient-sources:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ requestedClinicId: body?.clinic_id, cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId } = clinicContext;

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    // Validate request body
    const validationResult = patientSourceSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          message: validationResult.error.errors.map(e => e.message).join(', ')
        },
        { status: 400 }
      );
    }

    const sourceData = {
      ...validationResult.data,
      clinic_id: clinicId,
      is_system: false // Las creadas por el usuario no son del sistema
    };

    const { data, error } = await supabaseAdmin
      .from('patient_sources')
      .insert(sourceData)
      .select()
      .single();

    if (error) {
      console.error('Error creating patient source:', error);
      
      // Check for duplicate name error
      if (error.code === '23505') {
        return NextResponse.json(
          { 
            error: 'Nombre duplicado', 
            message: 'Ya existe una vía con este nombre en esta clínica.' 
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to create patient source', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      data,
      message: 'Patient source created successfully'
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/patient-sources:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
