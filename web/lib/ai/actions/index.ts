/**
 * Actions Index
 *
 * Central export for all action implementations
 */

// Pricing actions (original 5)
export {
  executeUpdateServicePrice,
  executeAdjustServiceMargin,
  executeSimulatePriceChange,
  executeCreateExpense,
  executeUpdateTimeSettings,
} from './pricing-actions'

// Analytics actions (6)
export {
  executeGetBreakEvenAnalysis,
  executeGetTopServices,
  executeGetExpenseBreakdown,
  executeGetServiceProfitability,
  executeIdentifyUnderperformingServices,
  executeComparePeriods,
} from './analytics-actions'

// Operational actions (4)
export {
  executeBulkUpdatePrices,
  executeForecastRevenue,
  executeAnalyzePatientRetention,
  executeOptimizeInventory,
} from './operational-actions'
