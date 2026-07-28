import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { withPermission } from '@/lib/middleware/with-permission';
import { readJson } from '@/lib/validation';
import { listConvexDocumentsByWorkspace, decodeConvexValue } from '@/lib/convex/server';
import { shouldReturnConvexData } from '@/lib/data-backend';
import { getAuthBackend } from '@/lib/auth/convex-session';

type ConvexRecord = Record<string, any>;

// Strips the full Convex metadata set so the Convex branch returns a
// byte-identical row shape to the Supabase `select('*')` response.
function normalizeConvexRecord(row: ConvexRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row;
  return rest;
}

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

  // Flag-gated Convex read branch. SECURITY: this runs ONLY after withPermission
  // has executed resolveClinicContext (getUser) AND the userHasPermission
  // 'team.view' guard for the caller, so authorization is already enforced.
  // The Convex bridge has no RLS; the guard above is the authorization boundary.
  // Default backend stays Supabase (see getDataReadBackend); only flips when
  // DATA_READ_BACKEND_ROLE_PERMISSIONS / DATA_READ_BACKEND / DATA_BACKEND select convex.
  // getAuthBackend()==='convex' is also honored so the whole permission subsystem
  // flips on a full auth cutover too (matches lib/permissions/check.ts).
  if (getAuthBackend() === 'convex' || shouldReturnConvexData('role_permissions')) {
    try {
      const rows = (await listConvexDocumentsByWorkspace(
        'custom_role_templates',
        ctx.workspaceId,
        10000
      )) as ConvexRecord[];

      // Replicate the optional `.eq('scope', scope)` filter (only valid values).
      const filtered = rows.filter((row) => {
        if (scope === 'workspace' || scope === 'clinic') {
          return row.scope === scope;
        }
        return true;
      });

      // Replicate `.order('created_at', { ascending: false })`.
      const sorted = filtered.sort((a, b) =>
        String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
      );

      // Convex stores JSONB object keys encoded; the `permissions` map keys are
      // semantic ("patients.view"), so decode them back so the response matches
      // the Supabase `select('*')` shape byte-for-byte.
      const roles = sorted.map((row) => {
        const normalized = normalizeConvexRecord(row);
        return { ...normalized, permissions: decodeConvexValue(normalized.permissions) };
      });
      return NextResponse.json({ roles });
    } catch (convexError) {
      console.error('[custom-roles] Convex read error:', convexError);
      return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }
  }

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
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const body = bodyResult.data;
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
