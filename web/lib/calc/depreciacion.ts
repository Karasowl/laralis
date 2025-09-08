/**
 * Depreciation calculations for equipment and assets
 */

export interface DepreciationParams {
  totalInvestmentCents: number;
  depreciationMonths: number;
}

/**
 * Calculates monthly depreciation using straight-line method
 */
export function calculateMonthlyDepreciation(
  totalInvestmentCents: number,
  depreciationMonths: number
): number {
  if (depreciationMonths <= 0) {
    throw new Error('Depreciation months must be positive');
  }
  return Math.round(totalInvestmentCents / depreciationMonths);
}

/**
 * Calculates accumulated depreciation up to a specific month
 */
export function calculateAccumulatedDepreciation(
  monthlyDepreciationCents: number,
  currentMonth: number
): number {
  if (currentMonth < 0) {
    throw new Error('Current month cannot be negative');
  }
  return monthlyDepreciationCents * currentMonth;
}

/**
 * Calculates remaining book value
 */
export function calculateBookValue(
  totalInvestmentCents: number,
  accumulatedDepreciationCents: number
): number {
  const bookValue = totalInvestmentCents - accumulatedDepreciationCents;
  return Math.max(0, bookValue); // Book value cannot be negative
}

/**
 * Calculates depreciation schedule for all months
 */
export function calculateDepreciationSchedule(
  params: DepreciationParams
): Array<{
  month: number;
  monthlyDepreciationCents: number;
  accumulatedDepreciationCents: number;
  bookValueCents: number;
}> {
  const monthlyDepreciation = calculateMonthlyDepreciation(
    params.totalInvestmentCents,
    params.depreciationMonths
  );
  
  const schedule = [];
  
  for (let month = 1; month <= params.depreciationMonths; month++) {
    const accumulatedDepreciation = calculateAccumulatedDepreciation(
      monthlyDepreciation,
      month
    );
    
    const bookValue = calculateBookValue(
      params.totalInvestmentCents,
      accumulatedDepreciation
    );
    
    schedule.push({
      month,
      monthlyDepreciationCents: monthlyDepreciation,
      accumulatedDepreciationCents: accumulatedDepreciation,
      bookValueCents: bookValue,
    });
  }
  
  return schedule;
}