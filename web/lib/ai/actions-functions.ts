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
  {
    name: 'create_expense',
    description:
      'Create a new expense record. Use this when the user reports a new expense or cost.',
    parameters: {
      type: 'object',
      properties: {
        amount_cents: {
          type: 'integer',
          description: 'The expense amount in cents',
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
          description: 'The date of the expense in ISO format (YYYY-MM-DD)',
        },
      },
      required: ['amount_cents', 'category_id', 'description', 'expense_date'],
    },
  },
  {
    name: 'update_time_settings',
    description:
      'Update the clinic time and productivity settings. Use this when the user wants to adjust work schedule or productivity assumptions.',
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
