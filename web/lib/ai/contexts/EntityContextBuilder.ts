/**
 * Entity Context Builder
 *
 * Automatically builds AI context from Zod schemas
 * Enables dynamic form generation for all entities
 */

import { z } from 'zod'
import type { EntryContext } from '../types'

// Import all Zod schemas from both files
import {
  patientSchema,
  serviceSchema,
  treatmentFormSchema,
  expenseFormSchema,
  categorySchema,
  platformSchema,
  campaignSchema,
  patientSourceSchema,
  workspaceFormSchema,
  clinicFormSchema,
  timeSettingsSchema,
  equilibriumSettingsSchema,
} from '@/lib/schemas'

import {
  zSupplyForm,
  zAssetForm,
  zFixedCostForm,
} from '@/lib/zod'

type EntityType =
  | 'patient'
  | 'treatment'
  | 'service'
  | 'supply'
  | 'asset'
  | 'fixedCost'
  | 'expense'
  | 'campaign'
  | 'platform'
  | 'category'
  | 'workspace'
  | 'clinic'
  | 'timeSetting'
  | 'patientSource'

/**
 * Entity schema registry
 * All schemas now properly mapped!
 */
const ENTITY_SCHEMAS: Record<EntityType, z.ZodObject<any>> = {
  patient: patientSchema,
  treatment: treatmentFormSchema,
  service: serviceSchema,
  supply: zSupplyForm,
  asset: zAssetForm,
  fixedCost: zFixedCostForm,
  expense: expenseFormSchema,
  campaign: campaignSchema,
  platform: platformSchema,
  category: categorySchema,
  workspace: workspaceFormSchema,
  clinic: clinicFormSchema,
  timeSetting: timeSettingsSchema,
  patientSource: patientSourceSchema,
}

interface FieldMetadata {
  type: string
  required: boolean
  validation?: string
  options?: Array<{ value: string; label: string }>
}

/**
 * Parse Zod schema to extract field metadata
 */
function parseZodSchema(schema: z.ZodObject<any>): Record<string, FieldMetadata> {
  const shape = schema.shape
  const fields: Record<string, FieldMetadata> = {}

  for (const [key, zodType] of Object.entries(shape)) {
    const field: FieldMetadata = {
      type: 'text',
      required: true,
    }

    // Detect type
    if (zodType instanceof z.ZodString) {
      field.type = 'text'
      field.required = !zodType.isOptional()

      // Check for email validation
      const checks = (zodType as any)._def?.checks || []
      if (checks.some((c: any) => c.kind === 'email')) {
        field.type = 'email'
      }
    } else if (zodType instanceof z.ZodNumber) {
      field.type = 'number'
      field.required = !zodType.isOptional()
    } else if (zodType instanceof z.ZodEnum) {
      field.type = 'select'
      field.required = !zodType.isOptional()
      field.options = zodType._def.values.map((v: string) => ({
        value: v,
        label: v,
      }))
    } else if (zodType instanceof z.ZodOptional) {
      field.required = false
      // Unwrap and recurse
      const innerType = zodType._def.innerType
      if (innerType instanceof z.ZodString) {
        field.type = 'text'
      } else if (innerType instanceof z.ZodNumber) {
        field.type = 'number'
      }
    }

    fields[key] = field
  }

  return fields
}

/**
 * Build AI context for entity entry
 */
export function buildEntityContext(
  entityType: EntityType,
  currentField?: string,
  collectedData?: Record<string, any>,
  locale: string = 'es'
): EntryContext {
  const schema = ENTITY_SCHEMAS[entityType]
  if (!schema) {
    throw new Error(`Unknown entity type: ${entityType}`)
  }

  const fields = parseZodSchema(schema)

  return {
    entityType,
    schema: fields,
    currentField,
    collectedData,
    locale,
  }
}

/**
 * Get field order for entity (defines conversation flow)
 */
export function getFieldOrder(entityType: EntityType): string[] {
  const fieldOrders: Record<EntityType, string[]> = {
    patient: [
      'first_name',
      'last_name',
      'phone',
      'email',
      'birth_date',
      'gender',
      'address',
      'notes',
    ],
    treatment: [
      'patient_id',
      'service_id',
      'treatment_date',
      'minutes',
      'notes',
    ],
    service: [
      'name',
      'category',
      'description',
      'est_minutes',
      'base_price_cents',
    ],
    supply: [
      'name',
      'category',
      'presentation',
      'price_cents',
      'portions',
    ],
    asset: [
      'name',
      'category',
      'purchase_price_cents',
      'depreciation_months',
      'purchase_date',
    ],
    fixedCost: [
      'category',
      'concept',
      'frequency',
      'amount_pesos',
    ],
    expense: [
      'expense_date',
      'category',
      'amount_cents',
      'description',
      'vendor',
    ],
    campaign: [
      'name',
      'platform_id',
      'start_date',
      'end_date',
      'budget_cents',
    ],
    platform: ['name'],
    category: ['name', 'type'],
    workspace: ['name', 'description'],
    clinic: ['name', 'address', 'phone', 'email'],
    timeSetting: ['work_days', 'hours_per_day', 'real_pct'],
    patientSource: ['name'],
  }

  return fieldOrders[entityType] || []
}

/**
 * Validate collected data against schema
 */
export function validateEntityData(
  entityType: EntityType,
  data: Record<string, any>
): { valid: boolean; errors: string[] } {
  const schema = ENTITY_SCHEMAS[entityType]
  if (!schema) {
    return { valid: false, errors: [`Unknown entity: ${entityType}`] }
  }

  try {
    schema.parse(data)
    return { valid: true, errors: [] }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      }
    }
    return { valid: false, errors: ['Validation failed'] }
  }
}

/**
 * Get entity display name (for UI)
 */
export function getEntityDisplayName(entityType: EntityType, locale: string = 'es'): string {
  const names: Record<EntityType, { es: string; en: string }> = {
    patient: { es: 'Paciente', en: 'Patient' },
    treatment: { es: 'Tratamiento', en: 'Treatment' },
    service: { es: 'Servicio', en: 'Service' },
    supply: { es: 'Insumo', en: 'Supply' },
    asset: { es: 'Activo', en: 'Asset' },
    fixedCost: { es: 'Costo Fijo', en: 'Fixed Cost' },
    expense: { es: 'Gasto', en: 'Expense' },
    campaign: { es: 'Campaña', en: 'Campaign' },
    platform: { es: 'Plataforma', en: 'Platform' },
    category: { es: 'Categoría', en: 'Category' },
    workspace: { es: 'Espacio de Trabajo', en: 'Workspace' },
    clinic: { es: 'Clínica', en: 'Clinic' },
    timeSetting: { es: 'Configuración de Tiempo', en: 'Time Setting' },
    patientSource: { es: 'Fuente de Paciente', en: 'Patient Source' },
  }

  return names[entityType]?.[locale as 'es' | 'en'] || entityType
}

/**
 * Get API endpoint for entity
 */
export function getEntityEndpoint(entityType: EntityType): string {
  const endpoints: Record<EntityType, string> = {
    patient: '/api/patients',
    treatment: '/api/treatments',
    service: '/api/services',
    supply: '/api/supplies',
    asset: '/api/assets',
    fixedCost: '/api/fixed-costs',
    expense: '/api/expenses',
    campaign: '/api/marketing/campaigns',
    platform: '/api/marketing/platforms',
    category: '/api/categories',
    workspace: '/api/workspaces',
    clinic: '/api/clinics',
    timeSetting: '/api/settings/time',
    patientSource: '/api/patient-sources',
  }

  return endpoints[entityType]
}
