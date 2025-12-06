import { useMemo } from 'react'

/**
 * Generic hook for calculating summary metrics from filtered data.
 *
 * This hook provides a consistent way to calculate aggregations (sums, averages,
 * counts, percentages) across all modules that display summary cards.
 *
 * @example
 * ```tsx
 * const summary = useFilteredSummary(filteredTreatments, {
 *   filters: { exclude: (t) => t.status === 'cancelled' },
 *   aggregations: {
 *     totalRevenue: { type: 'sum', field: 'price_cents', condition: (t) => t.status === 'completed' },
 *     completionRate: { type: 'percentage', numerator: 'completedCount', denominator: 'totalCount' }
 *   }
 * })
 * ```
 */

export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'percentage'

export interface AggregationConfig<T> {
  /** Type of aggregation to perform */
  type: AggregationType
  /** Field to aggregate (for sum, avg, min, max) - can be a key or a function */
  field?: keyof T | ((item: T) => number)
  /** Optional condition to filter items before aggregation */
  condition?: (item: T) => boolean
  /** For percentage type: key of another aggregation to use as numerator */
  numerator?: string
  /** For percentage type: key of another aggregation to use as denominator */
  denominator?: string
  /** Default value if calculation results in NaN or undefined */
  defaultValue?: number
}

export interface SummaryConfig<T> {
  /** Global filters applied before any aggregation */
  filters?: {
    /** Exclude items matching this condition */
    exclude?: (item: T) => boolean
    /** Only include items matching this condition */
    include?: (item: T) => boolean
  }
  /** Map of aggregation name to its configuration */
  aggregations: Record<string, AggregationConfig<T>>
}

/**
 * Calculate summary metrics from filtered data using a declarative configuration.
 *
 * @param items - Array of items to aggregate (should already be filtered by UI filters)
 * @param config - Configuration object defining filters and aggregations
 * @returns Object with calculated values for each aggregation
 */
export function useFilteredSummary<T>(
  items: T[],
  config: SummaryConfig<T>
): Record<string, number> {
  return useMemo(() => {
    if (!items || !Array.isArray(items)) {
      // Return default values for all aggregations
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
      if (agg.type === 'percentage') return // Handle in second pass

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

    // Second pass: calculate percentages (depend on other aggregations)
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
  }, [items, config])
}

/**
 * Helper to create a count aggregation config
 */
export function countAgg<T>(condition?: (item: T) => boolean): AggregationConfig<T> {
  return { type: 'count', condition }
}

/**
 * Helper to create a sum aggregation config
 */
export function sumAgg<T>(
  field: keyof T | ((item: T) => number),
  condition?: (item: T) => boolean
): AggregationConfig<T> {
  return { type: 'sum', field, condition }
}

/**
 * Helper to create an average aggregation config
 */
export function avgAgg<T>(
  field: keyof T | ((item: T) => number),
  condition?: (item: T) => boolean,
  defaultValue = 0
): AggregationConfig<T> {
  return { type: 'avg', field, condition, defaultValue }
}

/**
 * Helper to create a percentage aggregation config
 */
export function percentageAgg(
  numerator: string,
  denominator: string,
  defaultValue = 0
): AggregationConfig<any> {
  return { type: 'percentage', numerator, denominator, defaultValue }
}

/**
 * Helper to create a min aggregation config
 */
export function minAgg<T>(
  field: keyof T | ((item: T) => number),
  condition?: (item: T) => boolean,
  defaultValue = 0
): AggregationConfig<T> {
  return { type: 'min', field, condition, defaultValue }
}

/**
 * Helper to create a max aggregation config
 */
export function maxAgg<T>(
  field: keyof T | ((item: T) => number),
  condition?: (item: T) => boolean,
  defaultValue = 0
): AggregationConfig<T> {
  return { type: 'max', field, condition, defaultValue }
}
