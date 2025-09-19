import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabaseAdmin';
import { createClient } from './supabase/server';

const CLINIC_COOKIE_NAME = 'clinicId';

export function getClinicIdFromCookies(cookieStore: ReturnType<typeof cookies>): string | null {
  const cookie = cookieStore.get(CLINIC_COOKIE_NAME);
  return cookie?.value || null;
}

export function setClinicIdCookie(clinicId: string) {
  const cookieStore = cookies();
  cookieStore.set(CLINIC_COOKIE_NAME, clinicId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
}

// Deprecated: do not expose a global fallback clinic. Keeping for compatibility, but unused.
async function getFirstClinicIdForUser(userId: string): Promise<string | null> {
  // Pick the first clinic from any workspace owned by the user
  const { data: workspaces, error: wsErr } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)

  if (wsErr || !workspaces || workspaces.length === 0) return null;

  const { data: clinics, error } = await supabaseAdmin
    .from('clinics')
    .select('id, workspace_id')
    .in('workspace_id', workspaces.map(w => w.id))
    .order('created_at', { ascending: true })
    .limit(1)

  if (error || !clinics || clinics.length === 0) return null;
  return clinics[0].id;
}

export async function getClinicIdOrDefault(cookieStore: ReturnType<typeof cookies>): Promise<string | null> {
  // Prefer authenticated context when available
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  const cookieClinicId = getClinicIdFromCookies(cookieStore);

  if (cookieClinicId) {
    if (userId) {
      // Validate that cookie clinic belongs to user's workspace
      const { data: clinic, error } = await supabaseAdmin
        .from('clinics')
        .select('id, workspace_id')
        .eq('id', cookieClinicId)
        .single();
      if (!error && clinic) {
        const { data: ws, error: wsErr } = await supabaseAdmin
          .from('workspaces')
          .select('id')
          .eq('id', clinic.workspace_id)
          .eq('owner_id', userId)
          .single();
        if (!wsErr && ws) return cookieClinicId;
      }
    } else {
      // No user session: accept cookie clinic as-is (dev/local friendly)
      return cookieClinicId;
    }
  }

  if (userId) {
    const fallback = await getFirstClinicIdForUser(userId);
    if (fallback) return fallback;
  }
  // No valid clinic context
  return null;
}
