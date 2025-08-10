import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/categories - Obtener categorías (sistema + personalizadas)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entity_type') || 'service';
    
    const cookieStore = cookies();
    const clinicId = cookieStore.get('clinicId')?.value;

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic selected' },
        { status: 400 }
      );
    }

    // Obtener categorías del sistema + personalizadas de la clínica
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('entity_type', entityType)
      .eq('is_active', true)
      .or(`is_system.eq.true,clinic_id.eq.${clinicId}`)
      .order('display_order')
      .order('display_name');

    if (error) {
      console.error('Error fetching categories:', error);
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/categories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/categories - Crear categoría personalizada
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const clinicId = cookieStore.get('clinicId')?.value;

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic selected' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { entity_type, name, display_name } = body;

    if (!entity_type || !name || !display_name) {
      return NextResponse.json(
        { error: 'entity_type, name and display_name are required' },
        { status: 400 }
      );
    }

    // Crear categoría personalizada para la clínica
    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({
        clinic_id: clinicId,
        entity_type,
        name: name.toLowerCase().replace(/\s+/g, '_'), // Normalizar nombre
        display_name,
        is_system: false,
        is_active: true,
        display_order: 500 // Las personalizadas van después de las del sistema
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'Category already exists for this clinic' },
          { status: 409 }
        );
      }
      console.error('Error creating category:', error);
      return NextResponse.json(
        { error: 'Failed to create category' },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/categories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}