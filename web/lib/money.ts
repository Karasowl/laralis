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