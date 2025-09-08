import { describe, it, expect } from 'vitest';
import { roundToNearestStepCents } from '../../money';

describe('Rounding to Multiple (Step)', () => {
  describe('roundToNearestStepCents', () => {
    it('should round to nearest 50 cents (5 pesos)', () => {
      const step = 5_000; // 50 pesos in cents
      
      expect(roundToNearestStepCents(30_184, step)).toBe(30_000);
      expect(roundToNearestStepCents(32_500, step)).toBe(35_000); // Exactly halfway, rounds up
      expect(roundToNearestStepCents(32_501, step)).toBe(35_000);
      expect(roundToNearestStepCents(27_499, step)).toBe(25_000);
      expect(roundToNearestStepCents(27_500, step)).toBe(30_000); // Exactly halfway, rounds up in JS
    });

    it('should round to nearest 10 pesos (1000 cents)', () => {
      const step = 1_000; // 10 pesos in cents
      
      expect(roundToNearestStepCents(21_246, step)).toBe(21_000);
      expect(roundToNearestStepCents(21_500, step)).toBe(22_000);
      expect(roundToNearestStepCents(21_499, step)).toBe(21_000);
      expect(roundToNearestStepCents(21_501, step)).toBe(22_000);
    });

    it('should round to nearest peso (100 cents)', () => {
      const step = 100; // 1 peso in cents
      
      expect(roundToNearestStepCents(21_246, step)).toBe(21_200);
      expect(roundToNearestStepCents(21_250, step)).toBe(21_300);
      expect(roundToNearestStepCents(21_249, step)).toBe(21_200);
    });

    it('should round to nearest 50 cents', () => {
      const step = 50; // 50 cents
      
      expect(roundToNearestStepCents(21_246, step)).toBe(21_250);
      expect(roundToNearestStepCents(21_224, step)).toBe(21_200);
      expect(roundToNearestStepCents(21_225, step)).toBe(21_250); // Exactly halfway, rounds up
    });

    it('should round to nearest 25 cents', () => {
      const step = 25; // 25 cents
      
      expect(roundToNearestStepCents(21_246, step)).toBe(21_250);
      expect(roundToNearestStepCents(21_237, step)).toBe(21_225);
      expect(roundToNearestStepCents(21_238, step)).toBe(21_250);
    });

    it('should handle exact multiples', () => {
      expect(roundToNearestStepCents(30_000, 5_000)).toBe(30_000);
      expect(roundToNearestStepCents(21_000, 1_000)).toBe(21_000);
      expect(roundToNearestStepCents(100, 50)).toBe(100);
    });

    it('should handle zero amounts', () => {
      expect(roundToNearestStepCents(0, 1_000)).toBe(0);
      expect(roundToNearestStepCents(0, 50)).toBe(0);
    });

    it('should handle small amounts', () => {
      expect(roundToNearestStepCents(12, 25)).toBe(0);
      expect(roundToNearestStepCents(13, 25)).toBe(25);
      expect(roundToNearestStepCents(37, 25)).toBe(25);
      expect(roundToNearestStepCents(38, 25)).toBe(50);
    });

    it('should throw error for zero step', () => {
      expect(() => roundToNearestStepCents(1_000, 0)).toThrow(
        'Step must be positive'
      );
    });

    it('should throw error for negative step', () => {
      expect(() => roundToNearestStepCents(1_000, -50)).toThrow(
        'Step must be positive'
      );
    });

    it('should handle very large steps', () => {
      const step = 10_000_000; // 100,000 pesos
      expect(roundToNearestStepCents(30_184, step)).toBe(0);
      expect(roundToNearestStepCents(5_000_000, step)).toBe(10_000_000); // 5M is exactly halfway, rounds up to 10M
      expect(roundToNearestStepCents(5_000_001, step)).toBe(10_000_000);
    });

    it('should handle decimal-like inputs that are actually integers', () => {
      // These might come from calculations that result in very precise values
      const step = 5_000;
      expect(roundToNearestStepCents(30183.99999999, step)).toBe(30_000);
      expect(roundToNearestStepCents(32500.00000001, step)).toBe(35_000);
    });
  });
});