import { describe, it, expect } from 'vitest';
import {
  calculateFixedCost,
  calculateBaseCost,
  calculateMargin,
  calculateFinalPrice,
  calculateTariff,
  calculateRequiredMargin,
  calculateBreakEvenPrice,
} from '../tarifa';

describe('Tariff Calculations', () => {
  describe('calculateFixedCost', () => {
    it('should calculate fixed cost for 60 minutes', () => {
      // 60 minutes * 276 cents/minute = 16,560 cents
      expect(calculateFixedCost(60, 276)).toBe(16_560);
    });

    it('should handle different durations', () => {
      expect(calculateFixedCost(30, 276)).toBe(8_280);
      expect(calculateFixedCost(45, 276)).toBe(12_420);
      expect(calculateFixedCost(90, 276)).toBe(24_840);
    });

    it('should return 0 for zero duration', () => {
      expect(calculateFixedCost(0, 276)).toBe(0);
    });

    it('should throw error for negative duration', () => {
      expect(() => calculateFixedCost(-10, 276)).toThrow(
        'Duration cannot be negative'
      );
    });
  });

  describe('calculateBaseCost', () => {
    it('should sum fixed and variable costs', () => {
      expect(calculateBaseCost(16_560, 5_000)).toBe(21_560);
    });

    it('should handle zero variable cost', () => {
      expect(calculateBaseCost(10_000, 0)).toBe(10_000);
    });

    it('should handle zero fixed cost', () => {
      expect(calculateBaseCost(0, 5_000)).toBe(5_000);
    });
  });

  describe('calculateMargin', () => {
    it('should calculate 40% margin', () => {
      // 21,560 * 0.4 = 8,624
      expect(calculateMargin(21_560, 0.4)).toBe(8_624);
    });

    it('should handle different margin percentages', () => {
      expect(calculateMargin(10_000, 0.25)).toBe(2_500);
      expect(calculateMargin(10_000, 0.5)).toBe(5_000);
      expect(calculateMargin(10_000, 0.75)).toBe(7_500);
    });

    it('should return 0 for zero margin', () => {
      expect(calculateMargin(10_000, 0)).toBe(0);
    });

    it('should throw error for negative margin', () => {
      expect(() => calculateMargin(10_000, -0.1)).toThrow(
        'Margin percentage cannot be negative'
      );
    });
  });

  describe('calculateFinalPrice', () => {
    it('should add margin to base cost', () => {
      expect(calculateFinalPrice(21_560, 8_624)).toBe(30_184);
    });

    it('should handle zero margin', () => {
      expect(calculateFinalPrice(10_000, 0)).toBe(10_000);
    });
  });

  describe('calculateTariff', () => {
    it('should calculate complete tariff from example', () => {
      const params = {
        durationMinutes: 60,
        fixedPerMinuteCents: 276,
        variableCostCents: 5_000,
        marginPercentage: 0.4,
      };

      const result = calculateTariff(params);

      expect(result).toEqual({
        fixedCostCents: 16_560,
        variableCostCents: 5_000,
        baseCostCents: 21_560,
        marginCents: 8_624,
        finalPriceCents: 30_184,
      });
    });

    it('should apply rounding when specified', () => {
      const params = {
        durationMinutes: 60,
        fixedPerMinuteCents: 276,
        variableCostCents: 5_000,
        marginPercentage: 0.4,
        roundingStepCents: 5_000, // Round to nearest 50 pesos
      };

      const result = calculateTariff(params);

      expect(result.finalPriceCents).toBe(30_184);
      expect(result.roundedPriceCents).toBe(30_000); // Rounded to nearest 50 pesos
    });

    it('should handle different rounding steps', () => {
      const params = {
        durationMinutes: 45,
        fixedPerMinuteCents: 276,
        variableCostCents: 3_318,
        marginPercentage: 0.35,
        roundingStepCents: 1_000, // Round to nearest 10 pesos
      };

      const result = calculateTariff(params);
      
      // Fixed: 45 * 276 = 12,420
      // Base: 12,420 + 3,318 = 15,738
      // Margin: 15,738 * 0.35 = 5,508
      // Final: 15,738 + 5,508 = 21,246
      // Rounded to nearest 1,000: 21,000
      
      expect(result.baseCostCents).toBe(15_738);
      expect(result.finalPriceCents).toBe(21_246);
      expect(result.roundedPriceCents).toBe(21_000);
    });
  });

  describe('calculateRequiredMargin', () => {
    it('should calculate margin to achieve target', () => {
      const base = 20_000;
      const target = 30_000;
      // (30,000 - 20,000) / 20,000 = 0.5
      expect(calculateRequiredMargin(base, target)).toBe(0.5);
    });

    it('should return 0 for target below cost', () => {
      expect(calculateRequiredMargin(20_000, 15_000)).toBe(0);
    });

    it('should handle break-even target', () => {
      expect(calculateRequiredMargin(20_000, 20_000)).toBe(0);
    });

    it('should throw error for zero base cost', () => {
      expect(() => calculateRequiredMargin(0, 10_000)).toThrow(
        'Base cost must be positive'
      );
    });
  });

  describe('calculateBreakEvenPrice', () => {
    it('should calculate break-even price', () => {
      expect(calculateBreakEvenPrice(16_560, 5_000)).toBe(21_560);
    });

    it('should handle zero variable cost', () => {
      expect(calculateBreakEvenPrice(10_000, 0)).toBe(10_000);
    });

    it('should handle zero fixed cost', () => {
      expect(calculateBreakEvenPrice(0, 5_000)).toBe(5_000);
    });
  });
});