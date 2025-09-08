import { describe, it, expect } from 'vitest';
import {
  calculateVariableCost,
  calculateVariableCostPercentage,
  groupSuppliesByCategory,
  calculateAverageVariableCostPercentage,
} from '../variable';

describe('Variable Cost Calculations', () => {
  describe('calculateVariableCost', () => {
    it('should calculate cleaning supplies example', () => {
      const supplies = [
        { supplyId: '1', name: 'Gloves', quantity: 2, unitCostCents: 500 },
        { supplyId: '2', name: 'Gauze', quantity: 5, unitCostCents: 200 },
        { supplyId: '3', name: 'Fluoride', quantity: 1, unitCostCents: 1_318 },
      ];
      
      // 2*500 + 5*200 + 1*1318 = 1000 + 1000 + 1318 = 3318
      expect(calculateVariableCost(supplies)).toBe(3_318);
    });

    it('should handle empty supplies list', () => {
      expect(calculateVariableCost([])).toBe(0);
    });

    it('should handle decimal quantities', () => {
      const supplies = [
        { supplyId: '1', name: 'Material', quantity: 0.5, unitCostCents: 1_000 },
        { supplyId: '2', name: 'Solution', quantity: 2.5, unitCostCents: 400 },
      ];
      
      // 0.5*1000 + 2.5*400 = 500 + 1000 = 1500
      expect(calculateVariableCost(supplies)).toBe(1_500);
    });

    it('should throw error for negative quantity', () => {
      const supplies = [
        { supplyId: '1', name: 'Bad Item', quantity: -1, unitCostCents: 100 },
      ];
      
      expect(() => calculateVariableCost(supplies)).toThrow(
        'Quantity cannot be negative for Bad Item'
      );
    });

    it('should throw error for negative unit cost', () => {
      const supplies = [
        { supplyId: '1', name: 'Bad Cost', quantity: 1, unitCostCents: -100 },
      ];
      
      expect(() => calculateVariableCost(supplies)).toThrow(
        'Unit cost cannot be negative for Bad Cost'
      );
    });
  });

  describe('calculateVariableCostPercentage', () => {
    it('should calculate percentage correctly', () => {
      const variable = 3_500;
      const total = 10_000;
      expect(calculateVariableCostPercentage(variable, total)).toBe(0.35);
    });

    it('should return 0 for zero total cost', () => {
      expect(calculateVariableCostPercentage(1_000, 0)).toBe(0);
    });

    it('should return 0 for negative total cost', () => {
      expect(calculateVariableCostPercentage(1_000, -5_000)).toBe(0);
    });

    it('should handle 100% variable cost', () => {
      expect(calculateVariableCostPercentage(5_000, 5_000)).toBe(1);
    });
  });

  describe('groupSuppliesByCategory', () => {
    it('should group supplies by category', () => {
      const supplies = [
        { supplyId: '1', name: 'Gloves', quantity: 2, unitCostCents: 500, category: 'disposables' },
        { supplyId: '2', name: 'Gauze', quantity: 5, unitCostCents: 200, category: 'disposables' },
        { supplyId: '3', name: 'Anesthetic', quantity: 1, unitCostCents: 2_000, category: 'medications' },
        { supplyId: '4', name: 'Composite', quantity: 2, unitCostCents: 1_500, category: 'materials' },
      ];

      const grouped = groupSuppliesByCategory(supplies);

      expect(grouped).toHaveProperty('disposables');
      expect(grouped.disposables.supplies).toHaveLength(2);
      expect(grouped.disposables.totalCostCents).toBe(2_000); // 1000 + 1000

      expect(grouped).toHaveProperty('medications');
      expect(grouped.medications.supplies).toHaveLength(1);
      expect(grouped.medications.totalCostCents).toBe(2_000);

      expect(grouped).toHaveProperty('materials');
      expect(grouped.materials.supplies).toHaveLength(1);
      expect(grouped.materials.totalCostCents).toBe(3_000);
    });

    it('should handle empty list', () => {
      const grouped = groupSuppliesByCategory([]);
      expect(grouped).toEqual({});
    });

    it('should handle single category', () => {
      const supplies = [
        { supplyId: '1', name: 'Item1', quantity: 1, unitCostCents: 100, category: 'test' },
        { supplyId: '2', name: 'Item2', quantity: 2, unitCostCents: 200, category: 'test' },
      ];

      const grouped = groupSuppliesByCategory(supplies);
      expect(Object.keys(grouped)).toHaveLength(1);
      expect(grouped.test.totalCostCents).toBe(500);
    });
  });

  describe('calculateAverageVariableCostPercentage', () => {
    it('should calculate simple average', () => {
      const services = [
        { variableCostCents: 3_000, totalCostCents: 10_000 }, // 30%
        { variableCostCents: 4_000, totalCostCents: 10_000 }, // 40%
        { variableCostCents: 3_500, totalCostCents: 10_000 }, // 35%
      ];
      
      // (0.3 + 0.4 + 0.35) / 3 = 0.35
      expect(calculateAverageVariableCostPercentage(services)).toBeCloseTo(0.35, 10);
    });

    it('should calculate weighted average', () => {
      const services = [
        { variableCostCents: 3_000, totalCostCents: 10_000, weight: 2 }, // 30% * 2
        { variableCostCents: 4_000, totalCostCents: 10_000, weight: 1 }, // 40% * 1
      ];
      
      // (0.3*2 + 0.4*1) / 3 = 1.0 / 3 = 0.333...
      expect(calculateAverageVariableCostPercentage(services)).toBeCloseTo(0.333, 3);
    });

    it('should return 0 for empty array', () => {
      expect(calculateAverageVariableCostPercentage([])).toBe(0);
    });

    it('should handle services with zero total cost', () => {
      const services = [
        { variableCostCents: 0, totalCostCents: 0 },
        { variableCostCents: 3_500, totalCostCents: 10_000 },
      ];
      
      // (0 + 0.35) / 2 = 0.175
      expect(calculateAverageVariableCostPercentage(services)).toBe(0.175);
    });
  });
});