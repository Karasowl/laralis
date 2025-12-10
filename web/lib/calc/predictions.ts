/**
 * Revenue prediction calculations using linear regression
 * @module lib/calc/predictions
 */

export interface MonthlyRevenue {
  month: string // YYYY-MM format
  revenue: number // in cents
}

export interface LinearTrend {
  slope: number
  intercept: number
  direction: 'up' | 'down' | 'stable'
}

export interface RevenuePrediction {
  nextMonth: number // cents
  nextQuarter: number // cents
  yearEnd: number // cents
  confidence: number // 0-100
  trend: LinearTrend
  monthsOfData: number
}

/**
 * Group treatments by month and sum revenue
 */
export function groupByMonth(
  data: Array<{ price_cents: number; treatment_date: string }>
): MonthlyRevenue[] {
  const monthMap = new Map<string, number>()

  data.forEach((item) => {
    const month = item.treatment_date.slice(0, 7) // YYYY-MM
    const current = monthMap.get(month) || 0
    monthMap.set(month, current + item.price_cents)
  })

  // Sort by month
  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenue }))
}

/**
 * Calculate linear trend using least squares regression
 * Returns slope (change per month) and intercept
 */
export function calculateLinearTrend(data: MonthlyRevenue[]): LinearTrend {
  const n = data.length

  // Not enough data for regression
  if (n < 2) {
    const lastValue = data[n - 1]?.revenue || 0
    return {
      slope: 0,
      intercept: lastValue,
      direction: 'stable',
    }
  }

  // Least squares regression: y = mx + b
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0

  data.forEach((d, i) => {
    sumX += i
    sumY += d.revenue
    sumXY += i * d.revenue
    sumX2 += i * i
  })

  const denominator = n * sumX2 - sumX * sumX

  // Avoid division by zero
  if (denominator === 0) {
    return {
      slope: 0,
      intercept: sumY / n,
      direction: 'stable',
    }
  }

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  // Determine direction based on slope magnitude (10000 cents = $100)
  // If monthly change is > $100, it's significant
  let direction: 'up' | 'down' | 'stable' = 'stable'
  if (slope > 10000) direction = 'up'
  else if (slope < -10000) direction = 'down'

  return { slope, intercept, direction }
}

/**
 * Project revenue for a specific month index based on trend
 */
export function projectRevenue(
  trend: LinearTrend,
  currentMonthIndex: number,
  monthsAhead: number
): number {
  const projected = trend.intercept + trend.slope * (currentMonthIndex + monthsAhead)
  return Math.max(0, Math.round(projected))
}

/**
 * Project revenue to end of current year
 */
export function projectToYearEnd(
  trend: LinearTrend,
  currentMonthIndex: number,
  currentMonth: number // 1-12
): number {
  const monthsRemaining = 12 - currentMonth
  if (monthsRemaining <= 0) {
    // Already in December, project to next year
    return projectRevenue(trend, currentMonthIndex, 12)
  }

  // Sum projections for each remaining month
  let total = 0
  for (let i = 1; i <= monthsRemaining; i++) {
    total += projectRevenue(trend, currentMonthIndex, i)
  }
  return total
}

/**
 * Calculate confidence score based on data variance
 * Lower variance = higher confidence
 */
export function calculateConfidence(data: MonthlyRevenue[]): number {
  const n = data.length

  // Very low confidence with insufficient data
  if (n < 3) return 30
  if (n < 6) return 50

  // Calculate coefficient of variation (CV)
  const avg = data.reduce((sum, d) => sum + d.revenue, 0) / n

  // Avoid division by zero
  if (avg === 0) return 30

  const variance = data.reduce((sum, d) => sum + Math.pow(d.revenue - avg, 2), 0) / n
  const stdDev = Math.sqrt(variance)
  const cv = stdDev / avg // Coefficient of variation

  // Map CV to confidence score
  // Lower CV = more consistent data = higher confidence
  if (cv < 0.1) return 90 // Very consistent
  if (cv < 0.2) return 80
  if (cv < 0.3) return 70
  if (cv < 0.4) return 60
  if (cv < 0.5) return 50
  return 40 // High variance
}

/**
 * Generate complete revenue prediction
 */
export function generatePrediction(
  treatments: Array<{ price_cents: number; treatment_date: string }>
): RevenuePrediction | null {
  if (!treatments || treatments.length === 0) {
    return null
  }

  const monthlyData = groupByMonth(treatments)

  if (monthlyData.length === 0) {
    return null
  }

  const trend = calculateLinearTrend(monthlyData)
  const currentMonthIndex = monthlyData.length - 1
  const currentMonth = new Date().getMonth() + 1 // 1-12

  return {
    nextMonth: projectRevenue(trend, currentMonthIndex, 1),
    nextQuarter: projectRevenue(trend, currentMonthIndex, 1) +
                 projectRevenue(trend, currentMonthIndex, 2) +
                 projectRevenue(trend, currentMonthIndex, 3),
    yearEnd: projectToYearEnd(trend, currentMonthIndex, currentMonth),
    confidence: calculateConfidence(monthlyData),
    trend,
    monthsOfData: monthlyData.length,
  }
}
