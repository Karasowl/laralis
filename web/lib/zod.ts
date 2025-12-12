import { z } from 'zod';

// Validation schema for Organization
export const zOrganization = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  created_at: z.string().optional(),
});

export type ZOrganization = z.infer<typeof zOrganization>;

// Validation schema for Clinic
export const zClinic = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  created_at: z.string().optional(),
});

export type ZClinic = z.infer<typeof zClinic>;

// Validation schema for FixedCost
export const zFixedCost = z.object({
  id: z.string().uuid().optional(),
  clinic_id: z.string().uuid(),
  category: z.string().min(1, 'Category is required'),
  concept: z.string().min(1, 'Concept is required'),
  amount_cents: z.number().int().nonnegative('Amount must be non-negative'),
  created_at: z.string().optional(),
});

export type ZFixedCost = z.infer<typeof zFixedCost>;

// Validation schema for SettingsTime
export const zSettingsTime = z.object({
  id: z.string().uuid().optional(),
  clinic_id: z.string().uuid(),
  work_days: z.number().int().min(1, 'Must be at least 1 day').max(31, 'Cannot exceed 31 days'),
  hours_per_day: z.number().min(1, 'Must be at least 1 hour').max(24, 'Cannot exceed 24 hours'),
  real_pct: z.number().min(0, 'Cannot be negative').max(100, 'Cannot exceed 100%'),
  monthly_goal_cents: z.number().int().positive('Goal must be positive').nullable().optional(),
  updated_at: z.string().optional(),
});

export type ZSettingsTime = z.infer<typeof zSettingsTime>;

// Validation schema for Supply
export const zSupply = z.object({
  id: z.string().uuid().optional(),
  clinic_id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'), // Changed from enum to string to support dynamic categories from DB
  presentation: z.string().min(1, 'Presentation is required'),
  price_cents: z.number().int().nonnegative('Price must be non-negative'),
  portions: z.number().int().positive('Portions must be positive'),
  cost_per_portion_cents: z.number().int().nonnegative('Cost per portion must be non-negative').optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ZSupply = z.infer<typeof zSupply>;

// Validation schema for Service
export const zService = z.object({
  id: z.string().uuid().optional(),
  clinic_id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  est_minutes: z.number().int().positive('Estimated minutes must be positive'),
  category: z.string().optional(),
  description: z.string().nullable().optional(),
  base_price_cents: z.number().int().nonnegative().optional(),
  margin_pct: z.number().nonnegative().optional(),
  created_at: z.string().optional(),
});

export type ZService = z.infer<typeof zService>;

// Validation schema for ServiceSupply
export const zServiceSupply = z.object({
  id: z.string().uuid().optional(),
  clinic_id: z.string().uuid(),
  service_id: z.string().uuid(),
  supply_id: z.string().uuid(),
  qty: z.number().nonnegative('Quantity must be non-negative'),
  created_at: z.string().optional(),
});

export type ZServiceSupply = z.infer<typeof zServiceSupply>;

// Form schemas for client-side (may differ slightly for UX)
export const zFixedCostForm = z.object({
  category: z.string().min(1, 'Category is required'),
  concept: z.string().min(1, 'Concept is required'),
  frequency: z.enum(['monthly', 'weekly', 'biweekly', 'quarterly', 'yearly']).default('monthly'),
  amount_pesos: z
    .coerce
    .number()
    .positive('Amount must be positive')
    // Prevent exceeding Postgres BIGINT limit (9,223,372,036,854,775,807 cents)
    // This is approximately $92,233,720,368,547,758.07 - practically unlimited
    .refine((v) => Math.round(v * 100) <= Number.MAX_SAFE_INTEGER, {
      message: 'Amount too large',
    })
    .transform((pesos) => Math.round(pesos * 100)), // to cents
});

export const zSupplyForm = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'), // Changed from enum to string to support dynamic categories from DB
  presentation: z.string().min(1, 'Presentation is required'),
  price_pesos: z
    .coerce
    .number()
    .positive('Price must be positive')
    .refine((v) => Math.round(v * 100) <= Number.MAX_SAFE_INTEGER, {
      message: 'Price too large',
    }),
  portions: z.coerce.number().int().min(1, 'Portions must be at least 1'),
  // Inventory fields
  stock_quantity: z.coerce.number().int().min(0, 'Stock cannot be negative').optional(),
  min_stock_alert: z.coerce.number().int().min(0, 'Alert threshold cannot be negative').optional(),
});

export const zServiceForm = z.object({
  name: z.string().min(1, 'Name is required'),
  est_minutes: z.coerce.number().int().positive('Duration must be greater than 0')
});

export const zServiceSupplyForm = z.object({
  service_id: z.string().uuid(),
  supply_id: z.string().uuid(),
  qty: z.coerce.number().nonnegative('Quantity must be non-negative')
});

export const zSettingsTimeForm = z.object({
  work_days: z.coerce.number().int().min(1, 'Must be at least 1 day').max(31, 'Cannot exceed 31 days'),
  hours_per_day: z.coerce.number().min(1, 'Must be at least 1 hour').max(24, 'Cannot exceed 24 hours'),
  real_pct: z.coerce.number().min(0, 'Cannot be negative').max(100, 'Cannot exceed 100%'),
  monthly_goal_cents: z.coerce.number().int().positive('Goal must be positive').nullable().optional(),
});

// Validation schema for Asset (server-side)
export const zAsset = z.object({
  id: z.string().uuid().optional(),
  clinic_id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  purchase_price_cents: z.number().int().nonnegative('Price must be non-negative'),
  depreciation_months: z
    .number()
    .int()
    .positive('Months must be positive')
    .refine((value) => value % 12 === 0, { message: 'Months must be a multiple of 12' }),
  purchase_date: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// Form schema for Asset (client-side)
export const zAssetForm = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().optional(),
  purchase_price_pesos: z
    .coerce
    .number()
    .positive('Price must be positive')
    .refine((v) => Math.round(v * 100) <= Number.MAX_SAFE_INTEGER, {
      message: 'Price too large',
    }),
  depreciation_months: z
    .coerce
    .number()
    .int()
    .min(1, 'Months must be at least 1')
    .refine((value) => value % 12 === 0, { message: 'Months must be a multiple of 12' }),
  purchase_date: z.string().optional(),
});

// Validation schema for Patient
export const zPatient = z.object({
  id: z.string().uuid().optional(),
  clinic_id: z.string().uuid(),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  birth_date: z.string().optional(),
  first_visit_date: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  notes: z.string().optional(),
  source_id: z.string().optional(),
  referred_by_patient_id: z.string().optional(),
  campaign_id: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// Form schema for Patient (client-side)
export const zPatientForm = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  birth_date: z.string().optional(),
  first_visit_date: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', '']).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  notes: z.string().optional(),
  source_id: z.string().optional(),
  referred_by_patient_id: z.string().optional(),
  campaign_id: z.string().optional(),
  platform_id: z.string().optional(),
});

export type ZPatient = z.infer<typeof zPatient>;
export type ZPatientForm = z.infer<typeof zPatientForm>;

// API error schema
export const zApiError = z.object({
  error: z.string(),
  message: z.string().optional(),
  details: z.any().optional(),
});
