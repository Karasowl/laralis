/**
 * Break-even point calculations
 */

export interface BreakEvenParams {
  monthlyFixedCostsCents: number;
  averageVariablePercentage: number; // As decimal (0.35 = 35%)
}

export interface BreakEvenResult {
  breakEvenRevenueCents: number;
  contributionMarginPercentage: number;
  requiredServicesCount?: number; // If average service price is provided
}

/**
 * Calculates contribution margin percentage
 */
export function calculateContributionMargin(
  averageVariablePercentage: number
): number {
  if (averageVariablePercentage < 0 || averageVariablePercentage >= 1) {
    throw new Error('Variable percentage must be between 0 and 1');
  }
  return 1 - averageVariablePercentage;
}

/**
 * Calculates break-even revenue
 */
export function calculateBreakEvenRevenue(
  monthlyFixedCostsCents: number,
  contributionMarginPercentage: number
): number {
  if (contributionMarginPercentage <= 0) {
    throw new Error('Contribution margin must be positive');
  }
  return Math.round(monthlyFixedCostsCents / contributionMarginPercentage);
}

/**
 * Calculates break-even point
 */
export function calculateBreakEvenPoint(
  params: BreakEvenParams
): BreakEvenResult {
  const contributionMarginPercentage = calculateContributionMargin(
    params.averageVariablePercentage
  );
  
  const breakEvenRevenueCents = calculateBreakEvenRevenue(
    params.monthlyFixedCostsCents,
    contributionMarginPercentage
  );
  
  return {
    breakEvenRevenueCents,
    contributionMarginPercentage,
  };
}

/**
 * Calculates required number of services to break even
 */
export function calculateRequiredServices(
  breakEvenRevenueCents: number,
  averageServicePriceCents: number
): number {
  if (averageServicePriceCents <= 0) {
    throw new Error('Average service price must be positive');
  }
  return Math.ceil(breakEvenRevenueCents / averageServicePriceCents);
}

/**
 * Calculates safety margin (revenue above break-even)
 */
export function calculateSafetyMargin(
  actualRevenueCents: number,
  breakEvenRevenueCents: number
): {
  amountCents: number;
  percentage: number;
} {
  const marginCents = actualRevenueCents - breakEvenRevenueCents;
  const marginPercentage = breakEvenRevenueCents > 0
    ? marginCents / breakEvenRevenueCents
    : 0;
  
  return {
    amountCents: marginCents,
    percentage: marginPercentage,
  };
}

/**
 * Calculates operating leverage
 */
export function calculateOperatingLeverage(
  contributionMarginCents: number,
  operatingIncomeCents: number
): number {
  if (operatingIncomeCents === 0) {
    return 0;
  }
  return contributionMarginCents / operatingIncomeCents;
}