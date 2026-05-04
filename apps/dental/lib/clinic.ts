import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabaseAdmin';
import { createClient } from './supabase/server';

const CLINIC_COOKIE_NAME = 'clinicId';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ClinicContextSuccess {
  clinicId: string;
  userId: string;
}

export interface ClinicContextError {
  status: number;
  message: string;
}

export function getClinicIdFromCookies(cookieStore: ReturnType<typeof cookies>): string | null {
  const cookie = cookieStore.get(CLINIC_COOKIE_NAME);
  return cookie?.value || null;
}

export function setClinicIdCookie(
  clinicId: string,
  store: ReturnType<typeof cookies> | null = null
) {
  const cookieStore = store ?? cookies();
  cookieStore.set(CLINIC_COOKIE_NAME, clinicId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
}

export function clearClinicIdCookie(store: ReturnType<typeof cookies> | null = null) {
  const cookieStore = store ?? cookies();
  cookieStore.delete(CLINIC_COOKIE_NAME);
}

async function getFirstClinicIdForUser(userId: string): Promise<string | null> {
  const { data: workspaces, error: wsErr } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId);

  if (wsErr || !workspaces || workspaces.length === 0) return null;

  const { data: clinics, error } = await supabaseAdmin
    .from('clinics')
    .select('id, workspace_id')
    .in('workspace_id', workspaces.map(w => w.id))
    .order('created_at', { ascending: true })
    .limit(1);

  if (error || !clinics || clinics.length === 0) return null;
  return clinics[0].id;
}

async function getFirstAccessibleClinicIdForUser(userId: string): Promise<string | null> {

  const workspaceIds = new Set<string>();

  const { data: ownedWorkspaces, error: ownedError } = await supabaseAdmin

    .from('workspaces')

    .select('id')

    .eq('owner_id', userId);



  if (!ownedError) {

    for (const workspace of ownedWorkspaces || []) {

      workspaceIds.add(workspace.id);

    }

  }



  for (const table of ['workspace_users', 'workspace_members']) {

    const { data: memberships, error } = await supabaseAdmin

      .from(table)

      .select('workspace_id')

      .eq('user_id', userId)

      .eq('is_active', true);



    if (error) {

      console.warn(`[clinic] Failed fetching ${table} memberships`, error.message);

      continue;

    }



    for (const membership of memberships || []) {

      if (membership.workspace_id) {

        workspaceIds.add(membership.workspace_id);

      }

    }

  }



  if (workspaceIds.size === 0) return getFirstClinicIdForUser(userId);



  const { data: clinics, error } = await supabaseAdmin

    .from('clinics')

    .select('id, workspace_id')

    .in('workspace_id', Array.from(workspaceIds))

    .order('created_at', { ascending: true })

    .limit(1);



  if (error || !clinics || clinics.length === 0) return null;

  return clinics[0].id;

}



function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

async function hasClinicAccess(
  supabase: ReturnType<typeof createClient>,
  clinicId: string
): Promise<boolean> {
  if (!isUuid(clinicId)) return false;

  const { data, error } = await supabase.rpc('user_has_clinic_access', {
    clinic_id: clinicId,
  });

  if (error) {
    console.error('[clinic] Failed verifying access to clinic', error.message);
    return false;
  }

  return Boolean(data);
}

export async function resolveClinicContext({
  requestedClinicId,
  cookieStore,
}: {
  requestedClinicId?: string | null;
  cookieStore: ReturnType<typeof cookies>;
}): Promise<ClinicContextSuccess | { error: ClinicContextError }> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: { status: 401, message: 'Unauthorized' } };
  }

  const candidateClinicIds: string[] = [];
  const normalizedRequested = requestedClinicId && isUuid(requestedClinicId)
    ? requestedClinicId
    : null;

  if (normalizedRequested) {
    const canAccessRequested = await hasClinicAccess(supabase, normalizedRequested);
    if (!canAccessRequested) {
      return { error: { status: 403, message: 'Clinic access denied' } };
    }
    candidateClinicIds.push(normalizedRequested);
  }

  const cookieClinicId = getClinicIdFromCookies(cookieStore);
  if (isUuid(cookieClinicId) && !candidateClinicIds.includes(cookieClinicId)) {
    candidateClinicIds.push(cookieClinicId);
  }

  if (candidateClinicIds.length === 0) {
    const fallbackClinicId = await getFirstAccessibleClinicIdForUser(user.id);
    if (fallbackClinicId && !candidateClinicIds.includes(fallbackClinicId)) {
      candidateClinicIds.push(fallbackClinicId);
    }
  }

  for (const clinicId of candidateClinicIds) {
    const canAccess = await hasClinicAccess(supabase, clinicId);
    if (canAccess) {
      if (!cookieClinicId || cookieClinicId !== clinicId) {
        setClinicIdCookie(clinicId, cookieStore);
      }
      return { clinicId, userId: user.id };
    }
  }

  if (cookieClinicId) {
    clearClinicIdCookie(cookieStore);
  }

  return { error: { status: 403, message: 'Clinic access denied' } };
}

export async function getClinicIdOrDefault(
  cookieStore: ReturnType<typeof cookies>
): Promise<string | null> {
  const result = await resolveClinicContext({ cookieStore });
  if ('error' in result) {
    return null;
  }
  return result.clinicId;
}
