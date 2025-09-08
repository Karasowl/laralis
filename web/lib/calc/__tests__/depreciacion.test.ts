import { describe, it, expect } from 'vitest';
import {
  calculateMonthlyDepreciation,
  calculateAccumulatedDepreciation,
  calculateBookValue,
  calculateDepreciationSchedule,
} from '../depreciacion';

describe('Depreciation Calculations', () => {
  describe('calculateMonthlyDepreciation', () => {
    it('should calculate monthly depreciation correctly', () => {
      // Example from requirements: 6,762,000 cents over 36 months
      const result = calculateMonthlyDepreciation(6_762_000, 36);
      expect(result).toBe(187_833); // ≈ 187,833 cents per month
    });

    it('should handle exact division', () => {
      const result = calculateMonthlyDepreciation(1_200_000, 12);
      expect(result).toBe(100_000);
    });

    it('should round to nearest cent', () => {
      const result = calculateMonthlyDepreciation(1_000_000, 7);
      expect(result).toBe(142_857); // 1,000,000 / 7 = 142,857.14...
    });

    it('should throw error for zero months', () => {
      expect(() => calculateMonthlyDepreciation(1_000_000, 0)).toThrow(
        'Depreciation months must be positive'
      );
    });

    it('should throw error for negative months', () => {
      expect(() => calculateMonthlyDepreciation(1_000_000, -5)).toThrow(
        'Depreciation months must be positive'
      );
    });
  });

  describe('calculateAccumulatedDepreciation', () => {
    it('should calculate accumulated depreciation', () => {
      const monthly = 187_833;
      expect(calculateAccumulatedDepreciation(monthly, 1)).toBe(187_833);
      expect(calculateAccumulatedDepreciation(monthly, 6)).toBe(1_126_998);
      expect(calculateAccumulatedDepreciation(monthly, 12)).toBe(2_253_996);
      expect(calculateAccumulatedDepreciation(monthly, 36)).toBe(6_761_988);
    });

    it('should return 0 for month 0', () => {
      expect(calculateAccumulatedDepreciation(100_000, 0)).toBe(0);
    });

    it('should throw error for negative month', () => {
      expect(() => calculateAccumulatedDepreciation(100_000, -1)).toThrow(
        'Current month cannot be negative'
      );
    });
  });

  describe('calculateBookValue', () => {
    it('should calculate book value correctly', () => {
      const total = 6_762_000;
      const accumulated = 2_253_996; // 12 months
      expect(calculateBookValue(total, accumulated)).toBe(4_508_004);
    });

    it('should return 0 when fully depreciated', () => {
      expect(calculateBookValue(1_000_000, 1_000_000)).toBe(0);
    });

    it('should return 0 for over-depreciation', () => {
      expect(calculateBookValue(1_000_000, 1_200_000)).toBe(0);
    });
  });

  describe('calculateDepreciationSchedule', () => {
    it('should generate complete depreciation schedule', () => {
      const schedule = calculateDepreciationSchedule({
        totalInvestmentCents: 6_762_000,
        depreciationMonths: 36,
      });

      expect(schedule).toHaveLength(36);
      
      // Check first month
      expect(schedule[0]).toEqual({
        month: 1,
        monthlyDepreciationCents: 187_833,
        accumulatedDepreciationCents: 187_833,
        bookValueCents: 6_574_167,
      });

      // Check middle month (18)
      expect(schedule[17]).toEqual({
        month: 18,
        monthlyDepreciationCents: 187_833,
        accumulatedDepreciationCents: 3_380_994,
        bookValueCents: 3_381_006,
      });

      // Check last month
      expect(schedule[35]).toEqual({
        month: 36,
        monthlyDepreciationCents: 187_833,
        accumulatedDepreciationCents: 6_761_988,
        bookValueCents: 12, // Small rounding difference
      });
    });

    it('should handle short depreciation period', () => {
      const schedule = calculateDepreciationSchedule({
        totalInvestmentCents: 1_200_000,
        depreciationMonths: 3,
      });

      expect(schedule).toHaveLength(3);
      expect(schedule[2].bookValueCents).toBe(0);
    });
  });
});