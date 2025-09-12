import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isUsingServiceRole } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createPlatformSchema = z.object({
  display_name: z.string().min(1),
  name: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createClient();
    
    // ✅ Validar usuario autenticado (si no hay service role). En entornos
    // con service role podemos permitir la operación incluso si la sesión
    // no está disponible por alguna razón de cookies en el fetch.
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!isUsingServiceRole && (authError || !user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const clinicId = searchParams.get('clinicId') || await getClinicIdOrDefault(cookieStore);
    const activeOnly = searchParams.get('active') === 'true';

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    // ✅ TODO: Validar que el usuario tiene acceso a esta clínica
    // const hasAccess = await validateUserClinicAccess(user.id, clinicId);
    // if (!hasAccess) {
    //   return NextResponse.json({ error: 'Access denied to this clinic' }, { status: 403 });
    // }

    // ✅ FIX: Solo plataformas del sistema O específicas de esta clínica
    let query = supabaseAdmin
      .from('categories')
      .select('*')
      .eq('entity_type', 'marketing_platform')
      .or(`clinic_id.is.null,clinic_id.eq.${clinicId}`)
      .order('is_system', { ascending: false })
      .order('display_order', { ascending: true })
      .order('display_name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching marketing platforms:', error);
      return NextResponse.json(
        { error: 'Failed to fetch marketing platforms', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Unexpected error in GET /api/marketing/platforms:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createClient();
    
    // ✅ Verificación de sesión solo si no hay service role
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!isUsingServiceRole && (authError || !user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Accept clinic id from body or query param, falling back to cookie/default
    const urlClinicId = request.nextUrl.searchParams.get('clinicId');
    const body = await request.json();
    console.log('[POST /api/marketing/platforms] body =', body);
    const clinicId = body?.clinic_id || urlClinicId || await getClinicIdOrDefault(cookieStore);
    console.log('[POST /api/marketing/platforms] clinicId =', clinicId);
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic context available' }, { status: 400 });
    }

    const validation = createPlatformSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', message: validation.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    // ✅ FIX: Siempre asignar clinic_id para plataformas personalizadas
    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({
        clinic_id: clinicId, // ⚠️ CRÍTICO: Sin esto se filtra a otras clínicas
        entity_type: 'marketing_platform',
        name: validation.data.name || validation.data.display_name.toLowerCase().replace(/\s+/g, '_'),
        display_name: validation.data.display_name,
        is_system: false,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating marketing platform:', error);
      return NextResponse.json({ error: 'Failed to create marketing platform', message: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Unexpected error in POST /api/marketing/platforms:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body?.id as string | undefined;
    if (!id) {
      return NextResponse.json({ error: 'Missing platform id' }, { status: 400 });
    }
    const patch: any = {};
    if (body.display_name) patch.display_name = body.display_name;
    if (body.is_active !== undefined) patch.is_active = body.is_active;

    const { data, error } = await supabaseAdmin
      .from('categories')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating marketing platform:', error);
      return NextResponse.json({ error: 'Failed to update marketing platform', message: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Unexpected error in PUT /api/marketing/platforms:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body?.id as string | undefined;
    if (!id) {
      return NextResponse.json({ error: 'Missing platform id' }, { status: 400 });
    }

    // Ahora permitimos eliminar TODAS las plataformas, incluyendo las del sistema
    const { error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting marketing platform:', error);
      return NextResponse.json({ error: 'Failed to delete marketing platform', message: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/marketing/platforms:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


