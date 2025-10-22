import { describe, it, expect } from 'vitest'
import {
  calculateCAC,
  calculateLTV,
  calculateROI,
  calculateConversionRate,
  calculateLTVCACRatio,
  getLTVCACRatioQuality,
  calculateTargetCAC,
  calculateGrowthRate,
  calculatePaybackPeriod
} from './marketing'

describe('Marketing Calculations', () => {
  describe('calculateCAC', () => {
    it('should calculate CAC correctly', () => {
      // $10,000 / 20 pacientes = $500 CAC
      expect(calculateCAC(1000000, 20)).toBe(50000)
    })

    it('should return 0 when no patients', () => {
      expect(calculateCAC(1000000, 0)).toBe(0)
    })

    it('should return 0 when negative patients', () => {
      expect(calculateCAC(1000000, -5)).toBe(0)
    })

    it('should return 0 when negative expenses', () => {
      expect(calculateCAC(-500000, 10)).toBe(0)
    })

    it('should handle zero expenses', () => {
      expect(calculateCAC(0, 10)).toBe(0)
    })

    it('should round to nearest cent', () => {
      // $1,000 / 3 pacientes = $333.33
      expect(calculateCAC(100000, 3)).toBe(33333)
    })
  })

  describe('calculateLTV', () => {
    it('should calculate LTV correctly', () => {
      // $100,000 / 50 pacientes = $2,000 LTV
      expect(calculateLTV(10000000, 50)).toBe(200000)
    })

    it('should return 0 when no patients', () => {
      expect(calculateLTV(10000000, 0)).toBe(0)
    })

    it('should return 0 when negative patients', () => {
      expect(calculateLTV(10000000, -10)).toBe(0)
    })

    it('should return 0 when negative revenue', () => {
      expect(calculateLTV(-5000000, 20)).toBe(0)
    })

    it('should handle zero revenue', () => {
      expect(calculateLTV(0, 20)).toBe(0)
    })

    it('should round to nearest cent', () => {
      // $1,000 / 3 pacientes = $333.33
      expect(calculateLTV(100000, 3)).toBe(33333)
    })
  })

  describe('calculateROI', () => {
    it('should calculate positive ROI correctly', () => {
      // ($50,000 - $10,000) / $10,000 × 100 = 400%
      expect(calculateROI(5000000, 1000000)).toBe(400)
    })

    it('should calculate negative ROI (loss)', () => {
      // ($5,000 - $10,000) / $10,000 × 100 = -50%
      expect(calculateROI(500000, 1000000)).toBe(-50)
    })

    it('should return 0 when zero investment', () => {
      expect(calculateROI(5000000, 0)).toBe(0)
    })

    it('should return 0 when negative investment', () => {
      expect(calculateROI(5000000, -1000000)).toBe(0)
    })

    it('should return -100 when negative revenue', () => {
      expect(calculateROI(-1000000, 500000)).toBe(-100)
    })

    it('should handle break-even (0% ROI)', () => {
      // $10,000 - $10,000 / $10,000 = 0%
      expect(calculateROI(1000000, 1000000)).toBe(0)
    })

    it('should round to 2 decimal places', () => {
      // $10,333 / $10,000 = 3.33% ROI
      expect(calculateROI(1033300, 1000000)).toBe(3.33)
    })
  })

  describe('calculateConversionRate', () => {
    it('should calculate conversion rate correctly', () => {
      // 25 / 200 × 100 = 12.5%
      expect(calculateConversionRate(25, 200)).toBe(12.5)
    })

    it('should return 0 when no leads', () => {
      expect(calculateConversionRate(10, 0)).toBe(0)
    })

    it('should return 0 when negative leads', () => {
      expect(calculateConversionRate(10, -50)).toBe(0)
    })

    it('should return 0 when negative converted', () => {
      expect(calculateConversionRate(-5, 100)).toBe(0)
    })

    it('should handle 100% conversion', () => {
      expect(calculateConversionRate(100, 100)).toBe(100)
    })

    it('should handle very low conversion rates', () => {
      // 1 / 1000 × 100 = 0.1%
      expect(calculateConversionRate(1, 1000)).toBe(0.1)
    })

    it('should round to 2 decimal places', () => {
      // 7 / 30 × 100 = 23.33%
      expect(calculateConversionRate(7, 30)).toBe(23.33)
    })
  })

  describe('calculateLTVCACRatio', () => {
    it('should calculate excellent ratio (>3)', () => {
      // $2,000 / $500 = 4:1
      expect(calculateLTVCACRatio(200000, 50000)).toBe(4)
    })

    it('should calculate good ratio (2-3)', () => {
      // $2,000 / $800 = 2.5:1
      expect(calculateLTVCACRatio(200000, 80000)).toBe(2.5)
    })

    it('should calculate poor ratio (<1)', () => {
      // $500 / $1,000 = 0.5:1
      expect(calculateLTVCACRatio(50000, 100000)).toBe(0.5)
    })

    it('should return 0 when CAC is 0', () => {
      expect(calculateLTVCACRatio(200000, 0)).toBe(0)
    })

    it('should return 0 when CAC is negative', () => {
      expect(calculateLTVCACRatio(200000, -50000)).toBe(0)
    })

    it('should return 0 when LTV is negative', () => {
      expect(calculateLTVCACRatio(-100000, 50000)).toBe(0)
    })

    it('should round to 2 decimal places', () => {
      // $1,000 / $333 = 3.003... ≈ 3.00
      expect(calculateLTVCACRatio(100000, 33333)).toBe(3.0)
    })
  })

  describe('getLTVCACRatioQuality', () => {
    it('should return excellent for ratio >= 3', () => {
      const result = getLTVCACRatioQuality(4.5)
      expect(result.label).toBe('excellent')
      expect(result.color).toBe('green')
      expect(result.message).toContain('Excelente')
    })

    it('should return good for ratio 2-3', () => {
      const result = getLTVCACRatioQuality(2.7)
      expect(result.label).toBe('good')
      expect(result.color).toBe('blue')
      expect(result.message).toContain('Bueno')
    })

    it('should return acceptable for ratio 1-2', () => {
      const result = getLTVCACRatioQuality(1.5)
      expect(result.label).toBe('acceptable')
      expect(result.color).toBe('yellow')
      expect(result.message).toContain('Aceptable')
    })

    it('should return critical for ratio < 1', () => {
      const result = getLTVCACRatioQuality(0.8)
      expect(result.label).toBe('critical')
      expect(result.color).toBe('red')
      expect(result.message).toContain('Crítico')
    })

    it('should return unknown for ratio 0', () => {
      const result = getLTVCACRatioQuality(0)
      expect(result.label).toBe('unknown')
      expect(result.color).toBe('gray')
      expect(result.message).toContain('Datos insuficientes')
    })
  })

  describe('calculateTargetCAC', () => {
    it('should calculate target CAC with default ratio 3', () => {
      // $2,000 / 3 = $666.67
      expect(calculateTargetCAC(200000)).toBe(66667)
    })

    it('should calculate target CAC with custom ratio', () => {
      // $2,000 / 4 = $500
      expect(calculateTargetCAC(200000, 4)).toBe(50000)
    })

    it('should return 0 when ratio is 0', () => {
      expect(calculateTargetCAC(200000, 0)).toBe(0)
    })

    it('should return 0 when ratio is negative', () => {
      expect(calculateTargetCAC(200000, -3)).toBe(0)
    })

    it('should return 0 when LTV is negative', () => {
      expect(calculateTargetCAC(-100000, 3)).toBe(0)
    })
  })

  describe('calculateGrowthRate', () => {
    it('should calculate positive growth', () => {
      // (120 - 100) / 100 × 100 = 20%
      expect(calculateGrowthRate(120, 100)).toBe(20)
    })

    it('should calculate negative growth', () => {
      // (80 - 100) / 100 × 100 = -20%
      expect(calculateGrowthRate(80, 100)).toBe(-20)
    })

    it('should return 0 when no previous patients', () => {
      expect(calculateGrowthRate(50, 0)).toBe(0)
    })

    it('should return 0 when previous patients negative', () => {
      expect(calculateGrowthRate(50, -10)).toBe(0)
    })

    it('should handle zero growth', () => {
      expect(calculateGrowthRate(100, 100)).toBe(0)
    })

    it('should round to 2 decimal places', () => {
      // (107 - 100) / 100 = 7.00%
      expect(calculateGrowthRate(107, 100)).toBe(7)
    })
  })

  describe('calculatePaybackPeriod', () => {
    it('should calculate payback period correctly', () => {
      // $500 CAC / $200 monthly = 2.5 months
      expect(calculatePaybackPeriod(50000, 20000)).toBe(2.5)
    })

    it('should return 0 when no monthly revenue', () => {
      expect(calculatePaybackPeriod(50000, 0)).toBe(0)
    })

    it('should return 0 when negative monthly revenue', () => {
      expect(calculatePaybackPeriod(50000, -10000)).toBe(0)
    })

    it('should return 0 when CAC is 0', () => {
      expect(calculatePaybackPeriod(0, 20000)).toBe(0)
    })

    it('should return 0 when CAC is negative', () => {
      expect(calculatePaybackPeriod(-50000, 20000)).toBe(0)
    })

    it('should handle fast payback (< 1 month)', () => {
      // $500 / $1,000 = 0.5 months
      expect(calculatePaybackPeriod(50000, 100000)).toBe(0.5)
    })

    it('should round to 1 decimal place', () => {
      // $1,000 / $333 = 3.003... ≈ 3.0
      expect(calculatePaybackPeriod(100000, 33333)).toBe(3.0)
    })
  })
})
