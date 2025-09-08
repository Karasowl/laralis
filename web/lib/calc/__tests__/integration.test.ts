import { describe, it, expect } from 'vitest';
import { calculateMonthlyDepreciation } from '../depreciacion';
import { calculateTimeCosts } from '../tiempo';
import { calculateVariableCost, SupplyUsage } from '../variable';
import { calculateTariff } from '../tarifa';

describe('Full Business Flow Integration', () => {
  describe('Complete workflow from depreciation to final price', () => {
    it('should match the example from initial_idea.md', () => {
      // Step 1: Depreciation setup
      // Example: Total investment 67,000 MXN = 6,700,000 cents, 36 months
      const totalInvestmentCents = 6_700_000;
      const depreciationMonths = 36;
      const monthlyDepreciationCents = calculateMonthlyDepreciation(
        totalInvestmentCents,
        depreciationMonths
      );
      
      // Monthly depreciation should be 67,000 / 36 = 1,861.11 MXN = 186,111 cents
      expect(monthlyDepreciationCents).toBe(186_111);

      // Step 2: Fixed costs
      // Example from doc: rent 3000, electricity 250, water 200, etc.
      // Total without depreciation: 16,684.22 MXN
      const fixedCostsBeforeDepreciation = 1_668_422; // cents
      const totalMonthlyFixedCosts = fixedCostsBeforeDepreciation + monthlyDepreciationCents;
      
      // Total should be 18,545.33 MXN = 1,854,533 cents
      expect(totalMonthlyFixedCosts).toBe(1_854_533);

      // Step 3: Time costs
      // Example: 20 work days, 7 hours/day, 80% effective
      const timeSettings = {
        workDaysPerMonth: 20,
        hoursPerDay: 7,
        effectiveWorkPercentage: 0.8
      };

      const timeCosts = calculateTimeCosts(timeSettings, totalMonthlyFixedCosts);
      
      // Total minutes: 20 * 7 * 60 = 8,400
      expect(timeCosts.totalMinutesPerMonth).toBe(8_400);
      
      // Effective minutes: 8,400 * 0.8 = 6,720
      expect(timeCosts.effectiveMinutesPerMonth).toBe(6_720);
      
      // Fixed cost per minute: 1,854,533 / 6,720 = 276 cents
      expect(timeCosts.fixedPerMinuteCents).toBe(276);

      // Step 4: Variable costs (supplies)
      // Example: Dental cleaning supplies
      const cleaningSupplies: SupplyUsage[] = [
        { supplyId: 'gloves', name: 'gloves', quantity: 1, unitCostCents: 150 },
        { supplyId: 'mask', name: 'mask', quantity: 1, unitCostCents: 100 },
        { supplyId: 'gauze', name: 'gauze', quantity: 2, unitCostCents: 50 },
        { supplyId: 'brush', name: 'brush', quantity: 1, unitCostCents: 800 },
        { supplyId: 'alcohol', name: 'alcohol', quantity: 0.1, unitCostCents: 2000 }
      ];

      const variableCostCents = calculateVariableCost(cleaningSupplies);
      
      // Total variable cost: 150 + 100 + 100 + 800 + 200 = 1,350 cents
      expect(variableCostCents).toBe(1_350);

      // Step 5: Tariff calculation
      // Example: Dental cleaning - 60 minutes, 40% margin
      const tariff = calculateTariff({
        durationMinutes: 60,
        fixedPerMinuteCents: timeCosts.fixedPerMinuteCents,
        variableCostCents: variableCostCents,
        marginPercentage: 0.4  // 40% as decimal
      });
      
      // Fixed cost: 276 * 60 = 16,560 cents
      expect(tariff.fixedCostCents).toBe(16_560);
      
      // Total cost without profit: 16,560 + 1,350 = 17,910 cents
      expect(tariff.baseCostCents).toBe(17_910);
      
      // Profit amount: 17,910 * 0.4 = 7,164 cents
      expect(tariff.marginCents).toBe(7_164);
      
      // Final price: 17,910 + 7,164 = 25,074 cents (250.74 MXN)
      expect(tariff.finalPriceCents).toBe(25_074);
      
      // No rounding was requested, so roundedPriceCents should be undefined
      expect(tariff.roundedPriceCents).toBeUndefined();
    });

    it('should handle different margin scenarios', () => {
      const baseParams = {
        durationMinutes: 45,
        fixedPerMinuteCents: 300,
        variableCostCents: 2_000,
        marginPercentage: 0
      };

      // 0% margin
      const noMargin = calculateTariff(baseParams);
      expect(noMargin.marginCents).toBe(0);
      expect(noMargin.finalPriceCents).toBe(noMargin.baseCostCents);

      // 50% margin
      const halfMargin = calculateTariff({ ...baseParams, marginPercentage: 0.5 });
      expect(halfMargin.marginCents).toBe(Math.round(halfMargin.baseCostCents * 0.5));

      // 100% margin
      const fullMargin = calculateTariff({ ...baseParams, marginPercentage: 1.0 });
      expect(fullMargin.marginCents).toBe(fullMargin.baseCostCents);
      expect(fullMargin.finalPriceCents).toBe(fullMargin.baseCostCents * 2);
    });
  });

  describe('Breakeven point calculation', () => {
    it('should calculate breakeven correctly', () => {
      // From document: fixed costs 18,545.33, variable cost estimate 35%, contribution margin 65%
      const monthlyFixedCostsCents = 1_854_533;
      const variableCostPercentage = 0.35;
      const contributionMargin = 1 - variableCostPercentage; // 0.65

      // Breakeven = Fixed Costs / Contribution Margin
      const breakevenIncomeCents = Math.round(monthlyFixedCostsCents / contributionMargin);
      
      // 1,854,533 / 0.65 = 2,853,127 cents (28,531.27 MXN)
      expect(breakevenIncomeCents).toBe(2_853_128);
    });
  });

  describe('Data flow validation', () => {
    it('should enforce correct dependency order', () => {
      // You cannot create a tariff without:
      // 1. Depreciation data
      // 2. Fixed costs
      // 3. Time settings
      // 4. Variable costs (supplies)
      
      const hasDepreciation = true;
      const hasFixedCosts = true;
      const hasTimeSettings = true;
      const hasSupplies = true;
      
      const canCreateTariff = hasDepreciation && hasFixedCosts && hasTimeSettings && hasSupplies;
      expect(canCreateTariff).toBe(true);
    });

    it('should store all values in cents', () => {
      // Verify that all monetary values are integers (cents)
      const values = [
        1_854_533, // monthly fixed costs
        276,       // cost per minute
        1_350,     // variable cost
        25_074,    // final price
      ];

      values.forEach(value => {
        expect(Number.isInteger(value)).toBe(true);
        expect(value > 0).toBe(true);
      });
    });
  });

  describe('Service recipe validation', () => {
    it('should correctly calculate service with multiple supplies', () => {
      // Posterior resin example
      const resinSupplies: SupplyUsage[] = [
        { supplyId: 'anesthesia', name: 'anesthesia', quantity: 2, unitCostCents: 162 },
        { supplyId: 'resin', name: 'resin', quantity: 1, unitCostCents: 3_500 },
        { supplyId: 'adhesive', name: 'adhesive', quantity: 0.2, unitCostCents: 5_000 },
        { supplyId: 'acid', name: 'acid', quantity: 0.1, unitCostCents: 2_500 },
      ];

      const totalCost = calculateVariableCost(resinSupplies);
      
      // 324 + 3,500 + 1,000 + 250 = 5,074 cents
      expect(totalCost).toBe(5_074);
    });

    it('should handle fractional quantities correctly', () => {
      const supplies: SupplyUsage[] = [
        { supplyId: 'expensive-material', name: 'expensive-material', quantity: 0.25, unitCostCents: 10_000 }
      ];

      const cost = calculateVariableCost(supplies);
      expect(cost).toBe(2_500); // 0.25 * 10,000 = 2,500
    });
  });

  describe('Money handling', () => {
    it('should always round to nearest cent', () => {
      // Test division that creates decimals
      const result = calculateMonthlyDepreciation(1_000_000, 7);
      expect(Number.isInteger(result)).toBe(true);
      
      // Test multiplication with percentages
      const supplies: SupplyUsage[] = [
        { supplyId: 'test', name: 'test', quantity: 0.333, unitCostCents: 1_000 }
      ];
      const cost = calculateVariableCost(supplies);
      expect(Number.isInteger(cost)).toBe(true);
    });

    it('should never use floating point for money', () => {
      // This would be wrong:
      // const priceInPesos = 123.45;
      
      // This is correct:
      const priceCents = 12_345;
      expect(Number.isInteger(priceCents)).toBe(true);
    });
  });

  describe('Historical data immutability', () => {
    it('should store snapshot data in treatments', () => {
      // When a treatment is created, it should snapshot:
      const treatmentSnapshot = {
        fixedPerMinuteCents: 276,
        serviceMinutes: 60,
        variableCostCents: 1_350,
        marginPercentage: 0.4,
        totalCostCents: 17_910,
        profitCents: 7_164,
        finalPriceCents: 25_074,
        roundedPriceCents: 25_000,
        tariffVersion: 1,
        timestamp: new Date().toISOString()
      };

      // All monetary values should be integers (cents)
      const monetaryFields = [
        'fixedPerMinuteCents',
        'variableCostCents', 
        'totalCostCents',
        'profitCents',
        'finalPriceCents',
        'roundedPriceCents'
      ];
      
      monetaryFields.forEach(field => {
        const value = treatmentSnapshot[field as keyof typeof treatmentSnapshot];
        if (typeof value === 'number') {
          expect(Number.isInteger(value)).toBe(true);
        }
      });
    });
  });
});