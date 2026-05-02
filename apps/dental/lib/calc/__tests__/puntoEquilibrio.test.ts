import { describe, it, expect } from 'vitest';
import {
  calculateContributionMargin,
  calculateBreakEvenRevenue,
  calculateBreakEvenPoint,
  calculateRequiredServices,
  calculateSafetyMargin,
  calculateOperatingLeverage,
} from '../puntoEquilibrio';

describe('Break-Even Point Calculations', () => {
  describe('calculateContributionMargin', () => {
    it('should calculate contribution margin from example', () => {
      // 1 - 0.35 = 0.65
      expect(calculateContributionMargin(0.35)).toBe(0.65);
    });

    it('should handle different variable percentages', () => {
      expect(calculateContributionMargin(0)).toBe(1);
      expect(calculateContributionMargin(0.2)).toBe(0.8);
      expect(calculateContributionMargin(0.5)).toBe(0.5);
      expect(calculateContributionMargin(0.75)).toBe(0.25);
    });

    it('should throw error for negative percentage', () => {
      expect(() => calculateContributionMargin(-0.1)).toThrow(
        'Variable percentage must be between 0 and 1'
      );
    });

    it('should throw error for percentage >= 1', () => {
      expect(() => calculateContributionMargin(1)).toThrow(
        'Variable percentage must be between 0 and 1'
      );
      expect(() => calculateContributionMargin(1.1)).toThrow(
        'Variable percentage must be between 0 and 1'
      );
    });
  });

  describe('calculateBreakEvenRevenue', () => {
    it('should calculate break-even from example', () => {
      // 1,854,533 / 0.65 = 2,853,127.69... ≈ 2,853,128
      const result = calculateBreakEvenRevenue(1_854_533, 0.65);
      expect(result).toBe(2_853_128);
    });

    it('should handle different scenarios', () => {
      expect(calculateBreakEvenRevenue(1_000_000, 0.5)).toBe(2_000_000);
      expect(calculateBreakEvenRevenue(1_500_000, 0.75)).toBe(2_000_000);
      expect(calculateBreakEvenRevenue(2_000_000, 0.4)).toBe(5_000_000);
    });

    it('should throw error for zero contribution margin', () => {
      expect(() => calculateBreakEvenRevenue(1_000_000, 0)).toThrow(
        'Contribution margin must be positive'
      );
    });

    it('should throw error for negative contribution margin', () => {
      expect(() => calculateBreakEvenRevenue(1_000_000, -0.1)).toThrow(
        'Contribution margin must be positive'
      );
    });
  });

  describe('calculateBreakEvenPoint', () => {
    it('should calculate complete break-even from example', () => {
      const params = {
        monthlyFixedCostsCents: 1_854_533,
        averageVariablePercentage: 0.35,
      };

      const result = calculateBreakEvenPoint(params);

      expect(result).toEqual({
        breakEvenRevenueCents: 2_853_128,
        contributionMarginPercentage: 0.65,
      });
    });

    it('should handle low variable percentage', () => {
      const params = {
        monthlyFixedCostsCents: 1_000_000,
        averageVariablePercentage: 0.1,
      };

      const result = calculateBreakEvenPoint(params);

      expect(result).toEqual({
        breakEvenRevenueCents: 1_111_111, // 1,000,000 / 0.9
        contributionMarginPercentage: 0.9,
      });
    });

    it('should handle high variable percentage', () => {
      const params = {
        monthlyFixedCostsCents: 2_000_000,
        averageVariablePercentage: 0.8,
      };

      const result = calculateBreakEvenPoint(params);

      expect(result.breakEvenRevenueCents).toBe(10_000_000);
      expect(result.contributionMarginPercentage).toBeCloseTo(0.2, 10);
    });
  });

  describe('calculateRequiredServices', () => {
    it('should calculate number of services needed', () => {
      const breakEven = 2_853_128;
      const avgPrice = 50_000; // 500 pesos per service
      
      // 2,853,128 / 50,000 = 57.06... → 58 (rounded up)
      expect(calculateRequiredServices(breakEven, avgPrice)).toBe(58);
    });

    it('should always round up', () => {
      expect(calculateRequiredServices(1_000_000, 300_000)).toBe(4); // 3.33 → 4
      expect(calculateRequiredServices(1_000_000, 250_000)).toBe(4); // 4.0 → 4
      expect(calculateRequiredServices(1_000_001, 250_000)).toBe(5); // 4.00004 → 5
    });

    it('should throw error for zero price', () => {
      expect(() => calculateRequiredServices(1_000_000, 0)).toThrow(
        'Average service price must be positive'
      );
    });

    it('should throw error for negative price', () => {
      expect(() => calculateRequiredServices(1_000_000, -10_000)).toThrow(
        'Average service price must be positive'
      );
    });
  });

  describe('calculateSafetyMargin', () => {
    it('should calculate positive safety margin', () => {
      const actual = 3_500_000;
      const breakEven = 2_853_128;
      
      const result = calculateSafetyMargin(actual, breakEven);
      
      expect(result.amountCents).toBe(646_872);
      expect(result.percentage).toBeCloseTo(0.2267, 4); // 646,872 / 2,853,128
    });

    it('should calculate negative safety margin', () => {
      const actual = 2_000_000;
      const breakEven = 2_853_128;
      
      const result = calculateSafetyMargin(actual, breakEven);
      
      expect(result.amountCents).toBe(-853_128);
      expect(result.percentage).toBeCloseTo(-0.299, 3);
    });

    it('should handle break-even point exactly', () => {
      const result = calculateSafetyMargin(2_853_128, 2_853_128);
      
      expect(result.amountCents).toBe(0);
      expect(result.percentage).toBe(0);
    });

    it('should handle zero break-even', () => {
      const result = calculateSafetyMargin(1_000_000, 0);
      
      expect(result.amountCents).toBe(1_000_000);
      expect(result.percentage).toBe(0);
    });
  });

  describe('calculateOperatingLeverage', () => {
    it('should calculate operating leverage', () => {
      const contribution = 1_500_000;
      const operatingIncome = 500_000;
      
      // 1,500,000 / 500,000 = 3
      expect(calculateOperatingLeverage(contribution, operatingIncome)).toBe(3);
    });

    it('should handle different scenarios', () => {
      expect(calculateOperatingLeverage(2_000_000, 1_000_000)).toBe(2);
      expect(calculateOperatingLeverage(3_000_000, 600_000)).toBe(5);
    });

    it('should return 0 for zero operating income', () => {
      expect(calculateOperatingLeverage(1_000_000, 0)).toBe(0);
    });

    it('should handle negative operating income', () => {
      expect(calculateOperatingLeverage(1_000_000, -500_000)).toBe(-2);
    });
  });
});