import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
 * Formats a date string to a localized format
 * @param dateString ISO date string
 * @param locale Locale for formatting (default 'es-MX')
 * @returns Formatted date string
 */
export function formatDate(dateString: string, locale: string = 'es-MX'): string {
  // Parse as local date to avoid timezone issues
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}
/**
 * Returns an ISO date string (YYYY-MM-DD) based on local time instead of UTC.
 * Useful for pre-populating date inputs without timezone drift.
 */
export function getLocalDateISO(value: Date | string | number = new Date()): string {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date passed to getLocalDateISO');
  }
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  const localTime = new Date(date.getTime() - offsetMs);
  return localTime.toISOString().split('T')[0];
}
