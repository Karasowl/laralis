/**
 * Money utilities for handling currency in cents
 * All monetary values are stored and calculated as integer cents
 */

/**
 * Converts pesos to cents
 * @param pesos Amount in pesos (can have decimals)
 * @returns Amount in integer cents
 */
export function pesosToCents(pesos: number): number {
  return Math.round(pesos * 100);
}

/**
 * Converts cents to pesos
 * @param cents Amount in integer cents
 * @returns Amount in pesos with 2 decimal places
 */
export function centsToPesos(cents: number): number {
  return cents / 100;
}

/**
 * Rounds cents to the nearest step value
 * Used for price rounding to specific increments (e.g., 50 cents, 1 peso)
 * @param cents Amount in cents
 * @param stepCents Step size in cents (e.g., 50 for 0.50 peso increments)
 * @returns Rounded amount in cents
 */
export function roundToNearestStepCents(cents: number, stepCents: number): number {
  if (stepCents <= 0) {
    throw new Error('Step must be positive');
  }
  return Math.round(cents / stepCents) * stepCents;
}

/**
 * Rounds cents to a step with mode control
 * mode: 'nearest' | 'up' | 'down'
 */
export function roundToStepCents(cents: number, stepCents: number, mode: 'nearest' | 'up' | 'down' = 'nearest'): number {
  if (stepCents <= 0) throw new Error('Step must be positive');
  const q = cents / stepCents;
  if (mode === 'up') return Math.ceil(q) * stepCents;
  if (mode === 'down') return Math.floor(q) * stepCents;
  return Math.round(q) * stepCents;
}

/**
 * Formats cents as currency string
 * @param cents Amount in cents
 * @param locale Locale for formatting (default 'es-MX')
 * @returns Formatted currency string
 */
export function formatCurrency(
  cents: number,
  locale: string = 'es-MX'
): string {
  const pesos = centsToPesos(cents);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pesos);
  
  return `$${formatted}`;
}

/**
 * Calculates percentage of an amount
 * @param cents Base amount in cents
 * @param percentage Percentage as decimal (e.g., 0.15 for 15%)
 * @returns Result in cents
 */
export function calculatePercentage(cents: number, percentage: number): number {
  return Math.round(cents * percentage);
}

/**
 * Adds percentage to an amount
 * @param cents Base amount in cents
 * @param percentage Percentage as decimal (e.g., 0.15 for 15%)
 * @returns Total amount in cents
 */
export function addPercentage(cents: number, percentage: number): number {
  return cents + calculatePercentage(cents, percentage);
}

/**
 * Calculates the base amount from a total that includes a percentage
 * @param totalCents Total amount in cents
 * @param percentage Percentage as decimal (e.g., 0.15 for 15%)
 * @returns Base amount in cents
 */
export function removePercentage(totalCents: number, percentage: number): number {
  return Math.round(totalCents / (1 + percentage));
}

/**
 * Validates if a value is a valid money amount in cents
 * @param value Value to validate
 * @returns True if valid cents amount
 */
export function isValidCents(value: any): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Safely adds multiple cent amounts
 * @param amounts Array of amounts in cents
 * @returns Sum in cents
 */
export function sumCents(...amounts: number[]): number {
  return amounts.reduce((sum, amount) => {
    if (!isValidCents(amount)) {
      throw new Error(`Invalid cents amount: ${amount}`);
    }
    return sum + amount;
  }, 0);
}

/**
 * Legacy function name for compatibility
 * Rounds to nearest value (in cents)
 */
export function redondearA(cents: number, stepCents: number): number {
  return roundToNearestStepCents(cents, stepCents);
}

/**
 * Alias for formatCurrency for backward compatibility
 */
export function formatMoney(cents: number, locale: string = 'es-MX'): string {
  return formatCurrency(cents, locale);
}

/**
 * Parses a money string or number to cents
 * @param value String or number representing money amount
 * @returns Amount in cents
 */
export function parseMoney(value: string | number): number {
  if (typeof value === 'number') {
    return pesosToCents(value);
  }

  // Remove currency symbols and parse as float
  const cleanValue = value.replace(/[^0-9.-]/g, '');
  const pesos = parseFloat(cleanValue) || 0;
  return pesosToCents(pesos);
}

/**
 * Formats currency in compact form for chart axes
 * Uses localized abbreviations: "mil" for Spanish, "K" for English
 * @param cents Amount in cents
 * @param locale Locale for formatting (default 'es-MX')
 * @returns Compact formatted currency string
 */
export function formatCompactCurrency(
  cents: number,
  locale: string = 'es-MX'
): string {
  const pesos = centsToPesos(cents);
  const isSpanish = locale.startsWith('es');

  if (Math.abs(pesos) >= 1000000) {
    // Millions
    const millions = pesos / 1000000;
    return `$${millions.toFixed(1)}M`;
  }

  if (Math.abs(pesos) >= 10000) {
    // Thousands (show abbreviated)
    const thousands = pesos / 1000;
    if (isSpanish) {
      return `$${thousands.toFixed(0)} mil`;
    }
    return `$${thousands.toFixed(0)}K`;
  }

  if (Math.abs(pesos) >= 1000) {
    // Small thousands (show with K/mil)
    const thousands = pesos / 1000;
    if (isSpanish) {
      return `$${thousands.toFixed(1)} mil`;
    }
    return `$${thousands.toFixed(1)}K`;
  }

  // Small values - show full
  return `$${pesos.toFixed(0)}`;
}

/**
 * Formats currency for chart axes (value is already in pesos, not cents)
 * Uses localized abbreviations: "mil" for Spanish, "K" for English
 * @param pesos Amount in pesos (not cents)
 * @param locale Locale for formatting (default 'es-MX')
 * @returns Compact formatted currency string
 */
export function formatChartAxis(
  pesos: number,
  locale: string = 'es-MX'
): string {
  const isSpanish = locale.startsWith('es');

  if (Math.abs(pesos) >= 1000000) {
    return `$${(pesos / 1000000).toFixed(1)}M`;
  }

  if (Math.abs(pesos) >= 10000) {
    const thousands = pesos / 1000;
    return isSpanish ? `$${thousands.toFixed(0)} mil` : `$${thousands.toFixed(0)}K`;
  }

  if (Math.abs(pesos) >= 1000) {
    const thousands = pesos / 1000;
    return isSpanish ? `$${thousands.toFixed(1)} mil` : `$${thousands.toFixed(1)}K`;
  }

  return `$${pesos.toFixed(0)}`;
}

/**
 * Applies clinic price rounding configuration to a price in cents
 * @param priceCents Price in cents to round
 * @param roundingPesos Rounding value in pesos (e.g., 10 rounds to $10, $20, $30)
 * @param mode Rounding mode: 'nearest' | 'up' | 'down'
 * @returns Rounded price in cents
 * @example
 * applyPriceRounding(12345, 10) // Returns 12000 ($120 -> $120)
 * applyPriceRounding(12789, 10) // Returns 13000 ($127.89 -> $130)
 * applyPriceRounding(12345, 50) // Returns 12500 ($123.45 -> $125)
 */
export function applyPriceRounding(
  priceCents: number,
  roundingPesos: number = 10,
  mode: 'nearest' | 'up' | 'down' = 'nearest'
): number {
  if (!roundingPesos || roundingPesos <= 0) {
    return priceCents; // No rounding configured
  }

  // Convert rounding from pesos to cents
  const roundingCents = roundingPesos * 100;

  // Apply rounding
  return roundToStepCents(priceCents, roundingCents, mode);
}
