import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { readJson, validateSchema } from '@/lib/validation';
import { forbiddenIfMissingWorkspacePermission } from '@/lib/workspace-access';
import { shouldUseConvexOnlyWritePath } from '@/lib/data-backend';
import {
  getConvexDocumentByLegacyId,
  listConvexDocumentsByClinic,
  listConvexDocumentsByWorkspace,
  listConvexTable,
  patchConvexDocumentByLegacyId,
  deleteConvexDocumentByLegacyId,
} from '@/lib/convex/server';

export const dynamic = 'force-dynamic'

type AnyRow = Record<string, any>

// Mirror of lib/clinic-tables.ts CLINIC_DELETE_SEQUENCE: the clinic-scoped tables a
// Postgres ON DELETE CASCADE wipes when a clinic row is removed. Convex has no FK
// cascade, so the convex-only delete path must delete each child row explicitly.
const CONVEX_CLINIC_CHILD_TABLES = [
  'treatments',
  'tariffs',
  'expenses',
  'patients',
  'services',
  'supplies',
  'service_supplies',
  'assets',
  'fixed_costs',
  'settings_time',
  'marketing_campaigns',
  'marketing_platforms',
  'expense_categories',
  'categories',
  'category_types',
  // Seeded by seedClinicDefaultsInConvex (after_clinic_insert trigger port);
  // Postgres cascades these too, so the convex tree delete must clear them.
  'patient_sources',
  'custom_categories',
  'whatsapp_templates',
  'clinic_users',
] as const

// Mirror of lib/workspace-lifecycle.ts deleteWorkspaceTree workspace-scoped tables.
const CONVEX_WORKSPACE_CHILD_TABLES = [
  'invitations',
  'workspace_users',
  'workspace_members',
  'workspace_activity',
  'custom_role_templates',
] as const

async function deleteConvexRowsByClinic(table: string, clinicId: string) {
  const rows = (await listConvexDocumentsByClinic(table, clinicId)) as AnyRow[]
  for (const row of rows || []) {
    const legacyId = row?.id ?? row?.legacyId
    if (legacyId) await deleteConvexDocumentByLegacyId(table, String(legacyId))
  }
}

async function deleteConvexRowsByWorkspace(table: string, workspaceId: string) {
  const rows = (await listConvexDocumentsByWorkspace(table, workspaceId)) as AnyRow[]
  for (const row of rows || []) {
    const legacyId = row?.id ?? row?.legacyId
    if (legacyId) await deleteConvexDocumentByLegacyId(table, String(legacyId))
  }
}

// service_supplies has no clinic_id (it joins services/supplies), so it cannot be
// listed by clinic. Mirror the Postgres cascade by deleting the join rows whose
// service or supply belongs to the deleted clinic.
async function deleteConvexServiceSuppliesForClinic(clinicId: string) {
  const [services, supplies, joinRows] = await Promise.all([
    listConvexDocumentsByClinic('services', clinicId) as Promise<AnyRow[]>,
    listConvexDocumentsByClinic('supplies', clinicId) as Promise<AnyRow[]>,
    listConvexTable('service_supplies') as Promise<AnyRow[]>,
  ])
  const serviceIds = new Set((services || []).map((row) => String(row?.id ?? row?.legacyId)))
  const supplyIds = new Set((supplies || []).map((row) => String(row?.id ?? row?.legacyId)))
  for (const row of joinRows || []) {
    const belongs = serviceIds.has(String(row?.service_id)) || supplyIds.has(String(row?.supply_id))
    const legacyId = row?.id ?? row?.legacyId
    if (belongs && legacyId) {
      await deleteConvexDocumentByLegacyId('service_supplies', String(legacyId))
    }
  }
}

// Convex port of the Postgres ON DELETE CASCADE chain that fires when a workspace row
// is deleted (replicated by lib/workspace-lifecycle.ts deleteWorkspaceTree). Deletes
// every clinic child row, then the clinics, then workspace-scoped rows, then the
// workspace itself — matching the Supabase cascade order.
async function deleteWorkspaceTreeInConvex(workspaceId: string) {
  const clinics = (await listConvexDocumentsByWorkspace('clinics', workspaceId)) as AnyRow[]
  for (const clinic of clinics || []) {
    const clinicId = clinic?.id ?? clinic?.legacyId
    if (!clinicId) continue
    const clinicIdStr = String(clinicId)
    await deleteConvexServiceSuppliesForClinic(clinicIdStr)
    // marketing_campaign_status_history is keyed by campaign_id (not clinic_id), so
    // deleteConvexRowsByClinic would miss it. Resolve this clinic's campaigns, then
    // delete their status-history rows (parity with lib/clinic-tables.ts deleteClinicData
    // and the lifecycle route's cascade).
    const campaigns = (await listConvexDocumentsByClinic('marketing_campaigns', clinicIdStr)) as AnyRow[]
    const campaignIds = new Set(
      campaigns.map((row) => row?.id).filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    )
    if (campaignIds.size > 0) {
      const history = (await listConvexDocumentsByClinic('marketing_campaign_status_history', clinicIdStr)) as AnyRow[]
      const historyByWorkspace = (await listConvexDocumentsByWorkspace('marketing_campaign_status_history', workspaceId)) as AnyRow[]
      const seen = new Set<string>()
      for (const row of [...history, ...historyByWorkspace]) {
        const legacyId = row?.id ?? row?.legacyId
        if (!legacyId) continue
        if (row?.campaign_id != null && !campaignIds.has(String(row.campaign_id))) continue
        const key = String(legacyId)
        if (seen.has(key)) continue
        seen.add(key)
        await deleteConvexDocumentByLegacyId('marketing_campaign_status_history', key)
      }
    }
    for (const table of CONVEX_CLINIC_CHILD_TABLES) {
      if (table === 'service_supplies') continue
      await deleteConvexRowsByClinic(table, clinicIdStr)
    }
  }

  for (const table of CONVEX_WORKSPACE_CHILD_TABLES) {
    await deleteConvexRowsByWorkspace(table, workspaceId)
  }

  await deleteConvexRowsByWorkspace('clinics', workspaceId)
  await deleteConvexDocumentByLegacyId('workspaces', workspaceId)
}

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  onboarding_completed: z.boolean().optional(),
  onboarding_step: z.number().int().nonnegative().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'No fields to update',
});


export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies();
    
    // Crear cliente de Supabase para el servidor
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const parsed = validateSchema(updateWorkspaceSchema, bodyResult.data);
    if ('error' in parsed) {
      return parsed.error;
    }
    const { name, description, onboarding_completed, onboarding_step } = parsed.data;

    // Build the same partial update both backends apply.
    const buildUpdateData = () => {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (onboarding_completed !== undefined) {
        const completed = Boolean(onboarding_completed);
        updateData.onboarding_completed = completed;
        updateData.status = completed ? 'active' : 'draft';
        if (completed) {
          updateData.setup_completed_at = updateData.updated_at;
          updateData.setup_last_seen_at = updateData.updated_at;
          updateData.delete_after = null;
          updateData.archived_at = null;
          updateData.pending_deletion_at = null;
        }
      }
      if (onboarding_step !== undefined) updateData.onboarding_step = Number(onboarding_step);
      return updateData;
    };

    // Convex-only write path: Supabase is unreachable, so resolve the workspace,
    // permission gate, and patch entirely against Convex. Mirrors the Supabase
    // branch's existence check (404), owner constraint (.eq('owner_id', user.id)),
    // partial update and response shape.
    if (shouldUseConvexOnlyWritePath('workspaces')) {
      const existing = (await getConvexDocumentByLegacyId('workspaces', params.id)) as AnyRow | null;
      if (!existing || existing.owner_id !== user.id) {
        return NextResponse.json(
          { error: 'Workspace not found or unauthorized' },
          { status: 404 }
        );
      }

      const forbidden = await forbiddenIfMissingWorkspacePermission(user.id, params.id, 'settings.edit');
      if (forbidden) return forbidden;

      const updateData = buildUpdateData();
      await patchConvexDocumentByLegacyId('workspaces', params.id, updateData);

      const updated = (await getConvexDocumentByLegacyId('workspaces', params.id)) as AnyRow | null;
      // Strip Convex bookkeeping fields so the response mirrors the Supabase row shape.
      if (updated) {
        const { _id, _creationTime, legacyId, legacyTable, ...rest } = updated;
        return NextResponse.json(rest);
      }
      return NextResponse.json({ ...existing, ...updateData });
    }

    // Verificar que el workspace existe y que el usuario puede editar settings
    const { data: existingWorkspace, error: fetchError } = await supabaseAdmin
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !existingWorkspace) {
      return NextResponse.json(
        { error: 'Workspace not found or unauthorized' },
        { status: 404 }
      );
    }

    const forbidden = await forbiddenIfMissingWorkspacePermission(user.id, params.id, 'settings.edit');
    if (forbidden) return forbidden;

    // Actualizar el workspace
    const updateData = buildUpdateData();

    const { data: workspace, error: updateError } = await supabaseAdmin
      .from('workspaces')
      .update(updateData)
      .eq('id', params.id)
      .eq('owner_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating workspace:', updateError);
      return NextResponse.json(
        { error: 'Failed to update workspace', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(workspace);
  } catch (error) {
    console.error('Unexpected error in PUT /api/workspaces/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies();

    // Crear cliente de Supabase para el servidor
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Convex-only write path: Supabase is unreachable, so resolve the workspace,
    // replicate the owner gate + "last workspace with clinics" business rule, and
    // perform the destructive cascade entirely against Convex. The Supabase path
    // relies on Postgres ON DELETE CASCADE; Convex has no FK cascade so we delete
    // the whole workspace tree explicitly (see deleteWorkspaceTreeInConvex).
    if (shouldUseConvexOnlyWritePath('workspaces')) {
      const existing = (await getConvexDocumentByLegacyId('workspaces', params.id)) as AnyRow | null;
      if (!existing) {
        return NextResponse.json(
          { error: 'Workspace not found or unauthorized' },
          { status: 404 }
        );
      }

      if (existing.owner_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Check if there are other workspaces (owned by this user) that have clinics.
      const allWorkspaces = (await listConvexTable('workspaces')) as AnyRow[];
      const otherWorkspaces = (allWorkspaces || []).filter(
        (ws) => ws.owner_id === user.id && String(ws.id ?? ws.legacyId) !== params.id
      );

      let hasOtherWorkspacesWithClinics = false;
      for (const ws of otherWorkspaces) {
        const wsId = String(ws.id ?? ws.legacyId);
        const clinics = (await listConvexDocumentsByWorkspace('clinics', wsId)) as AnyRow[];
        if ((clinics || []).length > 0) {
          hasOtherWorkspacesWithClinics = true;
          break;
        }
      }

      // Business rule: Cannot delete workspace if it's the last one with clinics
      if (!hasOtherWorkspacesWithClinics) {
        return NextResponse.json(
          {
            error: 'Cannot delete the last workspace with clinics. Create another workspace with at least one clinic first.',
            code: 'LAST_WORKSPACE'
          },
          { status: 400 }
        );
      }

      await deleteWorkspaceTreeInConvex(params.id);

      const currentWorkspaceId = cookieStore.get('workspaceId')?.value;
      if (currentWorkspaceId === params.id) {
        const response = NextResponse.json({ success: true });
        response.cookies.delete('workspaceId');
        response.cookies.delete('clinicId');
        return response;
      }

      return NextResponse.json({ success: true });
    }

    // Verificar que el workspace existe. El borrado destructivo queda limitado al owner.
    const { data: existingWorkspace, error: fetchError } = await supabaseAdmin
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !existingWorkspace) {
      return NextResponse.json(
        { error: 'Workspace not found or unauthorized' },
        { status: 404 }
      );
    }

    if (existingWorkspace.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if there are other workspaces with clinics for this user
    const { data: otherWorkspaces, error: wsErr } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .neq('id', params.id);

    if (wsErr) {
      return NextResponse.json(
        { error: 'Failed to check other workspaces', details: wsErr.message },
        { status: 500 }
      );
    }

    let hasOtherWorkspacesWithClinics = false;
    if (otherWorkspaces && otherWorkspaces.length > 0) {
      for (const ws of otherWorkspaces) {
        const { count, error: countErr } = await supabaseAdmin
          .from('clinics')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', ws.id);

        if (!countErr && count && count > 0) {
          hasOtherWorkspacesWithClinics = true;
          break;
        }
      }
    }

    // Business rule: Cannot delete workspace if it's the last one with clinics
    if (!hasOtherWorkspacesWithClinics) {
      return NextResponse.json(
        {
          error: 'Cannot delete the last workspace with clinics. Create another workspace with at least one clinic first.',
          code: 'LAST_WORKSPACE'
        },
        { status: 400 }
      );
    }

    // Eliminar el workspace (esto también eliminará las clínicas asociadas por cascade)
    const { error: deleteError } = await supabaseAdmin
      .from('workspaces')
      .delete()
      .eq('id', params.id)
      .eq('owner_id', user.id);

    if (deleteError) {
      console.error('Error deleting workspace:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete workspace', details: deleteError.message },
        { status: 500 }
      );
    }

    // Si el workspace eliminado era el actual, limpiar la cookie
    const currentWorkspaceId = cookieStore.get('workspaceId')?.value;
    if (currentWorkspaceId === params.id) {
      const response = NextResponse.json({ success: true });
      response.cookies.delete('workspaceId');
      response.cookies.delete('clinicId');
      return response;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/workspaces/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
