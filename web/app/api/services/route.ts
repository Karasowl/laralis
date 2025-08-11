import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
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

    // Get services with their supplies relationship
    // Using explicit relationship hint to avoid ambiguity
    let query = supabaseAdmin
      .from('services')
      .select(`
        *,
        service_supplies!service_supplies_service_id_fkey (
          id,
          supply_id,
          qty,
          supplies (
            id,
            name,
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
        if (ss.supplies) {
          const costPerPortion = ss.supplies.price_cents / ss.supplies.portions;
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

    // Calculate initial price (can be updated later in tariffs)
    // For now, use a default calculation based on time and a standard margin
    const minuteRate = 1000; // Default rate per minute in cents (10 pesos)
    const basePrice = est_minutes * minuteRate;
    const defaultMargin = 1.6; // 60% margin
    const price_cents = Math.round(basePrice * defaultMargin);

    // Create the service with new fields
    const { data: serviceData, error: serviceError } = await supabaseAdmin
      .from('services')
      .insert({ 
        clinic_id: clinicId,
        name,
        category,
        est_minutes,
        description: description || null,
        price_cents: price_cents,
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