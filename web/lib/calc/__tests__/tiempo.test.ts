import { describe, it, expect } from 'vitest';
import {
  calculateTotalMinutesPerMonth,
  calculateEffectiveMinutesPerMonth,
  calculateFixedCostPerMinute,
  calculateTimeCosts,
} from '../tiempo';

describe('Time-based Cost Calculations', () => {
  describe('calculateTotalMinutesPerMonth', () => {
    it('should calculate total minutes correctly', () => {
      // 20 days * 7 hours * 60 minutes = 8,400 minutes
      expect(calculateTotalMinutesPerMonth(20, 7)).toBe(8_400);
    });

    it('should handle different work schedules', () => {
      expect(calculateTotalMinutesPerMonth(22, 8)).toBe(10_560);
      expect(calculateTotalMinutesPerMonth(25, 6)).toBe(9_000);
    });
  });

  describe('calculateEffectiveMinutesPerMonth', () => {
    it('should calculate effective minutes with 80% efficiency', () => {
      // 8,400 * 0.8 = 6,720 minutes
      expect(calculateEffectiveMinutesPerMonth(8_400, 0.8)).toBe(6_720);
    });

    it('should handle different efficiency rates', () => {
      expect(calculateEffectiveMinutesPerMonth(10_000, 0.7)).toBe(7_000);
      expect(calculateEffectiveMinutesPerMonth(10_000, 0.85)).toBe(8_500);
      expect(calculateEffectiveMinutesPerMonth(10_000, 1.0)).toBe(10_000);
    });

    it('should round to nearest minute', () => {
      // 8,400 * 0.75 = 6,300
      expect(calculateEffectiveMinutesPerMonth(8_400, 0.75)).toBe(6_300);
    });
  });

  describe('calculateFixedCostPerMinute', () => {
    it('should calculate cost per minute from example', () => {
      // Monthly fixed: 1,854,533 cents, effective minutes: 6,720
      // Result should be ≈ 276 cents per minute
      const result = calculateFixedCostPerMinute(1_854_533, 6_720);
      expect(result).toBe(276); // Rounded from 275.97...
    });

    it('should handle exact division', () => {
      expect(calculateFixedCostPerMinute(1_000_000, 10_000)).toBe(100);
    });

    it('should throw error for zero minutes', () => {
      expect(() => calculateFixedCostPerMinute(1_000_000, 0)).toThrow(
        'Effective minutes must be positive'
      );
    });

    it('should throw error for negative minutes', () => {
      expect(() => calculateFixedCostPerMinute(1_000_000, -100)).toThrow(
        'Effective minutes must be positive'
      );
    });
  });

  describe('calculateTimeCosts', () => {
    it('should calculate complete time costs from example', () => {
      const settings = {
        workDaysPerMonth: 20,
        hoursPerDay: 7,
        effectiveWorkPercentage: 0.8,
      };
      const monthlyFixed = 1_854_533;

      const result = calculateTimeCosts(settings, monthlyFixed);

      expect(result).toEqual({
        monthlyFixedCostsCents: 1_854_533,
        fixedPerMinuteCents: 276,
        totalMinutesPerMonth: 8_400,
        effectiveMinutesPerMonth: 6_720,
      });
    });

    it('should handle different settings', () => {
      const settings = {
        workDaysPerMonth: 22,
        hoursPerDay: 8,
        effectiveWorkPercentage: 0.75,
      };
      const monthlyFixed = 2_000_000;

      const result = calculateTimeCosts(settings, monthlyFixed);

      expect(result).toEqual({
        monthlyFixedCostsCents: 2_000_000,
        fixedPerMinuteCents: 253, // 2,000,000 / 7,920 = 252.52... rounds to 253
        totalMinutesPerMonth: 10_560,
        effectiveMinutesPerMonth: 7_920,
      });
    });

    it('should handle 100% efficiency', () => {
      const settings = {
        workDaysPerMonth: 20,
        hoursPerDay: 8,
        effectiveWorkPercentage: 1.0,
      };
      const monthlyFixed = 1_600_000;

      const result = calculateTimeCosts(settings, monthlyFixed);

      expect(result).toEqual({
        monthlyFixedCostsCents: 1_600_000,
        fixedPerMinuteCents: 167, // 1,600,000 / 9,600
        totalMinutesPerMonth: 9_600,
        effectiveMinutesPerMonth: 9_600,
      });
    });
  });
});