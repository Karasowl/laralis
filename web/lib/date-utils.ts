/**
 * Date utilities for consistent date handling across the application
 *
 * IMPORTANT: These utilities prevent timezone-related bugs by parsing
 * date strings in YYYY-MM-DD format as local dates instead of UTC.
 */

/**
 * Parse a date string in YYYY-MM-DD format as a local date, not UTC.
 *
 * This prevents timezone shifts that can change the day when converting
 * from UTC to local time.
 *
 * @example
 * // Without this function (WRONG):
 * new Date("2025-10-26") // => 2025-10-25T18:00:00 in UTC-6 timezone
 *
 * // With this function (CORRECT):
 * parseLocalDate("2025-10-26") // => 2025-10-26T00:00:00 in local timezone
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object representing the date at midnight in local timezone
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Format a Date object as YYYY-MM-DD string
 *
 * @param date - Date object to format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateToISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Extract YYYY-MM-DD part from an ISO datetime string
 *
 * @param isoString - ISO datetime string (e.g., "2025-10-26T12:34:56.789Z")
 * @returns Date portion in YYYY-MM-DD format
 */
export function extractDatePart(isoString: string): string {
  return isoString.split('T')[0]
}

/**
 * Check if a date string is valid in YYYY-MM-DD format
 *
 * @param dateStr - Date string to validate
 * @returns true if valid, false otherwise
 */
export function isValidDateString(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false
  const date = parseLocalDate(dateStr)
  return !isNaN(date.getTime())
}
