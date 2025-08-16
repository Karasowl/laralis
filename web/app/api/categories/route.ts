import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const typeCode = searchParams.get('type');
    const active = searchParams.get('active');
    const withType = searchParams.get('withType') === 'true';
    
    // Get clinic_id from the current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get clinic member
    const { data: member } = await supabase
      .from('clinic_members')
      .select('clinic_id')
      .eq('user_id', userData.user.id)
      .single();
    
    if (!member) {
      return NextResponse.json({ error: 'No clinic found' }, { status: 404 });
    }
    
    let query = supabase
      .from(withType ? 'v_categories_with_type' : 'categories')
      .select('*')
      .eq('clinic_id', member.clinic_id)
      .order('display_order', { ascending: true });
    
    // Filter by type if specified
    if (typeCode) {
      // First get the category_type_id
      const { data: typeData } = await supabase
        .from('category_types')
        .select('id')
        .eq('clinic_id', member.clinic_id)
        .eq('code', typeCode)
        .single();
      
      if (typeData) {
        query = query.eq('category_type_id', typeData.id);
      }
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
    const supabase = await createClient();
    const body = await request.json();
    
    // Validate input
    const validatedData = categorySchema.parse(body);
    
    // Get clinic_id from the current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get clinic member and check permissions
    const { data: member } = await supabase
      .from('clinic_members')
      .select('clinic_id, role')
      .eq('user_id', userData.user.id)
      .single();
    
    if (!member) {
      return NextResponse.json({ error: 'No clinic found' }, { status: 404 });
    }
    
    if (member.role !== 'owner' && member.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Create category
    const { data, error } = await supabase
      .from('categories')
      .insert({
        ...validatedData,
        clinic_id: member.clinic_id,
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