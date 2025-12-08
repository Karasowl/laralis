/**
 * Summary Configuration for all modules
 *
 * This file contains declarative configurations for calculating summary metrics
 * across all modules in the application. Each config defines what aggregations
 * to perform on filtered data.
 *
 * @see hooks/use-filtered-summary.ts for the hook implementation
 */

import {
  SummaryConfig,
  countAgg,
  sumAgg,
  avgAgg,
  percentageAgg,
} from '@/hooks/use-filtered-summary'
import type { Treatment } from '@/hooks/use-treatments'
import type { Expense } from '@/lib/types/expenses'
import type { Asset } from '@/lib/types'
import type { FixedCost } from '@/lib/types'

// =============================================================================
// TREATMENTS
// =============================================================================

export interface TreatmentSummary {
  totalTreatments: number
  completedTreatments: number    // All completed (includes refunded) - for completion rate
  successfulTreatments: number   // Completed AND not refunded - for revenue metrics
  pendingTreatments: number
  refundedTreatments: number
  totalRevenue: number
  refundLoss: number
  netRevenue: number
  averagePrice: number
  completionRate: number
}

export const treatmentSummaryConfig: SummaryConfig<Treatment> = {
  filters: {
    // Exclude cancelled treatments from all calculations
    exclude: (t) => t.status === 'cancelled',
  },
  aggregations: {
    // Count of all non-cancelled treatments
    totalTreatments: countAgg(),

    // Count of completed treatments (INCLUDING refunded - they were completed, refund is financial)
    // Used for completion rate: measures "work done" not "revenue earned"
    completedTreatments: countAgg((t) => t.status === 'completed'),

    // Count of successful treatments (completed AND not refunded)
    // Used for revenue calculations - these are the ones that generated income
    successfulTreatments: countAgg((t) => t.status === 'completed' && !t.is_refunded),

    // Count of pending treatments
    pendingTreatments: countAgg((t) => t.status === 'pending'),

    // Count of refunded treatments
    refundedTreatments: countAgg((t) => t.is_refunded === true),

    // Sum of revenue from completed, NON-REFUNDED treatments only
    // Refunded treatments have $0 revenue
    totalRevenue: sumAgg('price_cents', (t) => t.status === 'completed' && !t.is_refunded),

    // Sum of losses from refunded treatments
    // Loss = variable cost + (fixed cost per minute * minutes)
    refundLoss: {
      type: 'sum',
      field: (t) => {
        if (!t.is_refunded) return 0
        const fixedCost = (t.fixed_cost_per_minute_cents || t.fixed_per_minute_cents || 0) * (t.minutes || 0)
        const variableCost = t.variable_cost_cents || 0
        return fixedCost + variableCost
      },
    },

    // Net revenue = totalRevenue - refundLoss
    // Note: This is calculated in post-processing since it depends on other aggregations
    netRevenue: {
      type: 'sum',
      field: (t) => {
        if (t.is_refunded) {
          // Refunded: count as negative loss
          const fixedCost = (t.fixed_cost_per_minute_cents || t.fixed_per_minute_cents || 0) * (t.minutes || 0)
          const variableCost = t.variable_cost_cents || 0
          return -(fixedCost + variableCost)
        }
        if (t.status === 'completed') {
          return t.price_cents || 0
        }
        return 0
      },
    },

    // Average price of completed, non-refunded treatments
    averagePrice: avgAgg('price_cents', (t) => t.status === 'completed' && !t.is_refunded),

    // Completion rate as percentage (excluding refunded from completed count)
    completionRate: percentageAgg('completedTreatments', 'totalTreatments'),
  },
}

// =============================================================================
// EXPENSES
// =============================================================================

export interface ExpenseSummary {
  totalExpenses: number
  totalSpent: number
  recurringCount: number
  oneTimeCount: number
  averageExpense: number
  recurringPercentage: number
}

export const expenseSummaryConfig: SummaryConfig<Expense> = {
  aggregations: {
    // Total count of expenses
    totalExpenses: countAgg(),

    // Sum of all expense amounts
    totalSpent: sumAgg('amount_cents'),

    // Count of recurring expenses
    recurringCount: countAgg((e) => e.is_recurring === true),

    // Count of one-time expenses
    oneTimeCount: countAgg((e) => e.is_recurring === false),

    // Average expense amount
    averageExpense: avgAgg('amount_cents'),

    // Percentage of recurring expenses
    recurringPercentage: percentageAgg('recurringCount', 'totalExpenses'),
  },
}

// =============================================================================
// ASSETS
// =============================================================================

export interface AssetSummary {
  totalAssets: number
  totalInvestment: number
  monthlyDepreciation: number
  averageDepreciationMonths: number
  averageInvestment: number
}

export const assetSummaryConfig: SummaryConfig<Asset> = {
  aggregations: {
    // Total count of assets
    totalAssets: countAgg(),

    // Sum of all purchase prices
    totalInvestment: sumAgg('purchase_price_cents'),

    // Sum of monthly depreciation (purchase_price / depreciation_months)
    monthlyDepreciation: {
      type: 'sum',
      field: (a) => {
        if (!a.depreciation_months || a.depreciation_months <= 0) return 0
        return Math.round(a.purchase_price_cents / a.depreciation_months)
      },
    },

    // Average depreciation period in months
    averageDepreciationMonths: avgAgg('depreciation_months'),

    // Average investment per asset
    averageInvestment: avgAgg('purchase_price_cents'),
  },
}

// =============================================================================
// FIXED COSTS
// =============================================================================

export interface FixedCostSummary {
  totalCosts: number
  totalAmount: number
  averageAmount: number
}

export const fixedCostSummaryConfig: SummaryConfig<FixedCost> = {
  aggregations: {
    // Total count of fixed cost items
    totalCosts: countAgg(),

    // Sum of all fixed cost amounts
    totalAmount: sumAgg('amount_cents'),

    // Average fixed cost amount
    averageAmount: avgAgg('amount_cents'),
  },
}

// =============================================================================
// PATIENTS (per-patient stats from treatments)
// =============================================================================

export interface PatientTreatmentSummary {
  totalTreatments: number
  completedTreatments: number
  refundedTreatments: number
  totalSpent: number
  averageSpent: number
}

/**
 * Config for calculating per-patient summary from their treatments
 * Use this when you have a list of treatments filtered to a single patient
 * Note: Refunded treatments don't count towards spent amount
 */
export const patientTreatmentSummaryConfig: SummaryConfig<Treatment> = {
  filters: {
    exclude: (t) => t.status === 'cancelled',
  },
  aggregations: {
    totalTreatments: countAgg(),
    completedTreatments: countAgg((t) => t.status === 'completed' && !t.is_refunded),
    refundedTreatments: countAgg((t) => t.is_refunded === true),
    // Total spent excludes refunded treatments (money was returned)
    totalSpent: sumAgg('price_cents', (t) => t.status === 'completed' && !t.is_refunded),
    averageSpent: avgAgg('price_cents', (t) => t.status === 'completed' && !t.is_refunded),
  },
}

// =============================================================================
// GENERIC REVENUE/PROFIT CALCULATIONS
// =============================================================================

export interface RevenueSummary {
  totalRevenue: number
  totalCost: number
  totalProfit: number
  profitMargin: number
  averageRevenue: number
}

/**
 * Config for calculating revenue/profit summary from treatments
 * Includes cost and profit calculations
 * IMPORTANT: Excludes refunded treatments from revenue (their revenue = $0)
 *            but includes their costs as losses
 */
export const revenueSummaryConfig: SummaryConfig<Treatment> = {
  filters: {
    // Only include completed, non-cancelled treatments
    include: (t) => t.status === 'completed',
  },
  aggregations: {
    // Revenue only from non-refunded treatments
    totalRevenue: sumAgg('price_cents', (t) => !t.is_refunded),

    // Total costs (includes refunded treatments - those costs were incurred)
    totalCost: {
      type: 'sum',
      field: (t) => {
        const fixedCost = (t.fixed_cost_per_minute_cents || t.fixed_per_minute_cents || 0) * (t.minutes || 0)
        const variableCost = t.variable_cost_cents || 0
        return fixedCost + variableCost
      },
    },

    // Profit excludes refunded treatments from revenue but includes their costs as loss
    totalProfit: {
      type: 'sum',
      field: (t) => {
        const fixedCost = (t.fixed_cost_per_minute_cents || t.fixed_per_minute_cents || 0) * (t.minutes || 0)
        const variableCost = t.variable_cost_cents || 0
        const totalCost = fixedCost + variableCost
        // Refunded: revenue = 0, cost = totalCost, profit = -totalCost (loss)
        if (t.is_refunded) {
          return -totalCost
        }
        return (t.price_cents || 0) - totalCost
      },
    },

    // Average revenue only from non-refunded treatments
    averageRevenue: avgAgg('price_cents', (t) => !t.is_refunded),

    // Note: profitMargin will be calculated as totalProfit/totalRevenue * 100
    // This requires a two-pass calculation which we handle in second pass
    profitMargin: percentageAgg('totalProfit', 'totalRevenue'),
  },
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  SummaryConfig,
  AggregationConfig,
  AggregationType,
} from '@/hooks/use-filtered-summary'
