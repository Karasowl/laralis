import { z } from 'zod'

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
  campaign_id?: string
  related_asset_id?: string
  related_supply_id?: string
  quantity?: number
  auto_processed: boolean
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

// Form validation schemas
export const expenseFormSchema = z.object({
  expense_date: z.string().min(1, 'La fecha es requerida'),
  category_id: z.string().uuid().optional(),
  category: z.string().min(1, 'La categoría es requerida'),
  subcategory: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  // UX: el formulario trabaja en pesos (número con decimales),
  // pero transformamos a centavos como entero para el backend
  amount_pesos: z
    .number({ invalid_type_error: 'El monto debe ser un número' })
    .positive('El monto debe ser mayor a 0')
    .transform((pesos) => Math.round(pesos * 100)),
  vendor: z.string().optional(),
  invoice_number: z.string().optional(),
  is_recurring: z.boolean().default(false),
  campaign_id: z.string().uuid().optional(),
  quantity: z.number().int().positive().optional(),
  related_supply_id: z.string().optional(),
  create_asset: z.boolean().default(false),
  asset_name: z.string().optional(),
  asset_useful_life_years: z.number().int().positive().optional()
})

export type ExpenseFormData = z.infer<typeof expenseFormSchema>

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
