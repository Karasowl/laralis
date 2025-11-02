/**
 * Centralized Zod schemas for form validation
 * Following DRY principle - all schemas in one place
 */

import { z } from 'zod'

// ==================== AUTH SCHEMAS ====================
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
})

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

// ==================== BUSINESS SCHEMAS ====================
export const workspaceFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().optional(),
  description: z.string().optional()
})

export const clinicFormSchema = z.object({
  name: z.string().min(1, 'Clinic name is required'),
  address: z.string().min(1, 'Address is required'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  tax_id: z.string().optional(),
  license_number: z.string().optional()
})

// ==================== TIME & SETTINGS SCHEMAS ====================
export const dayPatternSchema = z.object({
  monday: z.boolean(),
  tuesday: z.boolean(),
  wednesday: z.boolean(),
  thursday: z.boolean(),
  friday: z.boolean(),
  saturday: z.boolean(),
  sunday: z.boolean()
})

export const detectedPatternFrequencySchema = z.object({
  monday: z.number().min(0).max(1),
  tuesday: z.number().min(0).max(1),
  wednesday: z.number().min(0).max(1),
  thursday: z.number().min(0).max(1),
  friday: z.number().min(0).max(1),
  saturday: z.number().min(0).max(1),
  sunday: z.number().min(0).max(1)
})

export const detectedWorkingDaysSchema = z.object({
  pattern: detectedPatternFrequencySchema,
  confidence: z.number().min(0).max(100),
  sampleSize: z.number().min(0),
  lastUpdated: z.string()
}).nullable()

export const workingDaysConfigSchema = z.object({
  manual: dayPatternSchema,
  detected: detectedWorkingDaysSchema,
  useHistorical: z.boolean()
})

export const timeSettingsSchema = z.object({
  work_days: z.number().min(1).max(31),
  hours_per_day: z.number().min(1).max(24),
  real_pct: z.number().min(1).max(100),
  working_days_config: workingDaysConfigSchema.optional()
})

export const equilibriumSettingsSchema = z.object({
  profitability_target_pct: z.number().min(0).max(100),
  operator_efficiency_pct: z.number().min(0).max(100),
  rent_is_percentage: z.boolean(),
  rent_amount_cents: z.number().min(0).optional(),
  rent_percentage: z.number().min(0).max(100).optional()
})

// ==================== PATIENT SCHEMAS ====================
export const patientSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  birth_date: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  source_id: z.string().optional(),
  first_visit_date: z.string().optional()
})

export const patientSourceSchema = z.object({
  name: z.string().min(1, 'Source name is required'),
  active: z.boolean().default(true)
})

// ==================== SERVICE SCHEMAS ====================
export const serviceSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  category: z.string().default('otros'),
  est_minutes: z.number().min(5, 'Minimum duration is 5 minutes').max(480, 'Maximum duration is 8 hours'),
  base_price_cents: z.number().min(0),
  margin_pct: z.number().min(0).max(500).default(30),
  description: z.string().optional(),
  supplies: z.array(z.object({
    supply_id: z.string(),
    quantity: z.number().optional(),
    qty: z.number().optional()
  })).optional()
})

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  type: z.enum(['service', 'supply', 'expense']).default('service')
})

// ==================== TREATMENT SCHEMAS ====================
export const treatmentFormSchema = z.object({
  patient_id: z.string().min(1, 'Patient is required'),
  service_id: z.string().min(1, 'Service is required'),
  treatment_date: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
  discount_pct: z.number().min(0).max(100).default(0),
  paid: z.boolean().default(false)
})

// ==================== EXPENSE SCHEMAS ====================
export const expenseFormSchema = z.object({
  expense_date: z.string(),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  description: z.string().optional(),
  amount_cents: z.number().min(0),
  vendor: z.string().optional(),
  invoice_number: z.string().optional(),
  is_recurring: z.boolean().default(false),
  quantity: z.number().optional(),
  related_supply_id: z.string().optional(),
  create_asset: z.boolean().optional(),
  asset_name: z.string().optional(),
  asset_useful_life_years: z.number().optional()
})

// ==================== TARIFF SCHEMAS ====================
export const discountConfigSchema = z.object({
  enabled: z.boolean(),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().min(0)
})

export const tariffEditSchema = z.object({
  margin_pct: z.number().min(0).max(1000),
  discount_type: z.enum(['none', 'percentage', 'fixed']).optional(),
  discount_value: z.number().min(0).optional(),
  discount_reason: z.string().optional()
})

export const tariffDiscountSchema = z.object({
  discount_type: z.enum(['none', 'percentage', 'fixed']),
  discount_value: z.number().min(0),
  discount_reason: z.string().optional()
}).refine((data) => {
  if (data.discount_type === 'percentage' && data.discount_value > 100) {
    return false
  }
  return true
}, {
  message: 'Percentage discount cannot exceed 100%',
  path: ['discount_value']
})

export const bulkOperationSchema = z.object({
  operation: z.enum(['increase', 'decrease']),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().min(0)
})

// ==================== MARKETING SCHEMAS ====================
export const platformSchema = z.object({
  name: z.string().min(1, 'Platform name is required'),
  active: z.boolean().default(true)
})

export const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  platform_id: z.string().min(1, 'Platform is required'),
  start_date: z.string(),
  end_date: z.string().optional(),
  budget_cents: z.number().min(0).optional(),
  active: z.boolean().default(true)
})

// ==================== TYPE EXPORTS ====================
export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type WorkspaceFormData = z.infer<typeof workspaceFormSchema>
export type ClinicFormData = z.infer<typeof clinicFormSchema>
export type TimeSettingsData = z.infer<typeof timeSettingsSchema>
export type EquilibriumSettingsData = z.infer<typeof equilibriumSettingsSchema>
export type PatientFormData = z.infer<typeof patientSchema>
export type PatientSourceData = z.infer<typeof patientSourceSchema>
export type ServiceFormData = z.infer<typeof serviceSchema>
export type CategoryData = z.infer<typeof categorySchema>
export type TreatmentFormData = z.infer<typeof treatmentFormSchema>
export type ExpenseFormData = z.infer<typeof expenseFormSchema>
export type DiscountConfigData = z.infer<typeof discountConfigSchema>
export type TariffEditData = z.infer<typeof tariffEditSchema>
export type TariffDiscountData = z.infer<typeof tariffDiscountSchema>
export type BulkOperationData = z.infer<typeof bulkOperationSchema>
export type PlatformData = z.infer<typeof platformSchema>
export type CampaignData = z.infer<typeof campaignSchema>