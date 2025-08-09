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