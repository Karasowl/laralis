import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';
import { z } from 'zod';

const patientSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
  phone: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  first_visit_date: z.string().optional().nullable(),
  gender: z.union([z.enum(['male', 'female', 'other']), z.literal(''), z.null()]).optional(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const searchParams = request.nextUrl.searchParams;
    const clinicId = searchParams.get('clinicId') || await getClinicIdOrDefault(cookieStore);
    const search = searchParams.get('search');

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from('patients')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });

    // Add search filter if provided
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching patients:', error);
      return NextResponse.json(
        { error: 'Failed to fetch patients', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Unexpected error in GET /api/patients:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST /api/patients - Body received:', body);
    
    const cookieStore = cookies();
    const clinicId = await getClinicIdOrDefault(cookieStore);
    console.log('POST /api/patients - Clinic ID:', clinicId);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    // Clean empty strings from body
    // IMPORTANT: Don't set email to null if empty, leave it undefined to avoid unique constraint issues
    const cleanedBody = {
      first_name: body.first_name,
      last_name: body.last_name,
      ...(body.email && body.email.trim() && { email: body.email.trim() }),
      ...(body.phone && { phone: body.phone }),
      ...(body.birth_date && { birth_date: body.birth_date }),
      ...(body.first_visit_date && { first_visit_date: body.first_visit_date }),
      ...(body.gender && { gender: body.gender }),
      ...(body.address && { address: body.address }),
      ...(body.city && { city: body.city }),
      ...(body.postal_code && { postal_code: body.postal_code }),
      ...(body.notes && { notes: body.notes })
    };

    // Validate request body
    const validationResult = patientSchema.safeParse(cleanedBody);
    if (!validationResult.success) {
      console.error('Validation errors:', validationResult.error.errors);
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          message: validationResult.error.errors.map(e => e.message).join(', ')
        },
        { status: 400 }
      );
    }

    const patientData = {
      ...validationResult.data,
      clinic_id: clinicId,
    };

    const { data, error } = await supabaseAdmin
      .from('patients')
      .insert(patientData)
      .select()
      .single();

    if (error) {
      console.error('Error creating patient - Full error:', JSON.stringify(error, null, 2));
      console.error('Error message:', error.message);
      console.error('Patient data attempted:', patientData);
      
      // Check for duplicate email error
      if (error.code === '23505' && error.message.includes('patients_clinic_id_email_key')) {
        return NextResponse.json(
          { 
            error: 'Email duplicado', 
            message: 'Ya existe un paciente registrado con este email en esta clínica. Puedes dejar el email vacío o usar uno diferente.' 
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to create patient', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      data,
      message: 'Patient created successfully'
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/patients:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}