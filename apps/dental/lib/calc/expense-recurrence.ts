export const RECURRENCE_INTERVAL_VALUES = ['weekly', 'monthly', 'yearly'] as const

export type ExpenseRecurrenceInterval = typeof RECURRENCE_INTERVAL_VALUES[number]

export function getDefaultRecurrenceDay(
  expenseDate: string,
  interval: ExpenseRecurrenceInterval
): number {
  const dayOfMonth = Number(expenseDate.slice(-2)) || 1
  return interval === 'weekly' ? Math.min(dayOfMonth, 7) : Math.min(dayOfMonth, 31)
}
