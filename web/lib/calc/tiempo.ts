/**
 * Time-based cost calculations
 */

export interface TimeSettings {
  workDaysPerMonth: number;
  hoursPerDay: number;
  effectiveWorkPercentage: number; // As decimal (0.8 = 80%)
}

export interface TimeCosts {
  monthlyFixedCostsCents: number;
  fixedPerMinuteCents: number;
  totalMinutesPerMonth: number;
  effectiveMinutesPerMonth: number;
}

/**
 * Calculates total minutes per month
 */
export function calculateTotalMinutesPerMonth(
  workDaysPerMonth: number,
  hoursPerDay: number
): number {
  return workDaysPerMonth * hoursPerDay * 60;
}

/**
 * Calculates effective working minutes per month
 */
export function calculateEffectiveMinutesPerMonth(
  totalMinutesPerMonth: number,
  effectiveWorkPercentage: number
): number {
  return Math.round(totalMinutesPerMonth * effectiveWorkPercentage);
}

/**
 * Calculates fixed cost per minute
 */
export function calculateFixedCostPerMinute(
  monthlyFixedCostsCents: number,
  effectiveMinutesPerMonth: number
): number {
  // Si no hay minutos efectivos, el costo por minuto es 0
  if (effectiveMinutesPerMonth <= 0) {
    return 0;
  }
  return Math.round(monthlyFixedCostsCents / effectiveMinutesPerMonth);
}

/**
 * Calculates all time-based costs
 */
export function calculateTimeCosts(
  settings: TimeSettings,
  monthlyFixedCostsCents: number
): TimeCosts {
  const totalMinutesPerMonth = calculateTotalMinutesPerMonth(
    settings.workDaysPerMonth,
    settings.hoursPerDay
  );
  
  const effectiveMinutesPerMonth = calculateEffectiveMinutesPerMonth(
    totalMinutesPerMonth,
    settings.effectiveWorkPercentage
  );
  
  const fixedPerMinuteCents = calculateFixedCostPerMinute(
    monthlyFixedCostsCents,
    effectiveMinutesPerMonth
  );
  
  return {
    monthlyFixedCostsCents,
    fixedPerMinuteCents,
    totalMinutesPerMonth,
    effectiveMinutesPerMonth,
  };
}