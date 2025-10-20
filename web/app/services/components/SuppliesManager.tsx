'use client'

import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { InputField, SelectField } from '@/components/ui/form-field'
import { formatCurrency } from '@/lib/money'

interface SuppliesManagerProps {
  supplies: any[]
  serviceSupplies: Array<{ supply_id: string; quantity: number }>
  onAdd: () => void
  onRemove: (index: number) => void
  onUpdate: (index: number, field: 'supply_id' | 'quantity', value: any) => void
  variableCost: number
  t: (key: string) => string
}

export function SuppliesManager({
  supplies,
  serviceSupplies,
  onAdd,
  onRemove,
  onUpdate,
  variableCost,
  t
}: SuppliesManagerProps) {
  // PERFORMANCE FIX: Memoize supply options to avoid calling formatCurrency on every keystroke
  // This was the MAIN CAUSE of lag with 50+ supplies
  const supplyOptions = React.useMemo(
    () => supplies.map((supply: any) => {
      const costCents = supply.cost_per_portion_cents ?? supply.cost_per_unit_cents ?? supply.price_cents ?? 0
      return {
        value: supply.id,
        label: `${supply.name} - ${formatCurrency(costCents)}`
      }
    }),
    [supplies]
  )

  return (
    <div className="space-y-4">
      <Card>
        <div className="p-4 bg-muted">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{t('variable_cost')}</span>
            <span className="text-lg font-bold">{formatCurrency(variableCost)}</span>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        {serviceSupplies.map((ss: any, index: number) => (
          <div key={index} className="flex gap-2 items-center p-2 border rounded-lg">
            <div className="flex-1">
              <SelectField
                value={ss.supply_id}
                onChange={(value) => onUpdate(index, 'supply_id', value)}
                options={supplyOptions}
                placeholder={t('select_supply')}
              />
            </div>
            <div className="w-24">
              <InputField
                type="number"
                value={ss.quantity}
                onChange={(value) => onUpdate(index, 'quantity', parseInt(value as string) || 0)}
                min={0}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={onAdd}
      >
        <Plus className="h-4 w-4 mr-2" />
        {t('add_supply')}
      </Button>
    </div>
  )
}