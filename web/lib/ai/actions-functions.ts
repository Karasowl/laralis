/**
 * AI Function Definitions for Actions System
 *
 * These functions are provided to the LLM (Lara) so she can suggest actions
 * to execute on behalf of the user.
 */

import type { AIFunction } from './types'

/**
 * Available actions as AI functions
 * Each function maps to an action type in the Actions System
 */
export const ACTION_FUNCTIONS: AIFunction[] = [
  {
    name: 'update_service_price',
    description:
      'Update the price of a service. Use this when the user wants to change a service price or when you detect a pricing issue and suggest a correction.',
    parameters: {
      type: 'object',
      properties: {
        service_id: {
          type: 'string',
          description: 'The ID of the service to update',
        },
        new_price_cents: {
          type: 'integer',
          description: 'The new price in cents (e.g., 10000 for $100.00)',
        },
        reason: {
          type: 'string',
          description: 'Optional reason for the price change (e.g., "Market adjustment", "Cost increase")',
        },
      },
      required: ['service_id', 'new_price_cents'],
    },
  },
  {
    name: 'adjust_service_margin',
    description:
      'Adjust the margin (markup) of a service to hit a target percentage. Use this when the user wants to adjust profitability.',
    parameters: {
      type: 'object',
      properties: {
        service_id: {
          type: 'string',
          description: 'The ID of the service to adjust',
        },
        target_margin_pct: {
          type: 'number',
          description: 'The target margin percentage (e.g., 50 for 50% markup)',
        },
        adjust_price: {
          type: 'boolean',
          description: 'If true, adjust the price to achieve the target margin. If false, just calculate what the price should be.',
        },
      },
      required: ['service_id', 'target_margin_pct'],
    },
  },
  {
    name: 'simulate_price_change',
    description:
      'Simulate a price change across services to see the impact on revenue and profitability. Use this for "what-if" scenarios.',
    parameters: {
      type: 'object',
      properties: {
        service_id: {
          type: 'string',
          description: 'Optional: The ID of a specific service. If null, applies to all services.',
        },
        change_type: {
          type: 'string',
          enum: ['percentage', 'fixed'],
          description: 'Type of change: "percentage" for % increase/decrease, "fixed" for absolute amount',
        },
        change_value: {
          type: 'number',
          description: 'The change amount (e.g., 10 for 10% or $10 depending on change_type)',
        },
      },
      required: ['change_type', 'change_value'],
    },
  },
  // ============================================================================
  // DATA ENTRY ACTIONS
  // ============================================================================
  {
    name: 'create_expense',
    description:
      'Create a new expense record. Use this when the user reports a new expense or cost. Example: "Gasté $500 en material dental"',
    parameters: {
      type: 'object',
      properties: {
        amount_cents: {
          type: 'integer',
          description: 'The expense amount in cents (e.g., 50000 for $500.00)',
        },
        category_id: {
          type: 'string',
          description: 'The ID of the expense category',
        },
        description: {
          type: 'string',
          description: 'Description of the expense',
        },
        expense_date: {
          type: 'string',
          description: 'The date of the expense in ISO format (YYYY-MM-DD). Use today if not specified.',
        },
      },
      required: ['amount_cents', 'category_id', 'description', 'expense_date'],
    },
  },
  {
    name: 'update_time_settings',
    description:
      'Update the clinic time and productivity settings. Use when user wants to change work schedule. Example: "Ahora trabajo 6 horas diarias"',
    parameters: {
      type: 'object',
      properties: {
        work_days: {
          type: 'integer',
          description: 'Number of work days per month (1-31)',
        },
        hours_per_day: {
          type: 'integer',
          description: 'Hours worked per day (1-24)',
        },
        real_productivity_pct: {
          type: 'integer',
          description: 'Real productivity percentage (1-100). Accounts for breaks, admin time, etc.',
        },
      },
      required: [],
    },
  },

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================
  {
    name: 'bulk_update_prices',
    description:
      'Apply a price change to multiple services at once. Use this when user wants to increase or decrease prices across the board. Example: "Sube todos los precios 10%"',
    parameters: {
      type: 'object',
      properties: {
        change_type: {
          type: 'string',
          enum: ['percentage', 'fixed'],
          description: 'Type of change: "percentage" for % increase/decrease, "fixed" for absolute amount in cents',
        },
        change_value: {
          type: 'number',
          description: 'The change amount (e.g., 10 for 10% or 1000 for $10.00 depending on change_type)',
        },
        service_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Specific service IDs to update. If omitted, applies to all services.',
        },
        category: {
          type: 'string',
          description: 'Optional: Filter services by category name',
        },
      },
      required: ['change_type', 'change_value'],
    },
  },

  // ============================================================================
  // ANALYTICS & FORECASTING
  // ============================================================================
  {
    name: 'forecast_revenue',
    description:
      'Forecast expected revenue for the next N days based on historical trends. Use when user asks about future projections. Example: "¿Cuánto voy a ganar el próximo mes?"',
    parameters: {
      type: 'object',
      properties: {
        days: {
          type: 'integer',
          description: 'Number of days to forecast (default: 30)',
        },
        include_treatments: {
          type: 'boolean',
          description: 'Include treatment-level breakdown in forecast',
        },
        include_trends: {
          type: 'boolean',
          description: 'Include trend analysis (growth rate, seasonality)',
        },
      },
      required: [],
    },
  },
  {
    name: 'identify_underperforming_services',
    description:
      'Find services with margins below a threshold and get pricing suggestions. Use when user asks about unprofitable services. Example: "¿Qué servicios no son rentables?"',
    parameters: {
      type: 'object',
      properties: {
        min_margin_pct: {
          type: 'number',
          description: 'Minimum acceptable margin percentage (default: 30). Services below this are "underperforming".',
        },
        include_suggestions: {
          type: 'boolean',
          description: 'Include pricing suggestions to improve margins (default: true)',
        },
      },
      required: [],
    },
  },
  {
    name: 'analyze_patient_retention',
    description:
      'Analyze patient retention and return rates with detailed cohort analysis. Use when user asks about patient loyalty. Example: "¿Cuántos pacientes regresan?"',
    parameters: {
      type: 'object',
      properties: {
        period_days: {
          type: 'integer',
          description: 'Analysis period in days (default: 90)',
        },
        cohort_type: {
          type: 'string',
          enum: ['monthly', 'quarterly'],
          description: 'How to group patients for cohort analysis',
        },
      },
      required: [],
    },
  },
  {
    name: 'optimize_inventory',
    description:
      'Analyze supply usage and recommend reorder points. Use when user asks about inventory or what to restock. Example: "¿Qué insumos necesito pedir?"',
    parameters: {
      type: 'object',
      properties: {
        days_ahead: {
          type: 'integer',
          description: 'Days ahead to forecast supply needs (default: 30)',
        },
        reorder_threshold_pct: {
          type: 'number',
          description: 'Alert when stock falls below this percentage of monthly usage (default: 25)',
        },
      },
      required: [],
    },
  },
  {
    name: 'compare_periods',
    description:
      'Compare metrics between TWO SPECIFIC time periods. ONLY use when user provides specific dates. Example: "Compara enero vs febrero 2024"',
    parameters: {
      type: 'object',
      properties: {
        period1_start: {
          type: 'string',
          description: 'Start date of first period (ISO format: YYYY-MM-DD)',
        },
        period1_end: {
          type: 'string',
          description: 'End date of first period (ISO format: YYYY-MM-DD)',
        },
        period2_start: {
          type: 'string',
          description: 'Start date of second period (ISO format: YYYY-MM-DD)',
        },
        period2_end: {
          type: 'string',
          description: 'End date of second period (ISO format: YYYY-MM-DD)',
        },
        metrics: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['revenue', 'expenses', 'treatments', 'patients'],
          },
          description: 'Which metrics to compare (default: all)',
        },
      },
      required: ['period1_start', 'period1_end', 'period2_start', 'period2_end'],
    },
  },

  // ============================================================================
  // NOTE: The following query functions were REMOVED because Lara has this
  // data in the snapshot and should answer these questions directly:
  //
  // - get_break_even_analysis: Data in snapshot.analytics.break_even
  // - get_service_profitability: Data in snapshot.services with margin_pct
  // - get_expense_breakdown: Data in snapshot.expenses.by_category
  // - get_top_services: Data in snapshot.analytics.top_performers
  //
  // Lara should ONLY suggest actions for:
  // 1. MODIFYING data (create_expense, update prices, etc.)
  // 2. COMPLEX ANALYSIS not in snapshot (forecasts, cohort analysis, etc.)
  // ============================================================================
]

/**
 * Get action function by name
 */
export function getActionFunction(name: string): AIFunction | undefined {
  return ACTION_FUNCTIONS.find(fn => fn.name === name)
}

/**
 * Check if a function name is an action function
 */
export function isActionFunction(name: string): boolean {
  return ACTION_FUNCTIONS.some(fn => fn.name === name)
}
