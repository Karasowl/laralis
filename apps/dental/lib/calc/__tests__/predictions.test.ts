import { describe, it, expect } from 'vitest'
import {
  groupByMonth,
  calculateLinearTrend,
  projectRevenue,
  calculateConfidence,
  generatePrediction,
} from '../predictions'

describe('predictions', () => {
  describe('groupByMonth', () => {
    it('groups treatments by month and sums revenue', () => {
      const data = [
        { price_cents: 10000, treatment_date: '2024-01-15' },
        { price_cents: 20000, treatment_date: '2024-01-20' },
        { price_cents: 30000, treatment_date: '2024-02-10' },
      ]

      const result = groupByMonth(data)

      expect(result).toEqual([
        { month: '2024-01', revenue: 30000 },
        { month: '2024-02', revenue: 30000 },
      ])
    })

    it('returns empty array for empty input', () => {
      expect(groupByMonth([])).toEqual([])
    })

    it('sorts months chronologically', () => {
      const data = [
        { price_cents: 10000, treatment_date: '2024-03-01' },
        { price_cents: 20000, treatment_date: '2024-01-01' },
        { price_cents: 30000, treatment_date: '2024-02-01' },
      ]

      const result = groupByMonth(data)

      expect(result.map(r => r.month)).toEqual(['2024-01', '2024-02', '2024-03'])
    })
  })

  describe('calculateLinearTrend', () => {
    it('returns stable trend for single data point', () => {
      const result = calculateLinearTrend([{ month: '2024-01', revenue: 50000 }])

      expect(result.slope).toBe(0)
      expect(result.intercept).toBe(50000)
      expect(result.direction).toBe('stable')
    })

    it('detects upward trend', () => {
      const data = [
        { month: '2024-01', revenue: 100000 },
        { month: '2024-02', revenue: 120000 },
        { month: '2024-03', revenue: 140000 },
        { month: '2024-04', revenue: 160000 },
      ]

      const result = calculateLinearTrend(data)

      expect(result.slope).toBeCloseTo(20000, 0)
      expect(result.direction).toBe('up')
    })

    it('detects downward trend', () => {
      const data = [
        { month: '2024-01', revenue: 200000 },
        { month: '2024-02', revenue: 180000 },
        { month: '2024-03', revenue: 160000 },
        { month: '2024-04', revenue: 140000 },
      ]

      const result = calculateLinearTrend(data)

      expect(result.slope).toBeCloseTo(-20000, 0)
      expect(result.direction).toBe('down')
    })

    it('detects stable trend with small variations', () => {
      const data = [
        { month: '2024-01', revenue: 100000 },
        { month: '2024-02', revenue: 105000 },
        { month: '2024-03', revenue: 98000 },
        { month: '2024-04', revenue: 102000 },
      ]

      const result = calculateLinearTrend(data)

      expect(result.direction).toBe('stable')
    })
  })

  describe('projectRevenue', () => {
    it('projects based on trend', () => {
      const trend = { slope: 10000, intercept: 100000, direction: 'up' as const }

      // At month 3, project 2 months ahead to month 5
      const result = projectRevenue(trend, 3, 2)

      // y = 100000 + 10000 * 5 = 150000
      expect(result).toBe(150000)
    })

    it('returns 0 for negative projections', () => {
      const trend = { slope: -50000, intercept: 100000, direction: 'down' as const }

      // At month 5, project 5 months ahead would be negative
      const result = projectRevenue(trend, 5, 5)

      expect(result).toBe(0)
    })
  })

  describe('calculateConfidence', () => {
    it('returns low confidence for < 3 months of data', () => {
      const data = [
        { month: '2024-01', revenue: 100000 },
        { month: '2024-02', revenue: 120000 },
      ]

      expect(calculateConfidence(data)).toBe(30)
    })

    it('returns medium confidence for 3-5 months of data', () => {
      const data = [
        { month: '2024-01', revenue: 100000 },
        { month: '2024-02', revenue: 105000 },
        { month: '2024-03', revenue: 103000 },
      ]

      expect(calculateConfidence(data)).toBe(50)
    })

    it('returns high confidence for consistent data', () => {
      const data = [
        { month: '2024-01', revenue: 100000 },
        { month: '2024-02', revenue: 102000 },
        { month: '2024-03', revenue: 101000 },
        { month: '2024-04', revenue: 99000 },
        { month: '2024-05', revenue: 100500 },
        { month: '2024-06', revenue: 101500 },
      ]

      const confidence = calculateConfidence(data)
      expect(confidence).toBeGreaterThanOrEqual(80)
    })

    it('returns lower confidence for variable data', () => {
      const data = [
        { month: '2024-01', revenue: 50000 },
        { month: '2024-02', revenue: 150000 },
        { month: '2024-03', revenue: 80000 },
        { month: '2024-04', revenue: 200000 },
        { month: '2024-05', revenue: 60000 },
        { month: '2024-06', revenue: 180000 },
      ]

      const confidence = calculateConfidence(data)
      expect(confidence).toBeLessThanOrEqual(60)
    })
  })

  describe('generatePrediction', () => {
    it('returns null for empty data', () => {
      expect(generatePrediction([])).toBeNull()
    })

    it('generates complete prediction for valid data', () => {
      const data = [
        {price_cents:100000,treatment_date:'2024-01-15'},
        { price_cents: 120000, treatment_date: '2024-02-15' },
        { price_cents: 140000, treatment_date: '2024-03-15' },
        { price_cents: 160000, treatment_date: '2024-04-15' },
        { price_cents: 180000, treatment_date: '2024-05-15' },
        { price_cents: 200000, treatment_date: '2024-06-15' },
      ]

      const result = generatePrediction(data)

      expect(result).not.toBeNull()
      expect(result!.nextMonth).toBeGreaterThan(0)
      expect(result!.nextQuarter).toBeGreaterThan(result!.nextMonth)
      expect(result!.confidence).toBeGreaterThan(0)
      expect(result!.trend.direction).toBe('up')
      expect(result!.monthsOfData).toBe(6)
    })

    it('handles single month of data', () => {
      const data = [
        { price_cents: 50000, treatment_date: '2024-01-15' },
        { price_cents: 50000, treatment_date: '2024-01-20' },
      ]

      const result = generatePrediction(data)

      expect(result).not.toBeNull()
      expect(result!.monthsOfData).toBe(1)
      expect(result!.confidence).toBeLessThanOrEqual(30)
    })
  })
})
