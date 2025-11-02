/**
 * Tariff and pricing calculations
 */

import { roundToNearestStepCents } from '../money';

export interface TariffParams {
  durationMinutes: number;
  fixedPerMinuteCents: number;
  variableCostCents: number;
  marginPercentage: number; // As decimal (0.4 = 40%)
  roundingStepCents?: number; // Optional rounding step
}

export interface TariffResult {
  fixedCostCents: number;
  variableCostCents: number;
  baseCostCents: number;
  marginCents: number;
  finalPriceCents: number;
  roundedPriceCents?: number;
}

/**
 * Calculates fixed cost based on time
 */
export function calculateFixedCost(
  durationMinutes: number,
  fixedPerMinuteCents: number
): number {
  if (durationMinutes < 0) {
    throw new Error('Duration cannot be negative');
  }
  return Math.round(durationMinutes * fixedPerMinuteCents);
}

/**
 * Calculates base cost (fixed + variable)
 */
export function calculateBaseCost(
  fixedCostCents: number,
  variableCostCents: number
): number {
  return fixedCostCents + variableCostCents;
}

/**
 * Calculates margin amount from base cost
 */
export function calculateMargin(
  baseCostCents: number,
  marginPercentage: number
): number {
  if (marginPercentage < 0) {
    throw new Error('Margin percentage cannot be negative');
  }
  return Math.round(baseCostCents * marginPercentage);
}

/**
 * Calculates final price with margin
 */
export function calculateFinalPrice(
  baseCostCents: number,
  marginCents: number
): number {
  return baseCostCents + marginCents;
}

/**
 * Calculates complete tariff with all components
 */
export function calculateTariff(params: TariffParams): TariffResult {
  const fixedCostCents = calculateFixedCost(
    params.durationMinutes,
    params.fixedPerMinuteCents
  );
  
  const baseCostCents = calculateBaseCost(
    fixedCostCents,
    params.variableCostCents
  );
  
  const marginCents = calculateMargin(baseCostCents, params.marginPercentage);
  
  const finalPriceCents = calculateFinalPrice(baseCostCents, marginCents);
  
  const result: TariffResult = {
    fixedCostCents,
    variableCostCents: params.variableCostCents,
    baseCostCents,
    marginCents,
    finalPriceCents,
  };
  
  if (params.roundingStepCents) {
    result.roundedPriceCents = roundToNearestStepCents(
      finalPriceCents,
      params.roundingStepCents
    );
  }
  
  return result;
}

/**
 * Calculates required margin percentage to achieve target price
 */
export function calculateRequiredMargin(
  baseCostCents: number,
  targetPriceCents: number
): number {
  if (baseCostCents <= 0) {
    throw new Error('Base cost must be positive');
  }
  if (targetPriceCents < baseCostCents) {
    return 0; // Cannot achieve target price below cost
  }
  
  return (targetPriceCents - baseCostCents) / baseCostCents;
}

/**
 * Calculates break-even price (no margin)
 */
export function calculateBreakEvenPrice(
  fixedCostCents: number,
  variableCostCents: number
): number {
  return fixedCostCents + variableCostCents;
}

/**
 * Legacy function name for compatibility
 * Calculates final price from base cost and margin percentage
 */
export function calcularPrecioFinal(
  baseCostCents: number,
  marginPercentage: number
): number {
  const marginDecimal = marginPercentage / 100; // Convert percentage to decimal
  const marginCents = calculateMargin(baseCostCents, marginDecimal);
  return calculateFinalPrice(baseCostCents, marginCents);
}

/**
 * Calculates discount amount based on type
 */
export function calculateDiscountAmount(
  basePriceCents: number,
  discountType: 'none' | 'percentage' | 'fixed',
  discountValue: number
): number {
  if (discountType === 'none' || discountValue === 0) {
    return 0;
  }

  if (discountType === 'percentage') {
    // Percentage discount: value is 0-100
    if (discountValue < 0 || discountValue > 100) {
      throw new Error('Percentage discount must be between 0 and 100');
    }
    return Math.round(basePriceCents * (discountValue / 100));
  }

  if (discountType === 'fixed') {
    // Fixed discount: value is amount in cents
    if (discountValue < 0) {
      throw new Error('Fixed discount cannot be negative');
    }
    // Discount cannot exceed base price
    return Math.min(discountValue, basePriceCents);
  }

  return 0;
}

/**
 * Calculates final price after applying discount
 * @param basePriceCents - Price before discount (in cents)
 * @param discountType - Type of discount ('none', 'percentage', 'fixed')
 * @param discountValue - Discount value (0-100 for percentage, cents for fixed)
 * @returns Final price in cents (never negative)
 */
export function calcularPrecioConDescuento(
  basePriceCents: number,
  discountType: 'none' | 'percentage' | 'fixed',
  discountValue: number
): number {
  if (basePriceCents < 0) {
    throw new Error('Base price cannot be negative');
  }

  const discountAmount = calculateDiscountAmount(
    basePriceCents,
    discountType,
    discountValue
  );

  const finalPrice = basePriceCents - discountAmount;

  // Ensure price never goes below 0
  return Math.max(0, finalPrice);
}

/**
 * Calculates discount percentage from original and final prices
 * Useful for displaying effective discount rate
 */
export function calculateEffectiveDiscountPercentage(
  originalPriceCents: number,
  finalPriceCents: number
): number {
  if (originalPriceCents <= 0) {
    return 0;
  }

  const discountAmount = originalPriceCents - finalPriceCents;
  return (discountAmount / originalPriceCents) * 100;
}