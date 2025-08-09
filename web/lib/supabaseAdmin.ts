import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isConfigured = supabaseUrl !== 'https://placeholder.supabase.co';

if (!isConfigured && typeof window === 'undefined') {
  console.warn('⚠️ Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL to your .env.local file');
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