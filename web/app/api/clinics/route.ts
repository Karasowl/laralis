import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ApiResponse, Clinic } from '@/lib/types';
import { cookies } from 'next/headers';
import { setClinicIdCookie } from '@/lib/clinic';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('clinics')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching clinics:', error);
      return NextResponse.json<ApiResponse<Clinic[]>>({
        error: 'Failed to fetch clinics',
        message: error.message
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<Clinic[]>>({
      data: data || []
    });
  } catch (error) {
    console.error('Unexpected error fetching clinics:', error);
    return NextResponse.json<ApiResponse<Clinic[]>>({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// POST endpoint to set the selected clinic
export async function POST(request: Request) {
  try {
    const { clinicId } = await request.json();

    if (!clinicId) {
      return NextResponse.json<ApiResponse<null>>({
        error: 'Clinic ID is required'
      }, { status: 400 });
    }

    // Verify the clinic exists
    const { data: clinic, error } = await supabaseAdmin
      .from('clinics')
      .select('id')
      .eq('id', clinicId)
      .single();

    if (error || !clinic) {
      return NextResponse.json<ApiResponse<null>>({
        error: 'Invalid clinic ID'
      }, { status: 400 });
    }

    // Set the cookie
    setClinicIdCookie(clinicId);

    return NextResponse.json<ApiResponse<null>>({
      message: 'Clinic selected successfully'
    });
  } catch (error) {
    console.error('Error setting clinic:', error);
    return NextResponse.json<ApiResponse<null>>({
      error: 'Internal server error'
    }, { status: 500 });
  }
}