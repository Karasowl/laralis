import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { withPermission } from '@/lib/middleware/with-permission';

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().max(500).optional().nullable(),
  scope: z.enum(['workspace', 'clinic']),
  base_role: z.string().optional().nullable(),
  permissions: z.record(z.boolean()).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const GET = withPermission('team.view', async (request, ctx) => {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope');

  let query = supabaseAdmin
    .from('custom_role_templates')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false });

  if (scope === 'workspace' || scope === 'clinic') {
    query = query.eq('scope', scope);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[custom-roles] Error fetching roles:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }

  return NextResponse.json({ roles: data || [] });
});

export const POST = withPermission('team.edit_roles', async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const validated = createSchema.parse(body);
    const slug = slugify(validated.name);

    const { data: existing } = await supabaseAdmin
      .from('custom_role_templates')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'A role with this name already exists' },
        { status: 409 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('custom_role_templates')
      .insert({
        workspace_id: ctx.workspaceId,
        name: validated.name,
        slug,
        description: validated.description ?? null,
        scope: validated.scope,
        base_role: validated.base_role ?? null,
        permissions: validated.permissions ?? {},
        is_active: validated.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('[custom-roles] Error creating role:', error);
      return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
    }

    return NextResponse.json({ role: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[custom-roles] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
