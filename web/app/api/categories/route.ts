import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isUsingServiceRole } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { readJson, validateSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic'


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

const categoryCreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  parent_id: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
}).passthrough();

function buildCodeFromName(rawName: string): string {
  return rawName
    .toLowerCase()
    .normalize('NFD').replace(diacriticRegex, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const searchParams = request.nextUrl.searchParams;

    const clinicContext = await resolveClinicContext({
      requestedClinicId: searchParams.get('clinicId'),
      cookieStore,
    });

    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }

    const { clinicId } = clinicContext;

    const supabase = createClient();
    const db = isUsingServiceRole ? supabaseAdmin : supabase;

    const typeCode = searchParams.get('type');
    const entityType = searchParams.get('entity_type');
    const active = searchParams.get('active');
    const withType = searchParams.get('withType') === 'true';

    let query = db
      .from(withType ? 'v_categories_with_type' : 'categories')
      .select('*')
      .eq('is_active', true)
      .or(`clinic_id.eq.${clinicId},is_system.eq.true`)
      .order('is_system', { ascending: false })
      .order('display_order', { ascending: true });

    if (typeCode) {
      const { data: typeData } = await db
        .from('category_types')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('code', typeCode)
        .maybeSingle();

      if (typeData?.id) {
        query = query.eq('category_type_id', typeData.id);
      } else {
        const map: Record<string, string> = {
          services: 'service',
          supplies: 'supply',
          expenses: 'expense',  // Fixed: was 'fixed_cost', should be 'expense'
          assets: 'asset',
        };
        const legacyType = map[typeCode];
        if (legacyType) {
          query = query.eq('entity_type', legacyType as any);
        }
      }
    } else if (entityType) {
      query = query.eq('entity_type', entityType);
    }

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
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const body = bodyResult.data;
    const cookieStore = cookies();
    const searchParams = request.nextUrl.searchParams;

    const clinicContext = await resolveClinicContext({ cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }

    const { clinicId } = clinicContext;

    const supabase = createClient();
    const db = isUsingServiceRole ? supabaseAdmin : supabase;

    const typeCode = searchParams.get('type');

    if (typeCode) {
      const parsed = validateSchema(categoryCreateSchema, body, 'Invalid payload');
      if ('error' in parsed) {
        return parsed.error;
      }
      const payload = parsed.data;
      const { data: typeData } = await db
        .from('category_types')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('code', typeCode)
        .maybeSingle();

      const rawName = payload.name.trim();

      const code = payload.code && String(payload.code).trim().length > 0
        ? String(payload.code)
        : buildCodeFromName(rawName);

      if (typeData?.id) {
        const insertPayload = {
          clinic_id: clinicId,
          category_type_id: typeData.id,
          parent_id: payload.parent_id ?? null,
          code,
          name: rawName,
          description: payload.description ?? null,
          icon: payload.icon ?? null,
          color: payload.color ?? null,
          display_order: typeof payload.display_order === 'number' ? payload.display_order : 0,
          is_system: false,
          is_active: payload.is_active ?? true,
          metadata: payload.metadata ?? {},
        } as any;

        const { data, error } = await db
          .from('categories')
          .insert(insertPayload)
          .select()
          .single();

        if (!error && data) {
          return NextResponse.json({ data });
        }

        if (error) {
          console.warn('Falling back to legacy categories schema due to insert error:', error.message);
        }
      }

      const entityTypeMap: Record<string, string> = {
        services: 'service',
        supplies: 'supply',
        expenses: 'expense',  // Fixed: was 'fixed_cost', should be 'expense'
        assets: 'asset',
      };
      const entity_type = entityTypeMap[typeCode] || 'service';

      const legacyPayload = {
        clinic_id: clinicId,
        entity_type,
        name: code,
        display_name: rawName,
        is_system: false,
        is_active: payload.is_active ?? true,
        display_order: typeof payload.display_order === 'number' ? payload.display_order : 999,
      } as any;

      const { data: legacyData, error: legacyErr } = await db
        .from('categories')
        .insert(legacyPayload)
        .select()
        .single();

      if (legacyErr) {
        if ((legacyErr as any).code === '23505') {
          return NextResponse.json({ error: 'Category already exists' }, { status: 400 });
        }
        console.error('Error creating category (legacy):', legacyErr);
        return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
      }

      return NextResponse.json({ data: legacyData });
    }

    const validated = validateSchema(categorySchema, body, 'Invalid payload');
    if ('error' in validated) {
      return validated.error;
    }
    const validatedData = validated.data;

    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({
        ...validatedData,
        clinic_id: clinicId,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
