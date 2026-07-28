import { createClient } from '@supabase/supabase-js';
import { createMirroredSupabaseClient } from '@/lib/convex/supabase-runtime-mirror';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isConfigured = supabaseUrl !== 'https://placeholder.supabase.co';

if (!isConfigured && typeof window === 'undefined') {
  console.warn('⚠️ Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL to your .env.local file');
}

// SECURITY: supabaseAdmin must never be imported or used in the browser
if (typeof window !== 'undefined') {
  throw new Error('SECURITY ERROR: supabaseAdmin is server-only and cannot be used in the browser');
}

// En servidor usamos service role key, en cliente SOLO anon key
const keyToUse = typeof window === 'undefined'
  ? (supabaseServiceRoleKey || supabaseAnonKey)
  : supabaseAnonKey;

if (!keyToUse) {
  console.error('❌ No Supabase keys found. Please configure your environment variables.');
}

// Cliente con service role key para operaciones admin (solo server-side).
// Use a non-empty placeholder key when none is configured so the client constructs
// without throwing "supabaseKey is required" at module load. This keeps routes that
// merely import supabaseAdmin working when Supabase keys are absent (Convex-only /
// decommission scenario). Any actual Supabase call with the placeholder fails at
// use-time, but Convex-only read/write paths never reach Supabase.
export const supabaseAdminRaw = createClient(
  supabaseUrl,
  keyToUse || 'placeholder-anon-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Server-side writes can be mirrored into Convex when DATA_WRITE_MODE=dual.
export const supabaseAdmin = createMirroredSupabaseClient(supabaseAdminRaw);

// Helper para verificar si estamos usando service role
export const isUsingServiceRole = !!supabaseServiceRoleKey;
