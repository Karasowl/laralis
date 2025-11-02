import { describe, it, expect } from 'vitest';
import {
  calculateFixedCost,
  calculateBaseCost,
  calculateMargin,
  calculateFinalPrice,
  calculateTariff,
  calculateRequiredMargin,
  calculateBreakEvenPrice,
  calculateDiscountAmount,
  calcularPrecioConDescuento,
  calculateEffectiveDiscountPercentage,
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

  describe('calculateDiscountAmount', () => {
    describe('no discount', () => {
      it('should return 0 for "none" type', () => {
        expect(calculateDiscountAmount(10_000, 'none', 0)).toBe(0);
      });

      it('should return 0 for zero value', () => {
        expect(calculateDiscountAmount(10_000, 'percentage', 0)).toBe(0);
        expect(calculateDiscountAmount(10_000, 'fixed', 0)).toBe(0);
      });
    });

    describe('percentage discount', () => {
      it('should calculate 10% discount correctly', () => {
        // 10% of $100.00 (10,000 cents) = $10.00 (1,000 cents)
        expect(calculateDiscountAmount(10_000, 'percentage', 10)).toBe(1_000);
      });

      it('should calculate 25% discount correctly', () => {
        // 25% of $320.00 (32,000 cents) = $80.00 (8,000 cents)
        expect(calculateDiscountAmount(32_000, 'percentage', 25)).toBe(8_000);
      });

      it('should calculate 50% discount correctly', () => {
        // 50% of $200.00 (20,000 cents) = $100.00 (10,000 cents)
        expect(calculateDiscountAmount(20_000, 'percentage', 50)).toBe(10_000);
      });

      it('should handle 100% discount', () => {
        expect(calculateDiscountAmount(10_000, 'percentage', 100)).toBe(10_000);
      });

      it('should throw error for percentage > 100', () => {
        expect(() => calculateDiscountAmount(10_000, 'percentage', 150)).toThrow(
          'Percentage discount must be between 0 and 100'
        );
      });

      it('should throw error for negative percentage', () => {
        expect(() => calculateDiscountAmount(10_000, 'percentage', -10)).toThrow(
          'Percentage discount must be between 0 and 100'
        );
      });
    });

    describe('fixed discount', () => {
      it('should return fixed amount', () => {
        // $50.00 discount (5,000 cents)
        expect(calculateDiscountAmount(10_000, 'fixed', 5_000)).toBe(5_000);
      });

      it('should not exceed base price', () => {
        // Discount of $150 on $100 item should be capped at $100
        expect(calculateDiscountAmount(10_000, 'fixed', 15_000)).toBe(10_000);
      });

      it('should handle discount equal to price', () => {
        expect(calculateDiscountAmount(10_000, 'fixed', 10_000)).toBe(10_000);
      });

      it('should throw error for negative amount', () => {
        expect(() => calculateDiscountAmount(10_000, 'fixed', -1_000)).toThrow(
          'Fixed discount cannot be negative'
        );
      });
    });
  });

  describe('calcularPrecioConDescuento', () => {
    describe('percentage discounts', () => {
      it('should apply 10% discount correctly', () => {
        // $100.00 - 10% = $90.00
        expect(calcularPrecioConDescuento(10_000, 'percentage', 10)).toBe(9_000);
      });

      it('should apply 25% discount correctly', () => {
        // $320.00 - 25% = $240.00
        expect(calcularPrecioConDescuento(32_000, 'percentage', 25)).toBe(24_000);
      });

      it('should apply 60% discount correctly', () => {
        // $100.00 - 60% = $40.00
        expect(calcularPrecioConDescuento(10_000, 'percentage', 60)).toBe(4_000);
      });
    });

    describe('fixed discounts', () => {
      it('should apply $50 discount correctly', () => {
        // $100.00 - $50.00 = $50.00
        expect(calcularPrecioConDescuento(10_000, 'fixed', 5_000)).toBe(5_000);
      });

      it('should apply $10 discount correctly', () => {
        // $320.00 - $10.00 = $310.00
        expect(calcularPrecioConDescuento(32_000, 'fixed', 1_000)).toBe(31_000);
      });

      it('should not go below zero when discount exceeds price', () => {
        // $100.00 - $150.00 = $0.00 (capped)
        expect(calcularPrecioConDescuento(10_000, 'fixed', 15_000)).toBe(0);
      });
    });

    describe('no discount', () => {
      it('should return original price for "none" type', () => {
        expect(calcularPrecioConDescuento(10_000, 'none', 0)).toBe(10_000);
      });

      it('should return original price for zero discount', () => {
        expect(calcularPrecioConDescuento(10_000, 'percentage', 0)).toBe(10_000);
        expect(calcularPrecioConDescuento(10_000, 'fixed', 0)).toBe(10_000);
      });
    });

    describe('edge cases', () => {
      it('should handle zero price', () => {
        expect(calcularPrecioConDescuento(0, 'percentage', 10)).toBe(0);
        expect(calcularPrecioConDescuento(0, 'fixed', 1_000)).toBe(0);
      });

      it('should throw error for negative price', () => {
        expect(() => calcularPrecioConDescuento(-10_000, 'percentage', 10)).toThrow(
          'Base price cannot be negative'
        );
      });

      it('should never return negative price', () => {
        expect(calcularPrecioConDescuento(10_000, 'percentage', 100)).toBe(0);
        expect(calcularPrecioConDescuento(10_000, 'fixed', 20_000)).toBe(0);
      });
    });

    describe('real-world examples', () => {
      it('should calculate discount on typical service price', () => {
        // Service costs $199.87, 60% margin = $319.79 rounded to $320
        // 10% discount = $32.00 off = $288.00 final price
        const basePrice = 32_000; // $320.00
        const discountPct = 10;
        const expectedFinal = 28_800; // $288.00

        expect(calcularPrecioConDescuento(basePrice, 'percentage', discountPct)).toBe(expectedFinal);
      });

      it('should handle promotional discount', () => {
        // Black Friday: $500 service with $100 off
        const basePrice = 50_000; // $500.00
        const discount = 10_000; // $100.00
        const expectedFinal = 40_000; // $400.00

        expect(calcularPrecioConDescuento(basePrice, 'fixed', discount)).toBe(expectedFinal);
      });
    });
  });

  describe('calculateEffectiveDiscountPercentage', () => {
    it('should calculate 10% effective discount', () => {
      // Original $100, Final $90 = 10% discount
      expect(calculateEffectiveDiscountPercentage(10_000, 9_000)).toBe(10);
    });

    it('should calculate 25% effective discount', () => {
      // Original $320, Final $240 = 25% discount
      expect(calculateEffectiveDiscountPercentage(32_000, 24_000)).toBe(25);
    });

    it('should calculate 50% effective discount', () => {
      // Original $200, Final $100 = 50% discount
      expect(calculateEffectiveDiscountPercentage(20_000, 10_000)).toBe(50);
    });

    it('should return 0 for no discount', () => {
      expect(calculateEffectiveDiscountPercentage(10_000, 10_000)).toBe(0);
    });

    it('should handle zero original price', () => {
      expect(calculateEffectiveDiscountPercentage(0, 0)).toBe(0);
    });

    it('should handle price increase as negative discount', () => {
      // Original $100, Final $120 = -20% discount (price increase)
      expect(calculateEffectiveDiscountPercentage(10_000, 12_000)).toBe(-20);
    });
  });
});