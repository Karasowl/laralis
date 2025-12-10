/**
 * MetricTooltip Usage Examples
 *
 * This file shows how to use the MetricTooltip component with translations.
 * DO NOT import this file in production code - it's for reference only.
 */

import { useTranslations } from 'next-intl'
import { MetricTooltip } from './metric-tooltip'

export function MetricTooltipExamples() {
  const t = useTranslations('dashboard.metricTooltips')

  // Example 1: Simple metric with formula and explanation (no values breakdown)
  const grossProfitTooltip = {
    formula: t('grossProfit.formula'),
    explanation: t('grossProfit.explanation'),
  }

  // Example 2: Metric with values breakdown
  const netProfitTooltip = {
    formula: t('netProfit.formula'),
    values: [
      { label: 'Gross Profit', amount: 150000 }, // in cents ($1,500.00)
      { label: 'Fixed Costs', amount: 50000 },   // in cents ($500.00)
    ],
    explanation: t('netProfit.explanation'),
  }

  return (
    <div className="space-y-4">
      {/* Example 1: Without values */}
      <div>
        <MetricTooltip data={grossProfitTooltip}>
          <h3 className="text-lg font-semibold">Gross Profit: $1,500.00</h3>
        </MetricTooltip>
      </div>

      {/* Example 2: With values breakdown */}
      <div>
        <MetricTooltip data={netProfitTooltip}>
          <h3 className="text-lg font-semibold">Net Profit: $1,000.00</h3>
        </MetricTooltip>
      </div>

      {/* Example 3: ROI metric */}
      <div>
        <MetricTooltip
          data={{
            formula: t('roi.formula'),
            values: [
              { label: 'Profit', amount: 50000 },
              { label: 'Cost', amount: 100000 },
            ],
            explanation: t('roi.explanation'),
          }}
        >
          <span className="text-sm text-muted-foreground">ROI: 50%</span>
        </MetricTooltip>
      </div>
    </div>
  )
}
