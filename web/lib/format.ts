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
  
  // Format as a decimal number with $ prefix (no currency code)
  const formatted = new Intl.NumberFormat(localeCode, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pesos);
  
  return `$${formatted}`;
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
 * Parses a date string (YYYY-MM-DD) as LOCAL time to avoid timezone drift.
 * When using new Date("2025-12-05"), JS interprets it as UTC midnight,
 * which in timezones behind UTC (like Mexico) becomes the previous day.
 */
function parseLocalDate(dateString: string): Date {
  // Check if it's an ISO date format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
  if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    const [datePart] = dateString.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  // Fallback to native parsing for other formats
  return new Date(dateString);
}

/**
 * Formats a date string or Date object
 */
export function formatDate(
  date: string | Date,
  locale: 'en' | 'es' = 'es'
): string {
  // Parse string dates as local to avoid timezone issues
  const dateObj = typeof date === 'string' ? parseLocalDate(date) : date;
  const localeCode = locale === 'es' ? 'es-MX' : 'en-US';

  return new Intl.DateTimeFormat(localeCode, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(dateObj);
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
    'maintenance': t('fixedCosts.categories.maintenance'),
    'education': t('fixedCosts.categories.education'),
    'advertising': t('fixedCosts.categories.advertising'),
    'other': t('fixedCosts.categories.other'),
  };
  
  return categoryMap[category] || category;
}

/**
 * Helper to get display string for supply categories
 */
export function getSupplyCategoryLabel(category: string, t: (key: string) => string): string {
  try {
    const key = `supplies.categories.${category}`;
    const translation = t(key);
    // Si la traducción es igual a la key, significa que no existe
    return translation === key ? category : translation;
  } catch {
    return category;
  }
}