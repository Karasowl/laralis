import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zService } from '@/lib/zod';
import type { Service, ServiceSupply, ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(
  request: NextRequest, 
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Service & { supplies?: ServiceSupply[] }>>> {
  try {
    const cookieStore = cookies();
    const clinicId = await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    // Get service with its supplies
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .single();

    if (serviceError) {
      if (serviceError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Service not found' },
          { status: 404 }
        );
      }
      
      console.error('Error fetching service:', serviceError);
      return NextResponse.json(
        { error: 'Failed to fetch service', message: serviceError.message },
        { status: 500 }
      );
    }

    // Get service supplies with supply details
    const { data: supplies, error: suppliesError } = await supabaseAdmin
      .from('service_supplies')
      .select('*, supplies(*)')
      .eq('service_id', params.id)
      .eq('clinic_id', clinicId);

    if (suppliesError) {
      console.error('Error fetching service supplies:', suppliesError);
    }

    return NextResponse.json({ 
      data: {
        ...service,
        supplies: supplies || []
      }
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/services/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest, 
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Service>>> {
  try {
    const body = await request.json();
    const cookieStore = cookies();
    const clinicId = await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }
    
    // Extract supplies if provided
    const { supplies, ...serviceData } = body;
    
    // Add clinic_id to body for validation
    const dataWithClinic = { ...serviceData, clinic_id: clinicId };
    
    // Validate request body
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

    const { name, est_minutes } = validationResult.data;

    const { data, error } = await supabaseAdmin
      .from('services')
      .update({ name, est_minutes })
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Service not found' },
          { status: 404 }
        );
      }
      
      console.error('Error updating service:', error);
      return NextResponse.json(
        { error: 'Failed to update service', message: error.message },
        { status: 500 }
      );
    }

    // If supplies are provided, update them
    if (supplies !== undefined) {
      // Delete existing supplies
      await supabaseAdmin
        .from('service_supplies')
        .delete()
        .eq('service_id', params.id)
        .eq('clinic_id', clinicId);

      // Add new supplies if any
      if (Array.isArray(supplies) && supplies.length > 0) {
        const serviceSupplies = supplies.map((supply: any) => ({
          clinic_id: clinicId,
          service_id: params.id,
          supply_id: supply.supply_id,
          qty: supply.qty
        }));

        const { error: suppliesError } = await supabaseAdmin
          .from('service_supplies')
          .insert(serviceSupplies);

        if (suppliesError) {
          console.error('Error updating service supplies:', suppliesError);
        }
      }
    }

    return NextResponse.json({ 
      data,
      message: 'Service updated successfully'
    });

  } catch (error) {
    console.error('Unexpected error in PUT /api/services/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest, 
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const cookieStore = cookies();
    const clinicId = await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    // Service supplies will be deleted automatically by CASCADE
    const { error } = await supabaseAdmin
      .from('services')
      .delete()
      .eq('id', params.id)
      .eq('clinic_id', clinicId);

    if (error) {
      console.error('Error deleting service:', error);
      return NextResponse.json(
        { error: 'Failed to delete service', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      data: null,
      message: 'Service deleted successfully'
    });

  } catch (error) {
    console.error('Unexpected error in DELETE /api/services/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}