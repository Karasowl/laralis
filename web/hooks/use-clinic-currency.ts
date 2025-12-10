'use client'

import { useCallback, useMemo } from 'react'
import { useCurrentClinic } from './use-current-clinic'
import { formatCurrency, formatCompactCurrency, formatChartAxis, CurrencyFormatOptions } from '@/lib/money'

/**
 * Supported currencies with their configurations
 */
export const SUPPORTED_CURRENCIES = [
  { value: 'MXN', label: 'MXN - Peso Mexicano', locale: 'es-MX' },
  { value: 'USD', label: 'USD - Dólar Estadounidense', locale: 'en-US' },
  { value: 'COP', label: 'COP - Peso Colombiano', locale: 'es-CO' },
  { value: 'ARS', label: 'ARS - Peso Argentino', locale: 'es-AR' },
  { value: 'EUR', label: 'EUR - Euro', locale: 'es-ES' },
  { value: 'CLP', label: 'CLP - Peso Chileno', locale: 'es-CL' },
  { value: 'PEN', label: 'PEN - Sol Peruano', locale: 'es-PE' },
  { value: 'BRL', label: 'BRL - Real Brasileño', locale: 'pt-BR' },
] as const

export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number]['value']

/**
 * Supported locales
 */
export const SUPPORTED_LOCALES = [
  { value: 'es-MX', label: 'México' },
  { value: 'es-CO', label: 'Colombia' },
  { value: 'es-AR', label: 'Argentina' },
  { value: 'es-CL', label: 'Chile' },
  { value: 'es-PE', label: 'Perú' },
  { value: 'es-ES', label: 'España' },
  { value: 'en-US', label: 'Estados Unidos' },
  { value: 'pt-BR', label: 'Brasil' },
] as const

export type SupportedLocale = typeof SUPPORTED_LOCALES[number]['value']

/**
 * Hook that provides currency formatting based on the current clinic's configuration
 *
 * @example
 * const { format, formatCompact, currency, locale } = useClinicCurrency()
 * format(10000) // "$100.00" (using clinic's currency)
 * formatCompact(1000000) // "$10 mil" or "$10K" depending on locale
 */
export function useClinicCurrency() {
  const { currentClinic, loading } = useCurrentClinic()

  // Get currency and locale from clinic, with sensible defaults
  const currency = currentClinic?.currency || 'MXN'
  const locale = currentClinic?.locale || 'es-MX'

  // Memoized format options
  const formatOptions: CurrencyFormatOptions = useMemo(() => ({
    currency,
    locale,
  }), [currency, locale])

  // Format function for normal currency display
  const format = useCallback((cents: number): string => {
    return formatCurrency(cents, formatOptions)
  }, [formatOptions])

  // Format function for compact display (charts, summaries)
  const formatCompact = useCallback((cents: number): string => {
    return formatCompactCurrency(cents, locale)
  }, [locale])

  // Format function for chart axes (value already in pesos)
  const formatAxis = useCallback((pesos: number): string => {
    return formatChartAxis(pesos, locale)
  }, [locale])

  // Get currency symbol
  const symbol = useMemo(() => {
    try {
      const parts = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
      }).formatToParts(0)
      return parts.find(p => p.type === 'currency')?.value || '$'
    } catch {
      return '$'
    }
  }, [currency, locale])

  return {
    // Values
    currency,
    locale,
    symbol,
    loading,
    // Format functions
    format,
    formatCompact,
    formatAxis,
    // Raw options for passing to other functions
    formatOptions,
  }
}

/**
 * Get default locale for a currency
 */
export function getDefaultLocaleForCurrency(currency: string): string {
  const found = SUPPORTED_CURRENCIES.find(c => c.value === currency)
  return found?.locale || 'es-MX'
}
