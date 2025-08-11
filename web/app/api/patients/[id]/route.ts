import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { z } from 'zod';

const updatePatientSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional(),
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

    // Validate request body
    const validationResult = updatePatientSchema.safeParse(body);
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