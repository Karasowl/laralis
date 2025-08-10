import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    
    const cookieStore = cookies();
    const clinicId = cookieStore.get('clinicId')?.value;

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    // Get services with their supplies for cost calculation
    let query = supabaseAdmin
      .from('services')
      .select(`
        *,
        service_supplies (
          qty,
          supply:supplies (
            id,
            name,
            presentation,
            price_cents,
            portions
          )
        )
      `)
      .eq('clinic_id', clinicId)
      .eq('active', true)
      .order('name', { ascending: true });

    // Apply search filter
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching services:', error);
      return NextResponse.json(
        { error: 'Failed to fetch services', message: error.message },
        { status: 500 }
      );
    }

    // Calculate variable cost for each service
    const servicesWithCost = (data || []).map(service => {
      const variableCostCents = service.service_supplies?.reduce((total: number, ss: any) => {
        if (ss.supply) {
          const costPerPortion = ss.supply.price_cents / ss.supply.portions;
          return total + (costPerPortion * ss.qty);
        }
        return total;
      }, 0) || 0;

      return {
        ...service,
        variable_cost_cents: Math.round(variableCostCents)
      };
    });

    return NextResponse.json(servicesWithCost);
  } catch (error) {
    console.error('Unexpected error in GET /api/services:', error);
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
    const clinicId = body.clinic_id || cookieStore.get('clinicId')?.value;

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
    
    // Extract the fields we need
    const { name, category = 'otros', est_minutes, description } = body;
    
    // Validate required fields (category is optional with default)
    if (!name || !est_minutes) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          message: 'Name and est_minutes are required'
        },
        { status: 400 }
      );
    }

    // Create the service with new fields
    const { data: serviceData, error: serviceError } = await supabaseAdmin
      .from('services')
      .insert({ 
        clinic_id: clinicId,
        name,
        category,
        est_minutes,
        description: description || null,
        active: true
      })
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
        service_id: serviceData.id,
        supply_id: supply.supply_id,
        qty: supply.qty || supply.quantity || 1
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