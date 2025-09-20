import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiLimiter, authLimiter, strictLimiter } from './rate-limit';

// Helper to check rate limits and return appropriate response
export async function checkRateLimit(
  request: NextRequest,
  limiter = apiLimiter
): Promise<NextResponse | null> {
  const { success, remaining } = await limiter.check(request);

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': remaining.toString(),
          'Retry-After': '60'
        }
      }
    );
  }

  return null;
}

// Helper to validate request body with Zod schema
export function validateRequest<T>(
  body: unknown,
  schema: z.ZodSchema<T>
): { data?: T; error?: NextResponse } {
  try {
    const validated = schema.parse(body);
    return { data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error: NextResponse.json(
          {
            error: 'Invalid request data',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          },
          { status: 400 }
        )
      };
    }
    return {
      error: NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      )
    };
  }
}

// Common schemas for reuse
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20)
});

export const idSchema = z.object({
  id: z.string().uuid('Invalid ID format')
});

export const clinicIdSchema = z.object({
  clinic_id: z.string().uuid('Invalid clinic ID'),
  clinicId: z.string().uuid('Invalid clinic ID').optional()
}).transform(data => ({
  clinic_id: data.clinic_id || data.clinicId
}));

// Money validation (ensure cents)
export const moneySchema = z.number()
  .int('Amount must be in cents')
  .min(0, 'Amount cannot be negative')
  .max(999999999, 'Amount too large');

// Common entity schemas
export const createPatientSchema = z.object({
  clinic_id: z.string().uuid(),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable()
});

export const createSupplySchema = z.object({
  clinic_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  unit: z.string().max(50),
  unit_price_cents: moneySchema,
  current_stock: z.number().int().min(0).default(0),
  min_stock: z.number().int().min(0).default(0),
  category: z.string().max(100).optional().nullable(),
  supplier: z.string().max(200).optional().nullable()
});

export const createServiceSchema = z.object({
  clinic_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  est_minutes: z.number().int().min(1).max(1440),
  price_cents: moneySchema,
  supplies: z.array(z.object({
    supply_id: z.string().uuid(),
    qty: z.number().min(0.01).max(9999)
  })).optional()
});

export const createExpenseSchema = z.object({
  clinic_id: z.string().uuid(),
  description: z.string().min(1).max(500),
  amount_cents: moneySchema,
  expense_date: z.string(),
  category: z.string().max(100).optional().nullable(),
  vendor: z.string().max(200).optional().nullable(),
  invoice_number: z.string().max(100).optional().nullable(),
  payment_method: z.string().max(50).optional().nullable(),
  is_recurring: z.boolean().default(false),
  notes: z.string().max(1000).optional().nullable()
});

export const createTreatmentSchema = z.object({
  clinic_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  service_id: z.string().uuid(),
  treatment_date: z.string(),
  status: z.enum(['pending', 'completed', 'cancelled']).default('pending'),
  price_cents: moneySchema,
  notes: z.string().max(1000).optional().nullable(),
  payment_status: z.enum(['pending', 'partial', 'paid']).optional(),
  snapshot_costs: z.any().optional()
});

// Sanitize string to prevent XSS
export function sanitizeString(str: string, maxLength = 1000): string {
  return str
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim()
    .slice(0, maxLength);
}

// Validate and sanitize search/filter params
export function sanitizeSearchParams(searchParams: URLSearchParams) {
  const cleaned = new URLSearchParams();

  const allowedParams = [
    'page', 'limit', 'search', 'sort', 'order',
    'clinic_id', 'clinicId', 'category', 'status',
    'start_date', 'end_date', 'from', 'to'
  ];

  for (const [key, value] of searchParams.entries()) {
    if (allowedParams.includes(key)) {
      cleaned.set(key, sanitizeString(value, 100));
    }
  }

  return cleaned;
}