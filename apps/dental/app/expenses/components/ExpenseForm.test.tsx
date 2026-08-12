import { render } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'
import { type ExpenseFormData } from '@/lib/types/expenses'
import { ExpenseForm } from './ExpenseForm'
import { getDefaultFormValues } from './useExpenseOptions'

function RecurringExpenseFixture() {
  const form = useForm<ExpenseFormData>({
    defaultValues: {
      ...getDefaultFormValues(),
      is_recurring: true,
      recurrence_interval: 'monthly',
      recurrence_day: 12,
    },
  })

  return (
    <ExpenseForm
      form={form}
      t={(key) => key}
      categoryOptions={[{ value: 'Otros', label: 'Otros' }]}
      getSubcategoriesForCategory={() => []}
      supplyOptions={[]}
      campaignOptions={[]}
      fixedCostOptions={[]}
    />
  )
}

describe('ExpenseForm recurring state', () => {
  it('renders a recurring expense without an empty Radix Select item', () => {
    expect(() => render(<RecurringExpenseFixture />)).not.toThrow()
  })
})
