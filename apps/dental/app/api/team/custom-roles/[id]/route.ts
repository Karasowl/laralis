import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { withPermission } from '@/lib/middleware/with-permission';
import { readJson } from '@/lib/validation';
import {
  getConvexDocumentByLegacyId,
  listConvexDocumentsByWorkspace,
  patchConvexDocumentByLegacyId,
  deleteConvexDocumentByLegacyId,
  decodeConvexValue,
} from '@/lib/convex/server';
import { shouldUseConvexOnlyWritePath } from '@/lib/data-backend';

type ConvexRecord = Record<string, any>;

// Strips the full Convex metadata set so the Convex branch returns a
// byte-identical row shape to the Supabase `select('*')` / `.select().single()`
// response (mirrors normalizeConvexRecord in the sibling collection route).
function normalizeConvexRecord(row: ConvexRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row;
  return rest;
}

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

      // Flag-gated Convex-only write branch. Runs ONLY after withPermission has
      // executed resolveClinicContext (getUser) AND the 'team.edit_roles' guard,
      // so authorization is already enforced (the Convex bridge has no RLS). It
      // replicates EVERY Supabase write/read this handler does (read existing ->
      // ownership check -> slug conflict check -> patch -> return updated row) and
      // is reached BEFORE the first Supabase access, which would throw with
      // Supabase unreachable. Default backend stays Supabase (flag is off).
      if (shouldUseConvexOnlyWritePath('role_permissions')) {
        try {
          const existingRaw = (await getConvexDocumentByLegacyId(
            'custom_role_templates',
            roleId
          )) as ConvexRecord | null;

          if (!existingRaw) {
            return NextResponse.json({ error: 'Role not found' }, { status: 404 });
          }

          if (existingRaw.workspace_id !== ctx.workspaceId) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
          }

          const patch: Record<string, unknown> = {};

          if (validated.name) {
            patch.name = validated.name;
            patch.slug = slugify(validated.name);
          }

          if (validated.description !== undefined) {
            patch.description = validated.description;
          }

          if (validated.base_role !== undefined) {
            patch.base_role = validated.base_role;
          }

          if (validated.permissions !== undefined) {
            // JSONB permission map with dotted keys ("patients.view"). The patch
            // helper runs encodeConvexValue() over the whole patch, so the map
            // keys are encoded on write (decoded on read below / in the GET branch).
            patch.permissions = validated.permissions ?? {};
          }

          if (validated.is_active !== undefined) {
            patch.is_active = validated.is_active;
          }

          if (Object.keys(patch).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
          }

          // Replicate the slug uniqueness guard within the workspace (excluding self).
          if (patch.slug) {
            const siblings = (await listConvexDocumentsByWorkspace(
              'custom_role_templates',
              ctx.workspaceId,
              10000
            )) as ConvexRecord[];
            const conflict = siblings.find(
              (row) => row.slug === patch.slug && String(row.id) !== String(roleId)
            );
            if (conflict) {
              return NextResponse.json(
                { error: 'A role with this name already exists' },
                { status: 409 }
              );
            }
          }

          await patchConvexDocumentByLegacyId('custom_role_templates', roleId, patch);

          // Mirror Supabase `.update(...).select().single()`: return the full,
          // post-update row shape. Re-read so server-managed columns (updated_at,
          // created_at, etc.) are reflected; decode the JSONB permission map keys.
          const updatedRaw = (await getConvexDocumentByLegacyId(
            'custom_role_templates',
            roleId
          )) as ConvexRecord | null;
          const normalized = normalizeConvexRecord(updatedRaw ?? {});
          const role = {
            ...normalized,
            permissions: decodeConvexValue(normalized.permissions),
          };
          return NextResponse.json({ role });
        } catch (convexError) {
          console.error('[custom-roles] Convex update error:', convexError);
          return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
        }
      }

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

    // Flag-gated Convex-only write branch (see PUT for rationale). Replicates the
    // Supabase read existing -> ownership check -> HARD delete (Supabase uses
    // `.delete()`, so we mirror with deleteConvexDocumentByLegacyId, not a soft
    // is_active:false patch). Reached before any Supabase access.
    if (shouldUseConvexOnlyWritePath('role_permissions')) {
      try {
        const existingRaw = (await getConvexDocumentByLegacyId(
          'custom_role_templates',
          roleId
        )) as ConvexRecord | null;

        if (!existingRaw) {
          return NextResponse.json({ error: 'Role not found' }, { status: 404 });
        }

        if (existingRaw.workspace_id !== ctx.workspaceId) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        await deleteConvexDocumentByLegacyId('custom_role_templates', roleId);

        return NextResponse.json({ success: true });
      } catch (convexError) {
        console.error('[custom-roles] Convex delete error:', convexError);
        return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
      }
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
