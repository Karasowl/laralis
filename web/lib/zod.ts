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
  hours_per_day: z.number().int().min(1, 'Must be at least 1 hour').max(16, 'Cannot exceed 16 hours'),
  real_pct: z.number().min(0, 'Cannot be negative').max(1, 'Cannot exceed 100%'),
  updated_at: z.string().optional(),
});

export type ZSettingsTime = z.infer<typeof zSettingsTime>;

// Validation schema for Supply
export const zSupply = z.object({
  id: z.string().uuid().optional(),
  clinic_id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  category: z.enum(['insumo', 'bioseguridad', 'consumibles', 'materiales', 'medicamentos', 'equipos', 'otros']),
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
  amount_pesos: z.number().positive('Amount must be positive').transform(pesos => Math.round(pesos * 100)), // Convert to cents
});

export const zSupplyForm = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.enum(['insumo', 'bioseguridad', 'consumibles', 'materiales', 'medicamentos', 'equipos', 'otros']),
  presentation: z.string().min(1, 'Presentation is required'),
  price_pesos: z.number().positive('Price must be positive'),
  portions: z.number().int().min(1, 'Portions must be at least 1')
});

export const zServiceForm = z.object({
  name: z.string().min(1, 'Name is required'),
  est_minutes: z.number().int().positive('Duration must be greater than 0')
});

export const zServiceSupplyForm = z.object({
  service_id: z.string().uuid(),
  supply_id: z.string().uuid(),
  qty: z.number().nonnegative('Quantity must be non-negative')
});

export const zSettingsTimeForm = z.object({
  work_days: z.number().int().min(1, 'Must be at least 1 day').max(31, 'Cannot exceed 31 days'),
  hours_per_day: z.number().int().min(1, 'Must be at least 1 hour').max(16, 'Cannot exceed 16 hours'),
  real_pct: z.number().min(0.1, 'Must be at least 10%').max(1, 'Cannot exceed 100%'),
});

// API error schema
export const zApiError = z.object({
  error: z.string(),
  message: z.string().optional(),
  details: z.any().optional(),
});