/**
 * Formatting utilities for display
 */

/**
 * Formats cents as currency string with proper locale
 */
export function formatCurrency(
  cents: number,
  locale: 'en' | 'es' = 'es'
): string {
  const pesos = cents / 100;
  const localeCode = locale === 'es' ? 'es-MX' : 'en-US';
  
  return new Intl.NumberFormat(localeCode, {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pesos);
}

/**
 * Formats a number with proper locale (no currency symbol)
 */
export function formatNumber(
  value: number,
  locale: 'en' | 'es' = 'es',
  options?: Intl.NumberFormatOptions
): string {
  const localeCode = locale === 'es' ? 'es-MX' : 'en-US';
  
  return new Intl.NumberFormat(localeCode, options).format(value);
}

/**
 * Formats percentage with proper locale
 */
export function formatPercentage(
  decimal: number,
  locale: 'en' | 'es' = 'es',
  decimals: number = 1
): string {
  const localeCode = locale === 'es' ? 'es-MX' : 'en-US';
  
  return new Intl.NumberFormat(localeCode, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(decimal);
}

/**
 * Helper to get display string for fixed cost categories
 */
export function getCategoryDisplayName(category: string, t: (key: string) => string): string {
  const categoryMap: Record<string, string> = {
    'rent': t('fixedCosts.categories.rent'),
    'utilities': t('fixedCosts.categories.utilities'),
    'salaries': t('fixedCosts.categories.salaries'),
    'equipment': t('fixedCosts.categories.equipment'),
    'insurance': t('fixedCosts.categories.insurance'),
    'other': t('fixedCosts.categories.other'),
  };
  
  return categoryMap[category] || category;
}