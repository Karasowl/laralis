import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date string to a localized format
 * @param dateString ISO date string
 * @param locale Locale for formatting (default 'es-MX')
 * @returns Formatted date string
 */
export function formatDate(dateString: string, locale: string = 'es-MX'): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}