import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isConfigured = supabaseUrl !== 'https://placeholder.supabase.co';

if (!isConfigured && typeof window === 'undefined') {
  console.warn('⚠️ Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL to your .env.local file');
}

// En desarrollo, usamos la anon key si no hay service role key
const keyToUse = supabaseServiceRoleKey || supabaseAnonKey;

if (!keyToUse && typeof window === 'undefined') {
  console.error('❌ No Supabase keys found. Please configure your environment variables.');
}

// Cliente con service role key para operaciones admin (solo server-side)
export const supabaseAdmin = createClient(
  supabaseUrl, 
  keyToUse,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Helper para verificar si estamos usando service role
export const isUsingServiceRole = !!supabaseServiceRoleKey;