import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zAsset } from '@/lib/zod';
import type { Asset, ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';
import { createServerClient } from '@supabase/ssr';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<Asset>>> {
  try {
    const body = await request.json();
    const cookieStore = cookies();
    
    // Verificar autenticación
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const clinicId = body.clinic_id || await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    // Convert pesos form payload if present
    const dataToValidate = { ...body, clinic_id: clinicId };
    if ('purchase_price_pesos' in body) {
      dataToValidate.purchase_price_cents = Math.round(body.purchase_price_pesos * 100);
      delete dataToValidate.purchase_price_pesos;
    }

    const validationResult = zAsset.safeParse(dataToValidate);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          message: validationResult.error.errors.map(e => e.message).join(', ')
        },
        { status: 400 }
      );
    }

    // Remover depreciation_months si existe ya que es una columna generada
    const dataToUpdate = { ...validationResult.data };
    delete dataToUpdate.depreciation_months;

    const { data, error } = await supabaseAdmin
      .from('assets')
      .update(dataToUpdate)
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .select()
      .single();

    if (error) {
      console.error('Error updating asset:', error);
      return NextResponse.json(
        { error: 'Failed to update asset', message: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data, message: 'Asset updated successfully' });
  } catch (error) {
    console.error('Unexpected error in PUT /api/assets/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const cookieStore = cookies();
    
    // Verificar autenticación
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const clinicId = await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('assets')
      .delete()
      .eq('id', params.id)
      .eq('clinic_id', clinicId);

    if (error) {
      console.error('Error deleting asset:', error);
      return NextResponse.json(
        { error: 'Failed to delete asset', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: null, message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/assets/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}