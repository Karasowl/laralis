import { z } from 'zod'

// Expense categorization for financial analysis
export const VARIABLE_EXPENSE_CATEGORIES = {
  MATERIALS: 'materials',
  LAB_FEES: 'lab_fees',
  SUPPLIES_DENTAL: 'supplies_dental'
} as const

export const FIXED_EXPENSE_CATEGORIES = {
  RENT: 'rent',
  SALARIES: 'salaries',
  UTILITIES: 'utilities',
  INSURANCE: 'insurance',
  SOFTWARE: 'software_subscriptions',
  MARKETING: 'marketing',
  MAINTENANCE: 'maintenance',
  OTHER: 'other'
} as const

export const ALL_EXPENSE_CATEGORIES = {
  ...VARIABLE_EXPENSE_CATEGORIES,
  ...FIXED_EXPENSE_CATEGORIES
} as const

export type ExpenseCategoryType = typeof ALL_EXPENSE_CATEGORIES[keyof typeof ALL_EXPENSE_CATEGORIES]

// Recurrence interval types
export type RecurrenceInterval = 'weekly' | 'monthly' | 'yearly'

// Database types
export interface Expense {
  id: string
  clinic_id: string
  expense_date: string
  category_id?: string
  category: string
  subcategory?: string
  description?: string
  amount_cents: number
  vendor?: string
  invoice_number?: string
  // Optional free-text notes for the expense
  notes?: string
  is_recurring: boolean
  is_variable?: boolean  // True if variable cost (materials, lab fees), false if fixed
  expense_category?: string  // Category: materials, lab_fees, rent, salaries, etc.
  campaign_id?: string
  related_asset_id?: string
  related_supply_id?: string
  quantity?: number
  auto_processed: boolean
  // Recurring expense configuration
  recurrence_interval?: RecurrenceInterval | null  // weekly, monthly, yearly (null from DB)
  recurrence_day?: number | null  // Day of month (1-31) or week (1-7 for weekly)
  next_recurrence_date?: string | null  // Next scheduled generation date
  parent_expense_id?: string  // Reference to template expense (null if template)
  // Budget tracking
  related_fixed_cost_id?: string  // Reference to planned fixed cost for budget vs actual analysis
  created_at: string
  updated_at: string
}

// Expense categories and subcategories
export const EXPENSE_CATEGORIES = {
  EQUIPOS: 'Equipos',
  INSUMOS: 'Insumos', 
  SERVICIOS: 'Servicios',
  MANTENIMIENTO: 'Mantenimiento',
  MARKETING: 'Marketing',
  ADMINISTRATIVOS: 'Administrativos',
  PERSONAL: 'Personal',
  OTROS: 'Otros'
} as const

export const EXPENSE_SUBCATEGORIES = {
  // Equipos
  DENTAL: 'Dental',
  MOBILIARIO: 'Mobiliario',
  TECNOLOGIA: 'Tecnología',
  HERRAMIENTAS: 'Herramientas',
  
  // Insumos
  ANESTESIA: 'Anestesia',
  MATERIALES: 'Materiales',
  LIMPIEZA: 'Limpieza',
  PROTECCION: 'Protección',
  
  // Servicios
  ELECTRICIDAD: 'Electricidad',
  AGUA: 'Agua',
  INTERNET: 'Internet',
  TELEFONO: 'Teléfono',
  GAS: 'Gas',
  
  // Mantenimiento
  EQUIPOS_MANT: 'Equipos',
  INSTALACIONES: 'Instalaciones',
  SOFTWARE: 'Software',
  
  // Marketing
  PUBLICIDAD: 'Publicidad',
  PROMOCIONES: 'Promociones',
  EVENTOS: 'Eventos',
  
  // Administrativos
  PAPELERIA: 'Papelería',
  CONTABILIDAD: 'Contabilidad',
  LEGAL: 'Legal',
  
  // Personal
  NOMINA: 'Nómina',
  BENEFICIOS: 'Beneficios',
  CAPACITACION: 'Capacitación'
} as const

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES
export type ExpenseSubcategory = keyof typeof EXPENSE_SUBCATEGORIES

// Form validation schema (for client-side forms with pesos)
export const expenseFormSchema = z.object({
  expense_date: z.string().min(1, 'La fecha es requerida'),
  category_id: z.string().uuid().optional(),
  category: z.string().min(1, 'La categoría es requerida'),
  subcategory: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  // UX: el formulario trabaja en pesos (número con decimales)
  // La conversión a centavos se hace manualmente en los endpoints API
  amount_pesos: z
    .number({ invalid_type_error: 'El monto debe ser un número' })
    .positive('El monto debe ser mayor a 0')
    .refine((v) => Math.round(v * 100) <= Number.MAX_SAFE_INTEGER, {
      message: 'El monto es demasiado grande',
    }),
  vendor: z.string().optional(),
  invoice_number: z.string().optional(),
  is_recurring: z.boolean().default(false),
  is_variable: z.boolean().default(false),  // For financial analysis categorization
  expense_category: z.string().optional(),  // materials, lab_fees, rent, salaries, etc.
  campaign_id: z.string().uuid().optional(),
  quantity: z.number().int().positive().optional(),
  related_supply_id: z.string().optional(),
  create_asset: z.boolean().default(false),
  asset_name: z.string().optional(),
  asset_useful_life_years: z.number().int().positive().optional(),
  // Recurring expense configuration
  recurrence_interval: z.enum(['weekly', 'monthly', 'yearly']).optional(),
  recurrence_day: z.number().int().min(1).max(31).optional(),
  // Budget tracking
  related_fixed_cost_id: z.string().uuid().optional()
})

export type ExpenseFormData = z.infer<typeof expenseFormSchema>

// Database validation schema (for API with amount_cents)
export const expenseDbSchema = z.object({
  expense_date: z.string().min(1, 'La fecha es requerida'),
  category_id: z.string().uuid().optional(),
  category: z.string().min(1, 'La categoría es requerida'),
  subcategory: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  amount_cents: z.number().int().positive('El monto debe ser mayor a 0'),
  vendor: z.string().optional(),
  invoice_number: z.string().optional(),
  is_recurring: z.boolean().default(false),
  is_variable: z.boolean().default(false),  // For financial analysis categorization
  expense_category: z.string().optional(),  // materials, lab_fees, rent, salaries, etc.
  campaign_id: z.string().uuid().optional(),
  quantity: z.number().int().positive().optional(),
  related_supply_id: z.string().optional(),
  create_asset: z.boolean().default(false),
  asset_name: z.string().optional(),
  asset_useful_life_years: z.number().int().positive().optional(),
  // Recurring expense configuration
  recurrence_interval: z.enum(['weekly', 'monthly', 'yearly']).optional(),
  recurrence_day: z.number().int().min(1).max(31).optional(),
  next_recurrence_date: z.string().optional(),
  parent_expense_id: z.string().uuid().optional(),
  // Budget tracking
  related_fixed_cost_id: z.string().uuid().optional()
})

// API request/response types
export interface CreateExpenseRequest extends Omit<ExpenseFormData, 'create_asset' | 'asset_name' | 'asset_useful_life_years'> {
  clinic_id: string
}

export interface UpdateExpenseRequest extends Partial<CreateExpenseRequest> {
  id: string
}

export interface ExpenseWithRelations extends Expense {
  supply?: {
    id: string
    name: string
    category: string
  }
  asset?: {
    id: string
    name: string
    category: string
  }
  campaign?: {
    id: string
    name: string
    platform_name?: string
  }
}

// Filter and query types
export interface ExpenseFilters {
  category?: string
  subcategory?: string
  vendor?: string
  start_date?: string
  end_date?: string
  min_amount?: number
  max_amount?: number
  is_recurring?: boolean
  auto_processed?: boolean
}

export interface ExpenseStats {
  total_amount: number
  total_count: number
  by_category: Array<{
    category: string
    amount: number
    count: number
    percentage: number
  }>
  by_month: Array<{
    month: string
    amount: number
    count: number
  }>
  vs_fixed_costs: {
    planned: number
    actual: number
    variance: number
    variance_percentage: number
  }
}

// Low stock alert type
export interface LowStockAlert {
  id: string
  name: string
  category: string
  stock_quantity: number
  min_stock_alert: number
  clinic_id: string
  clinic_name: string
}
