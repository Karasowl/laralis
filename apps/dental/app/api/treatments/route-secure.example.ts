// EJEMPLO DE CÓMO IMPLEMENTAR RATE LIMITING Y VALIDACIÓN EN TUS APIs
// Copia este patrón en tus route handlers existentes

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  checkRateLimit,
  validateRequest,
  createTreatmentSchema,
  sanitizeSearchParams
} from '@/lib/api-security';
import { apiLimiter } from '@/lib/rate-limit';
import { readJson } from '@/lib/validation';

export async function GET(request: NextRequest) {
  // 1. Check rate limiting
  const rateLimitResponse = await checkRateLimit(request, apiLimiter);
  if (rateLimitResponse) return rateLimitResponse;

  // 2. Sanitize search params
  const searchParams = sanitizeSearchParams(request.nextUrl.searchParams);
  const clinicId = searchParams.get('clinic_id');

  if (!clinicId) {
    return NextResponse.json(
      { error: 'clinic_id is required' },
      { status: 400 }
    );
  }

  // 3. Get authenticated user
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // 4. Query with RLS (Row Level Security handles access control)
  const { data, error } = await supabase
    .from('treatments')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch treatments' },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  // 1. Check rate limiting (stricter for POST)
  const rateLimitResponse = await checkRateLimit(request, apiLimiter);
  if (rateLimitResponse) return rateLimitResponse;

  // 2. Parse and validate request body
  const bodyResult = await readJson(request);
  if ('error' in bodyResult) {
    return bodyResult.error;
  }
  const body = bodyResult.data;

  // 3. Validate with Zod schema
  const { data: validatedData, error: validationError } = validateRequest(
    body,
    createTreatmentSchema
  );

  if (validationError) {
    return validationError;
  }

  // 4. Get authenticated user
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // 5. Insert with RLS protection
  const { data, error } = await supabase
    .from('treatments')
    .insert([validatedData])
    .select()
    .single();

  if (error) {
    // Check for specific errors
    if (error.code === '42501') {
      return NextResponse.json(
        { error: 'You do not have access to this clinic' },
        { status: 403 }
      );
    }

    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to create treatment' },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}

// APIs críticas que DEBEN tener rate limiting más estricto:
//
// 1. /api/auth/* - Login, registro, reset password (usar authLimiter - 5 req/5min)
// 2. /api/treatments - Creación de tratamientos (apiLimiter - 100 req/min)
// 3. /api/expenses - Creación de gastos (apiLimiter)
// 4. /api/patients - CRUD de pacientes (apiLimiter)
// 5. /api/onboarding - Setup inicial (strictLimiter - 10 req/min)
// 6. /api/account/delete - Eliminación de cuenta (strictLimiter)
// 7. /api/reset - Reset de datos (strictLimiter)
// 8. /api/workspaces - Creación de workspaces (strictLimiter)
