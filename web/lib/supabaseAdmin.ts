import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseServiceRoleKey) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY not found, falling back to anon key for development');
}

// Cliente con service role key para operaciones admin (solo server-side)
export const supabaseAdmin = createClient(
  supabaseUrl, 
  supabaseServiceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Helper para verificar si estamos usando service role
export const isUsingServiceRole = !!supabaseServiceRoleKey;