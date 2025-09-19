import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isUsingServiceRole } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const diacriticRegex = /[\u0300-\u036f]/g;

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
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    
    // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Validar usuario autenticado
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
    
    const db = isUsingServiceRole ? supabaseAdmin : createClient();
    let query = db
      .from(withType ? 'v_categories_with_type' : 'categories')
      .select('*')
      .eq('is_active', true)
      // Include both system categories (global) and clinic-specific ones
      .or(`clinic_id.eq.${clinicId},is_system.eq.true`)
      .order('is_system', { ascending: false })
      .order('display_order', { ascending: true });
    
    // Filter by type (preferred) or entity_type (compat)
    if (typeCode) {
      // First get the category_type_id (new schema)
      const { data: typeData } = await db
        .from('category_types')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('code', typeCode)
        .maybeSingle();
      
      if (typeData?.id) {
        query = query.eq('category_type_id', typeData.id);
      } else {
        // Fallback to legacy schema filter by entity_type mapping
        const map: Record<string, string> = {
          services: 'service',
          supplies: 'supply',
          expenses: 'fixed_cost',
          assets: 'asset'
        };
        const legacyType = map[typeCode];
        if (legacyType) query = query.eq('entity_type', legacyType as any);
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
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    
    // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Validar usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clinicId = await getClinicIdOrDefault(cookieStore);
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic context available' }, { status: 400 });
    }
    
    // Support two modes:
    // 1) New system: accept full payload (categorySchema)
    // 2) Simplified: when `type` query is provided (e.g., type=services),
    //    allow a minimal body { name, code? } and resolve category_type_id server-side

    const typeCode = searchParams.get('type');

    if (typeCode) {
      // Resolve category_type_id for the clinic and type code (new schema)
      const { data: typeData, error: typeErr } = await (isUsingServiceRole ? supabaseAdmin : createClient())
        .from('category_types')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('code', typeCode)
        .maybeSingle();

      const rawName = String(body?.name || '').trim();
      if (!rawName) {
        return NextResponse.json(
          { error: 'Name is required' },
          { status: 400 }
        );
      }

      // Build code if not provided
      const code: string = (body?.code && String(body.code).trim().length > 0)
        ? String(body.code)
        : rawName
            .toLowerCase()
            .normalize('NFD').replace(diacriticRegex, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');

      // Try new-schema insert first if typeData exists
      if (typeData?.id) {
        const insertPayload = {
          clinic_id: clinicId,
          category_type_id: typeData.id,
          parent_id: body?.parent_id ?? null,
          code,
          name: rawName,
          description: body?.description ?? null,
          icon: body?.icon ?? null,
          color: body?.color ?? null,
          display_order: typeof body?.display_order === 'number' ? body.display_order : 0,
          is_system: false,
          is_active: body?.is_active ?? true,
          metadata: body?.metadata ?? {}
        } as any;

        const { data, error } = await (isUsingServiceRole ? supabaseAdmin : createClient())
          .from('categories')
          .insert(insertPayload)
          .select()
          .single();

        if (!error && data) {
          return NextResponse.json({ data });
        }

        // If insert failed due to schema mismatch, fall through to legacy path
        if (error) {
          console.warn('Falling back to legacy categories schema due to insert error:', (error as any).message || error);
        }
      }

      // Legacy/compatible path: insert into old flexible categories (entity_type/name/display_name)
      const entityTypeMap: Record<string, string> = {
        services: 'service',
        supplies: 'supply',
        expenses: 'fixed_cost',
        assets: 'asset'
      };
      const entity_type = entityTypeMap[typeCode] || 'service';

      const legacyPayload = {
        clinic_id: clinicId,
        entity_type,
        name: code, // store code as canonical name
        display_name: rawName,
        is_system: false,
        is_active: body?.is_active ?? true,
        display_order: typeof body?.display_order === 'number' ? body.display_order : 999
      } as any;

      const { data: legacyData, error: legacyErr } = await (isUsingServiceRole ? supabaseAdmin : createClient())
        .from('categories')
        .insert(legacyPayload)
        .select()
        .single();

      if (legacyErr) {
        if ((legacyErr as any).code === '23505') {
          return NextResponse.json(
            { error: 'Category already exists' },
            { status: 400 }
          );
        }
        console.error('Error creating category (legacy):', legacyErr);
        return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
      }

      return NextResponse.json({ data: legacyData });
    }

    // Fallback to strict schema validation when no type provided
    const validatedData = categorySchema.parse(body);

    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({
        ...validatedData,
        clinic_id: clinicId,
        is_system: false
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
