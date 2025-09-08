import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';
import { createSupabaseClient } from '@/lib/supabase';
import { z } from 'zod';

const categorySchema = z.object({
  category_type_id: z.string().uuid(),
  parent_id: z.string().uuid().optional().nullable(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  display_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  metadata: z.record(z.any()).optional().default({})
});

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createSupabaseClient(cookieStore);
    const { searchParams } = new URL(request.url);
    
    // ✅ Validar usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clinicId = searchParams.get('clinicId') || await getClinicIdOrDefault(cookieStore);
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic context available' }, { status: 400 });
    }

    const typeCode = searchParams.get('type');
    const entityType = searchParams.get('entity_type');
    const active = searchParams.get('active');
    const withType = searchParams.get('withType') === 'true';
    
    let query = supabaseAdmin
      .from(withType ? 'v_categories_with_type' : 'categories')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('display_order', { ascending: true });
    
    // Filter by type (preferred) or entity_type (compat)
    if (typeCode) {
      // First get the category_type_id
      const { data: typeData } = await supabaseAdmin
        .from('category_types')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('code', typeCode)
        .single();
      
      if (typeData) {
        query = query.eq('category_type_id', typeData.id);
      }
    } else if (entityType) {
      // Backward compatibility: filter directly by categories.entity_type when provided
      query = query.eq('entity_type', entityType);
    }
    
    // Filter by active status
    if (active === 'true') {
      query = query.eq('is_active', true);
    } else if (active === 'false') {
      query = query.eq('is_active', false);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching categories:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Unexpected error:', error);
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
    const supabase = createSupabaseClient(cookieStore);
    
    // ✅ Validar usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clinicId = await getClinicIdOrDefault(cookieStore);
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic context available' }, { status: 400 });
    }
    
    // Validate input
    const validatedData = categorySchema.parse(body);
    
    // Create category
    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({
        ...validatedData,
        clinic_id: clinicId,
        is_system: false // User-created categories are never system categories
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating category:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
