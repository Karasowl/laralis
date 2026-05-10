import { describe, expect, it } from 'vitest'
import {
  buildEntityContext,
  getFieldOrder,
  validateEntityData,
} from '@/lib/ai/contexts/EntityContextBuilder'

const entryEntities = [
  'patient',
  'treatment',
  'service',
  'supply',
  'asset',
  'fixedCost',
  'expense',
  'campaign',
  'platform',
  'category',
  'workspace',
  'clinic',
  'timeSetting',
  'patientSource',
] as const

describe('Lara entry context contract', () => {
  it('keeps every conversational field backed by the entity schema', () => {
    for (const entity of entryEntities) {
      const context = buildEntityContext(entity)
      const schemaFields = Object.keys(context.schema)

      for (const field of getFieldOrder(entity)) {
        expect(
          schemaFields,
          `${entity}.${field} must exist in the entry schema`
        ).toContain(field)
      }
    }
  })

  it('uses form-level peso fields for supply and asset entry payloads', () => {
    expect(getFieldOrder('supply')).toContain('price_pesos')
    expect(getFieldOrder('supply')).not.toContain('price_cents')
    expect(getFieldOrder('asset')).toContain('purchase_price_pesos')
    expect(getFieldOrder('asset')).not.toContain('purchase_price_cents')
  })

  it('validates the non-patient entities that Entry Mode exposes most often', () => {
    const examples = {
      service: {
        name: 'QA Profilaxis Lara',
        category: 'preventivo',
        description: 'Servicio QA creado por Lara',
        est_minutes: 45,
        base_price_cents: 2500,
      },
      supply: {
        name: 'QA Resina Lara',
        category: 'material',
        presentation: 'Caja',
        price_pesos: 120,
        portions: 12,
      },
      asset: {
        name: 'QA Lampara Lara',
        category: 'equipo',
        purchase_price_pesos: 12000,
        depreciation_months: 60,
        purchase_date: '2026-05-10',
      },
      fixedCost: {
        category: 'renta',
        concept: 'QA Renta Lara',
        frequency: 'monthly',
        amount_pesos: 5000,
      },
      expense: {
        expense_date: '2026-05-10',
        category: 'Insumos',
        amount_cents: 1100,
        description: 'Compra QA Lara',
        vendor: 'Proveedor QA',
      },
    } as const

    for (const [entity, data] of Object.entries(examples)) {
      expect(validateEntityData(entity as keyof typeof examples, data).valid, entity).toBe(true)
    }
  })
})
