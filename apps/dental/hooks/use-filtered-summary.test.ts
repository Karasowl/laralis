import { describe, it, expect } from 'vitest'
import {
  countAgg,
  sumAgg,
  avgAgg,
  percentageAgg,
  minAgg,
  maxAgg,
  type SummaryConfig,
  type AggregationConfig,
} from './use-filtered-summary'

// Test interfaces
interface TestItem {
  id: number
  amount_cents: number
  status: 'active' | 'inactive' | 'cancelled'
  category: string
}

// Helper to run the calculation logic (same as the hook's useMemo)
function calculateSummary<T>(
  items: T[],
  config: SummaryConfig<T>
): Record<string, number> {
  if (!items || !Array.isArray(items)) {
    return Object.fromEntries(
      Object.entries(config.aggregations).map(([key, agg]) => [
        key,
        agg.defaultValue ?? 0
      ])
    )
  }

  // Apply global filters first
  let filtered = [...items]

  if (config.filters?.exclude) {
    filtered = filtered.filter(item => !config.filters!.exclude!(item))
  }
  if (config.filters?.include) {
    filtered = filtered.filter(config.filters.include)
  }

  const result: Record<string, number> = {}

  // First pass: calculate non-percentage aggregations
  Object.entries(config.aggregations).forEach(([key, agg]) => {
    if (agg.type === 'percentage') return

    let subset = filtered
    if (agg.condition) {
      subset = subset.filter(agg.condition)
    }

    const getValue = (item: T): number => {
      if (!agg.field) return 0
      if (typeof agg.field === 'function') {
        return agg.field(item) || 0
      }
      const value = item[agg.field]
      return typeof value === 'number' ? value : 0
    }

    switch (agg.type) {
      case 'count':
        result[key] = subset.length
        break

      case 'sum':
        result[key] = subset.reduce((sum, item) => sum + getValue(item), 0)
        break

      case 'avg': {
        const total = subset.reduce((sum, item) => sum + getValue(item), 0)
        result[key] = subset.length > 0 ? total / subset.length : (agg.defaultValue ?? 0)
        break
      }

      case 'min': {
        if (subset.length === 0) {
          result[key] = agg.defaultValue ?? 0
        } else {
          result[key] = Math.min(...subset.map(getValue))
        }
        break
      }

      case 'max': {
        if (subset.length === 0) {
          result[key] = agg.defaultValue ?? 0
        } else {
          result[key] = Math.max(...subset.map(getValue))
        }
        break
      }
    }
  })

  // Second pass: calculate percentages
  Object.entries(config.aggregations).forEach(([key, agg]) => {
    if (agg.type !== 'percentage') return

    const numeratorKey = agg.numerator
    const denominatorKey = agg.denominator

    if (!numeratorKey || !denominatorKey) {
      result[key] = agg.defaultValue ?? 0
      return
    }

    const numerator = result[numeratorKey] ?? 0
    const denominator = result[denominatorKey] ?? 0

    result[key] = denominator > 0 ? (numerator / denominator) * 100 : (agg.defaultValue ?? 0)
  })

  return result
}

describe('use-filtered-summary - Helper Functions', () => {
  describe('countAgg', () => {
    it('should create count aggregation without condition', () => {
      const config = countAgg<TestItem>()
      expect(config.type).toBe('count')
      expect(config.condition).toBeUndefined()
    })

    it('should create count aggregation with condition', () => {
      const config = countAgg<TestItem>((item) => item.status === 'active')
      expect(config.type).toBe('count')
      expect(config.condition).toBeDefined()
      expect(config.condition!({ id: 1, amount_cents: 100, status: 'active', category: 'A' })).toBe(true)
      expect(config.condition!({ id: 2, amount_cents: 100, status: 'inactive', category: 'A' })).toBe(false)
    })
  })

  describe('sumAgg', () => {
    it('should create sum aggregation with field key', () => {
      const config = sumAgg<TestItem>('amount_cents')
      expect(config.type).toBe('sum')
      expect(config.field).toBe('amount_cents')
    })

    it('should create sum aggregation with function field', () => {
      const config = sumAgg<TestItem>((item) => item.amount_cents * 2)
      expect(config.type).toBe('sum')
      expect(typeof config.field).toBe('function')
    })

    it('should create sum aggregation with condition', () => {
      const config = sumAgg<TestItem>('amount_cents', (item) => item.status === 'active')
      expect(config.type).toBe('sum')
      expect(config.condition).toBeDefined()
    })
  })

  describe('avgAgg', () => {
    it('should create avg aggregation with default value', () => {
      const config = avgAgg<TestItem>('amount_cents')
      expect(config.type).toBe('avg')
      expect(config.defaultValue).toBe(0)
    })

    it('should create avg aggregation with custom default value', () => {
      const config = avgAgg<TestItem>('amount_cents', undefined, 100)
      expect(config.type).toBe('avg')
      expect(config.defaultValue).toBe(100)
    })
  })

  describe('percentageAgg', () => {
    it('should create percentage aggregation', () => {
      const config = percentageAgg('completed', 'total')
      expect(config.type).toBe('percentage')
      expect(config.numerator).toBe('completed')
      expect(config.denominator).toBe('total')
    })

    it('should create percentage aggregation with default value', () => {
      const config = percentageAgg('completed', 'total', 50)
      expect(config.defaultValue).toBe(50)
    })
  })

  describe('minAgg', () => {
    it('should create min aggregation', () => {
      const config = minAgg<TestItem>('amount_cents')
      expect(config.type).toBe('min')
      expect(config.defaultValue).toBe(0)
    })
  })

  describe('maxAgg', () => {
    it('should create max aggregation', () => {
      const config = maxAgg<TestItem>('amount_cents')
      expect(config.type).toBe('max')
      expect(config.defaultValue).toBe(0)
    })
  })
})

describe('use-filtered-summary - Calculation Logic', () => {
  const testItems: TestItem[] = [
    { id: 1, amount_cents: 1000, status: 'active', category: 'A' },
    { id: 2, amount_cents: 2000, status: 'active', category: 'B' },
    { id: 3, amount_cents: 3000, status: 'inactive', category: 'A' },
    { id: 4, amount_cents: 4000, status: 'cancelled', category: 'B' },
    { id: 5, amount_cents: 5000, status: 'active', category: 'A' },
  ]

  describe('count aggregation', () => {
    it('should count all items', () => {
      const config: SummaryConfig<TestItem> = {
        aggregations: {
          total: countAgg(),
        }
      }

      const result = calculateSummary(testItems, config)
      expect(result.total).toBe(5)
    })

    it('should count items matching condition', () => {
      const config: SummaryConfig<TestItem> = {
        aggregations: {
          activeCount: countAgg((item) => item.status === 'active'),
        }
      }

      const result = calculateSummary(testItems, config)
      expect(result.activeCount).toBe(3)
    })

    it('should count items after global exclude filter', () => {
      const config: SummaryConfig<TestItem> = {
        filters: {
          exclude: (item) => item.status === 'cancelled',
        },
        aggregations: {
          total: countAgg(),
        }
      }

      const result = calculateSummary(testItems, config)
      expect(result.total).toBe(4) // Excludes cancelled
    })

    it('should count items after global include filter', () => {
      const config: SummaryConfig<TestItem> = {
        filters: {
          include: (item) => item.category === 'A',
        },
        aggregations: {
          total: countAgg(),
        }
      }

      const result = calculateSummary(testItems, config)
      expect(result.total).toBe(3) // Only category A
    })
  })

  describe('sum aggregation', () => {
    it('should sum all values', () => {
      const config: SummaryConfig<TestItem> = {
        aggregations: {
          totalAmount: sumAgg('amount_cents'),
        }
      }

      const result = calculateSummary(testItems, config)
      expect(result.totalAmount).toBe(15000) // 1000+2000+3000+4000+5000
    })

    it('should sum values matching condition', () => {
      const config: SummaryConfig<TestItem> = {
        aggregations: {
          activeAmount: sumAgg('amount_cents', (item) => item.status === 'active'),
        }
      }

      const result = calculateSummary(testItems, config)
      expect(result.activeAmount).toBe(8000) // 1000+2000+5000
    })

    it('should sum with function field', () => {
      const config: SummaryConfig<TestItem> = {
        aggregations: {
          doubleAmount: sumAgg((item) => item.amount_cents * 2),
        }
      }

      const result = calculateSummary(testItems, config)
      expect(result.doubleAmount).toBe(30000)
    })

    it('should sum after global filter', () => {
      const config: SummaryConfig<TestItem> = {
        filters: {
          exclude: (item) => item.status === 'cancelled',
        },
        aggregations: {
          totalAmount: sumAgg('amount_cents'),
        }
      }

      const result = calculateSummary(testItems, config)
      expect(result.totalAmount).toBe(11000) // Excludes 4000
    })
  })

  describe('avg aggregation', () => {
    it('should calculate average', () => {
      const config: SummaryConfig<TestItem> = {
        aggregations: {
          avgAmount: avgAgg('amount_cents'),
        }
      }

      const result = calculateSummary(testItems, config)
      expect(result.avgAmount).toBe(3000) // 15000/5
    })

    it('should calculate average with condition', () => {
      const config: SummaryConfig<TestItem> = {
        aggregations: {
          activeAvg: avgAgg('amount_cents', (item) => item.status === 'active'),
        }
      }

      const result = calculateSummary(testItems, config)
      expect(result.activeAvg).toBeCloseTo(2666.67, 1) // (1000+2000+5000)/3
    })

    it('should return default value for empty set', () => {
      const config: SummaryConfig<TestItem> = {
        aggregations: {
          avgAmount: avgAgg('amount_cents', (item) => item.status === 'nonexistent' as any, 999),
        }
      }

      const result = calculateSummary(testItems, config)
      expect(result.avgAmount).toBe(999)
    })
  })

  describe('min aggregation', () => {
    it('should find minimum value', () => {
      const config: SummaryConfig<TestItem> = {
        aggregations: {
          minAmount: minAgg('amount_cents'),
        }
      }

      const result = calculateSummary(testItems, config)
      expect(result.minAmount).toBe(1000)
    })

    it('should return default for empty set', () => {
      const config: SummaryConfig<TestItem> = {
        aggregations: {
          minAmount: minAgg('amount_cents', (item) => item.status === 'nonexistent' as any, -1),
        }
      }

      const result = calculateSummary(testItems, config)
      expect(result.minAmount).toBe(-1)
    })
  })

  describe('max aggregation', () => {
    it('should find maximum value', () => {
      const config: SummaryConfig<TestItem> = {
        aggregations: {
          maxAmount: maxAgg('amount_cents'),
        }
      }

      const result = calculateSummary(testItems, config)
      expect(result.maxAmount).toBe(5000)
    })
  })

  describe('percentage aggregation', () => {
    it('should calculate percentage from other aggregations', () => {
      const config: SummaryConfig<TestItem> = {
        aggregations: {
          total: countAgg(),
          active: countAgg((item) => item.status === 'active'),
          activeRate: percentageAgg('active', 'total'),
        }
      }

      const result = calculateSummary(testItems, config)
      expect(result.activeRate).toBe(60) // 3/5 * 100
    })

    it('should return default when denominator is zero', () => {
      const config: SummaryConfig<TestItem> = {
        filters: {
          include: () => false, // Filter out everything
        },
        aggregations: {
          total: countAgg(),
          active: countAgg((item) => item.status === 'active'),
          activeRate: percentageAgg('active', 'total', 0),
        }
      }

      const result = calculateSummary([], config)
      expect(result.activeRate).toBe(0)
    })
  })

  describe('combined filters and aggregations', () => {
    it('should apply both exclude filter and condition', () => {
      const config: SummaryConfig<TestItem> = {
        filters: {
          exclude: (item) => item.status === 'cancelled',
        },
        aggregations: {
          total: countAgg(),
          active: countAgg((item) => item.status === 'active'),
          activeRevenue: sumAgg('amount_cents', (item) => item.status === 'active'),
          avgActiveRevenue: avgAgg('amount_cents', (item) => item.status === 'active'),
          completionRate: percentageAgg('active', 'total'),
        }
      }

      const result = calculateSummary(testItems, config)

      // Total excludes cancelled: 4 items
      expect(result.total).toBe(4)

      // Active items: 3
      expect(result.active).toBe(3)

      // Active revenue: 1000+2000+5000
      expect(result.activeRevenue).toBe(8000)

      // Avg active revenue: 8000/3
      expect(result.avgActiveRevenue).toBeCloseTo(2666.67, 1)

      // Completion rate: 3/4 * 100 = 75%
      expect(result.completionRate).toBe(75)
    })
  })

  describe('edge cases', () => {
    it('should handle empty array', () => {
      const config: SummaryConfig<TestItem> = {
        aggregations: {
          total: countAgg(),
          totalAmount: sumAgg('amount_cents'),
          avgAmount: avgAgg('amount_cents'),
        }
      }

      const result = calculateSummary([], config)
      expect(result.total).toBe(0)
      expect(result.totalAmount).toBe(0)
      expect(result.avgAmount).toBe(0)
    })

    it('should handle null/undefined items', () => {
      const config: SummaryConfig<TestItem> = {
        aggregations: {
          total: countAgg(),
        }
      }

      const result = calculateSummary(null as any, config)
      expect(result.total).toBe(0)
    })

    it('should handle single item', () => {
      const config: SummaryConfig<TestItem> = {
        aggregations: {
          total: countAgg(),
          avgAmount: avgAgg('amount_cents'),
        }
      }

      const result = calculateSummary([testItems[0]], config)
      expect(result.total).toBe(1)
      expect(result.avgAmount).toBe(1000)
    })
  })
})

describe('use-filtered-summary - Real-World Scenarios', () => {
  // Treatment-like data
  interface Treatment {
    id: string
    price_cents: number
    status: 'completed' | 'pending' | 'cancelled'
  }

  const treatments: Treatment[] = [
    { id: '1', price_cents: 50000, status: 'completed' },
    { id: '2', price_cents: 30000, status: 'completed' },
    { id: '3', price_cents: 40000, status: 'pending' },
    { id: '4', price_cents: 25000, status: 'cancelled' },
    { id: '5', price_cents: 60000, status: 'completed' },
    { id: '6', price_cents: 35000, status: 'pending' },
  ]

  it('should calculate treatment summary correctly', () => {
    const config: SummaryConfig<Treatment> = {
      filters: {
        exclude: (t) => t.status === 'cancelled',
      },
      aggregations: {
        totalTreatments: countAgg(),
        completedTreatments: countAgg((t) => t.status === 'completed'),
        pendingTreatments: countAgg((t) => t.status === 'pending'),
        totalRevenue: sumAgg('price_cents', (t) => t.status === 'completed'),
        averagePrice: avgAgg('price_cents', (t) => t.status === 'completed'),
        completionRate: percentageAgg('completedTreatments', 'totalTreatments'),
      },
    }

    const result = calculateSummary(treatments, config)

    // 5 treatments (excluding cancelled)
    expect(result.totalTreatments).toBe(5)

    // 3 completed
    expect(result.completedTreatments).toBe(3)

    // 2 pending
    expect(result.pendingTreatments).toBe(2)

    // Revenue from completed: 50000 + 30000 + 60000 = 140000
    expect(result.totalRevenue).toBe(140000)

    // Average completed price: 140000/3
    expect(result.averagePrice).toBeCloseTo(46666.67, 0)

    // Completion rate: 3/5 * 100 = 60%
    expect(result.completionRate).toBe(60)
  })

  // Expense-like data
  interface Expense {
    id: string
    amount_cents: number
    is_recurring: boolean
    category: string
  }

  const expenses: Expense[] = [
    { id: '1', amount_cents: 10000, is_recurring: true, category: 'supplies' },
    { id: '2', amount_cents: 5000, is_recurring: false, category: 'marketing' },
    { id: '3', amount_cents: 15000, is_recurring: true, category: 'utilities' },
    { id: '4', amount_cents: 8000, is_recurring: false, category: 'supplies' },
    { id: '5', amount_cents: 20000, is_recurring: true, category: 'rent' },
  ]

  it('should calculate expense summary correctly', () => {
    const config: SummaryConfig<Expense> = {
      aggregations: {
        totalExpenses: countAgg(),
        totalSpent: sumAgg('amount_cents'),
        recurringCount: countAgg((e) => e.is_recurring === true),
        oneTimeCount: countAgg((e) => e.is_recurring === false),
        averageExpense: avgAgg('amount_cents'),
        recurringPercentage: percentageAgg('recurringCount', 'totalExpenses'),
      },
    }

    const result = calculateSummary(expenses, config)

    expect(result.totalExpenses).toBe(5)
    expect(result.totalSpent).toBe(58000) // 10000+5000+15000+8000+20000
    expect(result.recurringCount).toBe(3)
    expect(result.oneTimeCount).toBe(2)
    expect(result.averageExpense).toBe(11600) // 58000/5
    expect(result.recurringPercentage).toBe(60) // 3/5 * 100
  })
})
