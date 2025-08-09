import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabaseAdmin';

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

export async function getFirstClinicIdFromDB(): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('clinics')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) {
    console.error('Error fetching first clinic:', error);
    return null;
  }

  return data.id;
}

export async function getClinicIdOrDefault(cookieStore: ReturnType<typeof cookies>): Promise<string | null> {
  const clinicId = getClinicIdFromCookies(cookieStore);
  if (clinicId) return clinicId;

  // If no clinic ID in cookie, get the first one from DB
  const defaultClinicId = await getFirstClinicIdFromDB();
  if (defaultClinicId) {
    // Note: We can't set cookie here in a GET request, but we'll handle that in the client
    return defaultClinicId;
  }

  return null;
}