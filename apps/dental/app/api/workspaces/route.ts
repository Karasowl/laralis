import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { readJson, validateSchema } from '@/lib/validation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getConvexDocumentByLegacyId, listConvexTable, upsertConvexDocumentByLegacyId } from '@/lib/convex/server';
import { seedClinicDefaultsInConvex } from '@/lib/convex/clinic-seed';
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath } from '@/lib/data-backend';
import {
  forbiddenIfMissingWorkspacePermission,
  getAccessibleWorkspaceIds,
  userCanAccessWorkspace,
} from '@/lib/workspace-access';

export const dynamic = 'force-dynamic'

const hiddenWorkspaceStatuses = new Set(['archived', 'pending_deletion', 'deleted']);

function isVisibleWorkspace(workspace: any) {
  const status = workspace?.status || (workspace?.onboarding_completed ? 'active' : 'draft');
  return !hiddenWorkspaceStatuses.has(status);
}

function isActiveWorkspace(workspace: any) {
  const status = workspace?.status || (workspace?.onboarding_completed ? 'active' : 'draft');
  return status === 'active';
}

const workspaceCreateSchema = z.object({
  workspaceName: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  workspaceSlug: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  clinicName: z.string().min(1).optional(),
  clinicAddress: z.string().optional(),
  description: z.string().optional(),
  onboarding_completed: z.boolean().optional(),
  onboarding_step: z.number().int().nonnegative().optional(),
}).refine((data) => Boolean(data.workspaceName || data.name), {
  message: 'workspaceName or name is required',
}).refine((data) => Boolean(data.workspaceSlug || data.slug), {
  message: 'workspaceSlug or slug is required',
});

async function readWorkspaceById(workspaceId: string) {
  if (shouldReturnConvexData('workspaces')) {
    const workspace = await getConvexDocumentByLegacyId('workspaces', workspaceId) as Record<string, any> | null
    return { workspace: workspace ? stripConvexMetadata(workspace) : null, error: null }
  }

  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();

  return { workspace: data, error };
}

async function readWorkspacesByIds(
  workspaceIds: string[],
  options: { ascending?: boolean; limit?: number } = {}
) {
  if (workspaceIds.length === 0) return [] as any[];

  if (shouldReturnConvexData('workspaces')) {
    const idSet = new Set(workspaceIds);
    const rows = await listConvexTable('workspaces', 10000) as Array<Record<string, any>>;
    return rows
      .filter((workspace) => idSet.has(String(workspace.id)))
      .map(stripConvexMetadata)
      .sort((left, right) => compareCreatedAt(left, right, options.ascending ?? true))
      .slice(0, options.limit ?? Number.POSITIVE_INFINITY);
  }

  let query = supabaseAdmin
    .from('workspaces')
    .select('*')
    .in('id', workspaceIds)
    .order('created_at', { ascending: options.ascending ?? true });

  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

function compareCreatedAt(left: any, right: any, ascending: boolean) {
  const leftTime = Date.parse(left.created_at || '') || 0;
  const rightTime = Date.parse(right.created_at || '') || 0;
  return ascending ? leftTime - rightTime : rightTime - leftTime;
}

function stripConvexMetadata(row: Record<string, any>) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row;
  return rest;
}

/**
 * Convex-only write path for POST (DATA_WRITE_MODE_WORKSPACES=convex). Replicates the
 * three Supabase inserts the handler performs — workspaces, optional clinics,
 * workspace_members owner — generating uuid legacyIds and ISO-8601 timestamps that
 * mirror exactly what the Postgres path writes (status/onboarding flags, setup_*
 * timestamps). When a clinic is created, seedClinicDefaultsInConvex reproduces the
 * after_clinic_insert trigger (patient_sources / custom_categories / whatsapp_templates),
 * since the runtime mirror never sees those trigger-generated rows. The returned
 * NextResponse matches the Supabase response shape/cookies exactly.
 */
async function createWorkspaceInConvex(params: {
  userId: string;
  workspaceName: string;
  workspaceSlug: string;
  description?: string;
  clinicName?: string;
  clinicAddress?: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
  now: string;
}) {
  const {
    userId,
    workspaceName,
    workspaceSlug,
    description,
    clinicName,
    clinicAddress,
    onboardingCompleted,
    onboardingStep,
    now,
  } = params;

  const workspaceId = crypto.randomUUID();
  const workspace: Record<string, any> = {
    id: workspaceId,
    name: workspaceName,
    slug: workspaceSlug,
    description: description || `Workspace de ${workspaceName}`,
    owner_id: userId,
    onboarding_completed: onboardingCompleted,
    onboarding_step: onboardingStep,
    status: onboardingCompleted ? 'active' : 'draft',
    setup_started_at: now,
    setup_last_seen_at: now,
    setup_completed_at: onboardingCompleted ? now : null,
    // Postgres column defaults Convex does not fill (the Supabase insert relies on
    // them). created_at drives readWorkspacesByIds' sort; is_active mirrors the default.
    is_active: true,
    created_at: now,
    updated_at: now,
  };
  await upsertConvexDocumentByLegacyId('workspaces', workspaceId, workspace);

  let clinic: Record<string, any> | null = null;
  if (clinicName) {
    const clinicId = crypto.randomUUID();
    clinic = {
      id: clinicId,
      workspace_id: workspaceId,
      name: clinicName,
      address: clinicAddress || null,
      is_active: true,
      created_at: now,
    };
    await upsertConvexDocumentByLegacyId('clinics', clinicId, clinic);

    // Port of after_clinic_insert (patient_sources / custom_categories /
    // whatsapp_templates). Best-effort; never throws.
    await seedClinicDefaultsInConvex(clinicId);
  }

  // Owner membership (best-effort in the Supabase path: a failure there is logged but
  // not fatal because owner_id already grants access). Mirror that leniency here.
  const memberId = crypto.randomUUID();
  try {
    await upsertConvexDocumentByLegacyId('workspace_members', memberId, {
      id: memberId,
      workspace_id: workspaceId,
      user_id: userId,
      role: 'owner',
      clinic_ids: clinic?.id ? [clinic.id] : [],
    });
  } catch (memberError) {
    console.error('Error creating workspace member (convex):', memberError);
  }

  const responseData: any = {
    workspace,
    success: true,
  };

  if (clinic) {
    responseData.clinic = clinic;
  }

  const response = NextResponse.json(responseData);

  response.cookies.set('workspaceId', workspaceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 días
  });

  if (clinic) {
    response.cookies.set('clinicId', clinic.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 días
    });
  }

  return response;
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const { searchParams } = new URL(request.url);
    const listAll = searchParams.get('list') === 'true';
    
    const { user, error: authError } = await getCurrentUser(cookieStore);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const accessibleWorkspaceIds = await getAccessibleWorkspaceIds(user.id);

    // Si se solicita listar todos los workspaces
    if (listAll) {
      if (accessibleWorkspaceIds.length === 0) {
        return NextResponse.json([]);
      }

      const workspaces = await readWorkspacesByIds(accessibleWorkspaceIds, { ascending: false });
      return NextResponse.json(workspaces.filter(isVisibleWorkspace));
    }

    // Comportamiento original para obtener workspace actual
    const workspaceId = cookieStore.get('workspaceId')?.value;

    if (workspaceId) {
      const canAccessWorkspace = await userCanAccessWorkspace(user.id, workspaceId);

      // Verificar que el workspace existe y pertenece al usuario o membresia activa
      const { workspace, error } = await readWorkspaceById(workspaceId);

      if (canAccessWorkspace && !error && workspace && isVisibleWorkspace(workspace)) {
        if (isActiveWorkspace(workspace)) {
          return NextResponse.json({ workspace });
        }

        const activeWorkspaces = accessibleWorkspaceIds.length > 0
          ? (await readWorkspacesByIds(accessibleWorkspaceIds, { ascending: true }))
              .filter((row) => row.onboarding_completed === true)
              .slice(0, 1)
          : [];

        const activeWorkspace = activeWorkspaces?.find(isActiveWorkspace) || activeWorkspaces?.[0];

        if (activeWorkspace) {
          const response = NextResponse.json({ workspace: activeWorkspace });
          response.cookies.set('workspaceId', activeWorkspace.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30,
            path: '/',
          });
          return response;
        }

        return NextResponse.json({ workspace });
      }
    }

    // Buscar workspaces del usuario
    if (accessibleWorkspaceIds.length === 0) {
      return NextResponse.json({ workspace: null });
    }

    const workspaces = await readWorkspacesByIds(accessibleWorkspaceIds, { ascending: true, limit: 20 });

    const visibleWorkspaces = workspaces.filter(isVisibleWorkspace);

    if (visibleWorkspaces.length > 0) {
      const selectedWorkspace = visibleWorkspaces.find(isActiveWorkspace) || visibleWorkspaces[0];
      // Guardar el primer workspace en cookies
      const response = NextResponse.json({ workspace: selectedWorkspace });
      response.cookies.set('workspaceId', selectedWorkspace.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 días
      });
      return response;
    }

    return NextResponse.json({ workspace: null });
  } catch (error) {
    console.error('Unexpected error in GET /api/workspaces:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    
    const { user, error: authError } = await getCurrentUser(cookieStore);

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
    const parsed = validateSchema(workspaceCreateSchema, bodyResult.data);
    if ('error' in parsed) {
      return parsed.error;
    }
    const body = parsed.data;

    const accessibleWorkspaceIds = await getAccessibleWorkspaceIds(user.id);
    if (accessibleWorkspaceIds.length > 0) {
      const existingWorkspaces = await readWorkspacesByIds(accessibleWorkspaceIds);

      const visibleWorkspaces = (existingWorkspaces || []).filter(isVisibleWorkspace);
      const currentWorkspaceId = cookieStore.get('workspaceId')?.value;
      const permissionWorkspace =
        visibleWorkspaces.find(workspace => workspace.id === currentWorkspaceId) ||
        visibleWorkspaces.find(isActiveWorkspace) ||
        visibleWorkspaces[0];

      if (permissionWorkspace) {
        const forbidden = await forbiddenIfMissingWorkspacePermission(
          user.id,
          permissionWorkspace.id,
          'settings.edit'
        );
        if (forbidden) return forbidden;
      }
    }
    
    // Support both formats: onboarding (with clinic) and regular creation (without clinic)
    const workspaceName = body.workspaceName || body.name;
    const workspaceSlug = body.workspaceSlug || body.slug;
    const clinicName = body.clinicName;
    const clinicAddress = body.clinicAddress;
    const description = body.description;
    const onboardingCompleted = body.onboarding_completed !== undefined ? body.onboarding_completed : !!clinicName;
    const onboardingStep = body.onboarding_step !== undefined ? body.onboarding_step : (clinicName ? 3 : 0);
    const now = new Date().toISOString();

    console.info('Creating workspace with data:', { workspaceName, workspaceSlug, clinicName, userId: user.id });

    // Validar datos requeridos
    if (!workspaceName || !workspaceSlug) {
      return NextResponse.json(
        { error: 'Missing required fields', details: { workspaceName: !!workspaceName, workspaceSlug: !!workspaceSlug } },
        { status: 400 }
      );
    }

    if (shouldUseConvexOnlyWritePath('workspaces')) {
      return createWorkspaceInConvex({
        userId: user.id,
        workspaceName,
        workspaceSlug,
        description,
        clinicName,
        clinicAddress,
        onboardingCompleted,
        onboardingStep,
        now,
      });
    }

    // Crear el workspace asociado al usuario autenticado
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .insert({
        name: workspaceName,
        slug: workspaceSlug,
        description: description || `Workspace de ${workspaceName}`,
        owner_id: user.id,
        onboarding_completed: onboardingCompleted,
        onboarding_step: onboardingStep,
        status: onboardingCompleted ? 'active' : 'draft',
        setup_started_at: now,
        setup_last_seen_at: now,
        setup_completed_at: onboardingCompleted ? now : null
      })
      .select()
      .single();

    if (workspaceError) {
      console.error('Error creating workspace:', workspaceError);
      if (workspaceError.code === '23505') {
        return NextResponse.json(
          { error: 'El slug ya está en uso. Por favor elige otro.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to create workspace', details: workspaceError.message || workspaceError },
        { status: 500 }
      );
    }

    console.info('Workspace created successfully:', workspace.id);

    let clinic = null;
    
    // Solo crear la clínica si se proporciona clinicName (durante onboarding)
    if (clinicName) {
      const { data: clinicData, error: clinicError } = await supabaseAdmin
        .from('clinics')
        .insert({
          workspace_id: workspace.id,
          name: clinicName,
          address: clinicAddress || null,
          is_active: true
        })
        .select()
        .single();

      if (clinicError) {
        console.error('Error creating clinic:', clinicError);
        
        // Rollback: eliminar workspace si falla la creación de la clínica
        await supabaseAdmin
          .from('workspaces')
          .delete()
          .eq('id', workspace.id);
        
        return NextResponse.json(
          { error: 'Failed to create clinic', details: (clinicError as any).message || clinicError },
          { status: 500 }
        );
      }
      
      clinic = clinicData;
    }

    // Crear el miembro owner del workspace
    const { error: memberError } = await supabaseAdmin
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'owner',
        clinic_ids: clinic?.id ? [clinic.id] : []
      });

    if (memberError) {
      console.error('Error creating workspace member:', memberError);
      // No es crítico, continuamos ya que owner_id en workspaces es suficiente
    }

    // Establecer cookies para workspace y clinic (si existe)
    const responseData: any = { 
      workspace,
      success: true
    };
    
    if (clinic) {
      responseData.clinic = clinic;
    }
    
    const response = NextResponse.json(responseData);

    response.cookies.set('workspaceId', workspace.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 días
    });

    if (clinic) {
      response.cookies.set('clinicId', clinic.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 días
      });
    }

    return response;
  } catch (error) {
    console.error('Unexpected error in POST /api/workspaces:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as any)?.message },
      { status: 500 }
    );
  }
}
