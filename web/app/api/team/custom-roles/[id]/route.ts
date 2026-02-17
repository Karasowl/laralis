import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { withPermission } from '@/lib/middleware/with-permission';
import { readJson } from '@/lib/validation';

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().max(500).optional().nullable(),
  base_role: z.string().optional().nullable(),
  permissions: z.record(z.boolean()).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const PUT = withPermission(
  'team.edit_roles',
  async (
    request: NextRequest,
    ctx
  ) => {
    const roleId = request.nextUrl.pathname.split('/').pop();

    if (!roleId) {
      return NextResponse.json({ error: 'Missing role ID' }, { status: 400 });
    }

    try {
      const bodyResult = await readJson(request);
      if ('error' in bodyResult) {
        return bodyResult.error;
      }
      const body = bodyResult.data;
      const validated = updateSchema.parse(body);

      const { data: existing } = await supabaseAdmin
        .from('custom_role_templates')
        .select('id, name, slug, workspace_id')
        .eq('id', roleId)
        .single();

      if (!existing) {
        return NextResponse.json({ error: 'Role not found' }, { status: 404 });
      }

      if (existing.workspace_id !== ctx.workspaceId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const updateData: Record<string, unknown> = {};

      if (validated.name) {
        updateData.name = validated.name;
        updateData.slug = slugify(validated.name);
      }

      if (validated.description !== undefined) {
        updateData.description = validated.description;
      }

      if (validated.base_role !== undefined) {
        updateData.base_role = validated.base_role;
      }

      if (validated.permissions !== undefined) {
        updateData.permissions = validated.permissions ?? {};
      }

      if (validated.is_active !== undefined) {
        updateData.is_active = validated.is_active;
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }

      if (updateData.slug) {
        const { data: conflict } = await supabaseAdmin
          .from('custom_role_templates')
          .select('id')
          .eq('workspace_id', ctx.workspaceId)
          .eq('slug', updateData.slug)
          .neq('id', roleId)
          .maybeSingle();

        if (conflict) {
          return NextResponse.json(
            { error: 'A role with this name already exists' },
            { status: 409 }
          );
        }
      }

      const { data, error } = await supabaseAdmin
        .from('custom_role_templates')
        .update(updateData)
        .eq('id', roleId)
        .select()
        .single();

      if (error) {
        console.error('[custom-roles] Error updating role:', error);
        return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
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
  }
);

export const DELETE = withPermission(
  'team.edit_roles',
  async (request: NextRequest, ctx) => {
    const roleId = request.nextUrl.pathname.split('/').pop();

    if (!roleId) {
      return NextResponse.json({ error: 'Missing role ID' }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from('custom_role_templates')
      .select('id, workspace_id')
      .eq('id', roleId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    if (existing.workspace_id !== ctx.workspaceId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('custom_role_templates')
      .delete()
      .eq('id', roleId);

    if (error) {
      console.error('[custom-roles] Error deleting role:', error);
      return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }
);

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
