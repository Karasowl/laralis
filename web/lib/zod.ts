import { z } from 'zod';

// Validation schema for FixedCost
export const zFixedCost = z.object({
  id: z.string().uuid().optional(),
  category: z.string().min(1, 'Category is required'),
  concept: z.string().min(1, 'Concept is required'),
  amount_cents: z.number().int().nonnegative('Amount must be non-negative'),
  created_at: z.string().optional(),
});

export type ZFixedCost = z.infer<typeof zFixedCost>;

// Validation schema for SettingsTime
export const zSettingsTime = z.object({
  id: z.string().uuid().optional(),
  work_days: z.number().int().min(1, 'Must be at least 1 day').max(31, 'Cannot exceed 31 days'),
  hours_per_day: z.number().int().min(1, 'Must be at least 1 hour').max(16, 'Cannot exceed 16 hours'),
  real_pct: z.number().min(0, 'Cannot be negative').max(1, 'Cannot exceed 100%'),
  updated_at: z.string().optional(),
});

export type ZSettingsTime = z.infer<typeof zSettingsTime>;

// Form schemas for client-side (may differ slightly for UX)
export const zFixedCostForm = z.object({
  category: z.string().min(1, 'Category is required'),
  concept: z.string().min(1, 'Concept is required'),
  amount_pesos: z.number().positive('Amount must be positive').transform(pesos => Math.round(pesos * 100)), // Convert to cents
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