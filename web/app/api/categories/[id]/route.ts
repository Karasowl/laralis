import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isUsingServiceRole } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';
import { createClient } from '@/lib/supabase/server';

function slugify(input: string) {
  return String(input)
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const cookieStore = cookies();
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const clinicId = await getClinicIdOrDefault(cookieStore);
    if (!clinicId) return NextResponse.json({ error: 'No clinic context available' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const typeCode = (searchParams.get('type') || 'services') as 'services' | 'supplies' | 'expenses' | 'assets';

    const body = await request.json();
    const newNameRaw = String(body?.name || '').trim();
    if (!newNameRaw) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    const newCode = slugify(newNameRaw);

    const db = isUsingServiceRole ? supabaseAdmin : createClient();
    // Fetch category
    const { data: cat, error: catErr } = await db
      .from('categories')
      .select('id, clinic_id, is_system, name, display_name, category_type_id')
      .eq('id', params.id)
      .maybeSingle();
    if (catErr || !cat) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

    const nameToMatch = (cat as any).display_name || (cat as any).name;

    // System category protection: do not edit the global row
    if (!cat.clinic_id || cat.is_system) {
      // Create a clinic-level override with the new name
      // Resolve type in legacy mapping
      const typeMap: Record<string, string> = {
        services: 'service', supplies: 'supply', expenses: 'fixed_cost', assets: 'asset'
      };
      const legacyType = typeMap[typeCode] || 'service';

      // Try new schema first (requires category_types)
      let inserted: any = null;
      const { data: typeRow } = await db
        .from('category_types')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('code', typeCode)
        .maybeSingle();
      if (typeRow?.id) {
        const { data, error } = await db
          .from('categories')
          .insert({
            clinic_id: clinicId,
            category_type_id: typeRow.id,
            code: newCode,
            name: newNameRaw,
            description: null,
            is_system: false,
            is_active: true,
            display_order: 0,
            metadata: {}
          } as any)
          .select()
          .single();
        if (!error) inserted = data;
      }
      if (!inserted) {
        // Legacy schema insert
        const { data, error } = await db
          .from('categories')
          .insert({
            clinic_id: clinicId,
            entity_type: legacyType,
            name: newCode,
            display_name: newNameRaw,
            is_system: false,
            is_active: true,
            display_order: 999
          } as any)
          .select()
          .single();
        if (error) {
          if ((error as any).code === '23505') {
            return NextResponse.json({ error: 'Category already exists' }, { status: 400 });
          }
          console.error('Error creating override category:', error);
          return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
        }
        inserted = data;
      }

      // Remap entities for this clinic from old name to new name
      if (nameToMatch) {
        const table = typeCode === 'services' ? 'services' : (typeCode === 'supplies' ? 'supplies' : (typeCode === 'expenses' ? 'expenses' : null));
        if (table) {
          await db
            .from(table)
            .update({ category: newNameRaw } as any)
            .eq('clinic_id', clinicId)
            .eq('category', nameToMatch);
        }
      }

      return NextResponse.json({ data: inserted });
    }

    // Update clinic category row directly
    let updatePayload: any = {};
    if ((cat as any).category_type_id !== undefined) {
      // New schema: update name/code
      updatePayload = { name: newNameRaw, code: newCode };
    } else {
      // Legacy schema: update name (code) and display_name
      updatePayload = { name: newCode, display_name: newNameRaw };
    }

    const { data: updated, error: updErr } = await db
      .from('categories')
      .update(updatePayload)
      .eq('id', params.id)
      .select()
      .single();
    if (updErr) return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });

    // Remap entities for this clinic
    if (nameToMatch) {
      const table = typeCode === 'services' ? 'services' : (typeCode === 'supplies' ? 'supplies' : (typeCode === 'expenses' ? 'expenses' : null));
      if (table) {
        await db
          .from(table)
          .update({ category: newNameRaw } as any)
          .eq('clinic_id', clinicId)
          .eq('category', nameToMatch);
      }
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Unexpected error in PUT /api/categories/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const cookieStore = cookies();
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const clinicId = await getClinicIdOrDefault(cookieStore);
    if (!clinicId) return NextResponse.json({ error: 'No clinic context available' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const typeCode = (searchParams.get('type') || 'services') as 'services' | 'supplies' | 'expenses' | 'assets';

    const db = isUsingServiceRole ? supabaseAdmin : createClient();

    // Load category
    const { data: cat } = await db
      .from('categories')
      .select('id, clinic_id, is_system, name, display_name')
      .eq('id', params.id)
      .maybeSingle();
    if (!cat) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

    const nameToMatch = (cat as any).display_name || (cat as any).name;

    // Do not delete global system categories
    if (!cat.clinic_id || cat.is_system) {
      // Just remap services in this clinic to default 'otros'
      const table = typeCode === 'services' ? 'services' : (typeCode === 'supplies' ? 'supplies' : (typeCode === 'expenses' ? 'expenses' : null));
      const defaultName = typeCode === 'expenses' ? 'Otros' : 'otros';
      if (table) {
        await db
          .from(table)
          .update({ category: defaultName } as any)
          .eq('clinic_id', clinicId)
          .eq('category', nameToMatch);
      }
      return NextResponse.json({ data: { id: params.id, remapped: true } });
    }

    // Prefer soft delete
    const { error: delErr } = await db
      .from('categories')
      .update({ is_active: false })
      .eq('id', params.id);
    if (delErr) return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });

    // Remap entities to default
    if (nameToMatch) {
      const table = typeCode === 'services' ? 'services' : (typeCode === 'supplies' ? 'supplies' : (typeCode === 'expenses' ? 'expenses' : null));
      const defaultName = typeCode === 'expenses' ? 'Otros' : 'otros';
      if (table) {
        await db
          .from(table)
          .update({ category: defaultName } as any)
          .eq('clinic_id', clinicId)
          .eq('category', nameToMatch);
      }
    }

    return NextResponse.json({ data: { id: params.id, deleted: true } });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/categories/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
