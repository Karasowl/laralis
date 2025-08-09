import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zService, zServiceSupply } from '@/lib/zod';
import type { Service, ServiceSupply, ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<Service[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search');
    
    const cookieStore = cookies();
    const clinicId = searchParams.get('clinicId') || await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from('services')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name', { ascending: true });

    // Apply search filter
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching services:', error);
      return NextResponse.json(
        { error: 'Failed to fetch services', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Unexpected error in GET /api/services:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<Service>>> {
  try {
    const body = await request.json();
    const cookieStore = cookies();
    const clinicId = body.clinic_id || await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }
    
    // Extract supplies if provided
    const { supplies, ...serviceDataInput } = body;
    
    // Add clinic_id to body for validation
    const dataWithClinic = { ...serviceDataInput, clinic_id: clinicId };
    
    // Validate service data
    const validationResult = zService.safeParse(dataWithClinic);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          message: validationResult.error.errors.map(e => e.message).join(', ')
        },
        { status: 400 }
      );
    }

    const { clinic_id, name, est_minutes } = validationResult.data;

    // Start a transaction-like operation
    const { data: serviceData, error: serviceError } = await supabaseAdmin
      .from('services')
      .insert({ clinic_id, name, est_minutes })
      .select()
      .single();

    if (serviceError) {
      console.error('Error creating service:', serviceError);
      return NextResponse.json(
        { error: 'Failed to create service', message: serviceError.message },
        { status: 500 }
      );
    }

    // If supplies are provided, add them to the service
    if (supplies && Array.isArray(supplies) && supplies.length > 0) {
      const serviceSupplies = supplies.map((supply: any) => ({
        clinic_id,
        service_id: serviceData.id,
        supply_id: supply.supply_id,
        qty: supply.qty
      }));

      const { error: suppliesError } = await supabaseAdmin
        .from('service_supplies')
        .insert(serviceSupplies);

      if (suppliesError) {
        console.error('Error adding supplies to service:', suppliesError);
        // Consider rolling back the service creation here
      }
    }

    return NextResponse.json({ 
      data: serviceData,
      message: 'Service created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error in POST /api/services:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}