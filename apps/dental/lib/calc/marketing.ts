/**
 * Marketing Calculations Engine
 *
 * Fórmulas de negocio para cálculos de marketing:
 * - CAC (Customer Acquisition Cost)
 * - LTV (Lifetime Value)
 * - ROI (Return on Investment)
 * - Conversion Rate
 * - LTV/CAC Ratio
 *
 * IMPORTANTE: Todos los montos deben estar en CENTAVOS (integers)
 */

/**
 * Calcula el CAC (Costo de Adquisición por Cliente)
 *
 * @param marketingExpensesCents - Total de gastos de marketing en centavos
 * @param newPatients - Número de pacientes nuevos adquiridos
 * @returns CAC en centavos, o 0 si no hay pacientes
 *
 * @example
 * calculateCAC(1000000, 20) // $10,000 / 20 pacientes = $500 por paciente
 * // returns 50000 (centavos)
 */
export function calculateCAC(
  marketingExpensesCents: number,
  newPatients: number
): number {
  if (newPatients <= 0) return 0
  if (marketingExpensesCents < 0) return 0

  return Math.round(marketingExpensesCents / newPatients)
}

/**
 * Calcula el LTV (Lifetime Value) como promedio de ingresos por paciente
 *
 * @param totalRevenueCents - Ingresos totales de todos los pacientes en centavos
 * @param totalPatients - Número total de pacientes
 * @returns LTV promedio en centavos, o 0 si no hay pacientes
 *
 * @example
 * calculateLTV(10000000, 50) // $100,000 / 50 pacientes = $2,000 por paciente
 * // returns 200000 (centavos)
 */
export function calculateLTV(
  totalRevenueCents: number,
  totalPatients: number
): number {
  if (totalPatients <= 0) return 0
  if (totalRevenueCents < 0) return 0

  return Math.round(totalRevenueCents / totalPatients)
}

/**
 * Calcula el ROI (Return on Investment) de marketing
 *
 * @param revenueCents - Ingresos generados en centavos
 * @param investmentCents - Inversión realizada en centavos
 * @returns ROI como porcentaje (número entre -100 y +∞)
 *
 * @example
 * calculateROI(5000000, 1000000) // ($50,000 - $10,000) / $10,000 × 100
 * // returns 400 (400% ROI)
 */
export function calculateROI(
  revenueCents: number,
  investmentCents: number
): number {
  if (investmentCents <= 0) return 0
  if (revenueCents < 0) return -100

  const profit = revenueCents - investmentCents
  const roi = (profit / investmentCents) * 100

  return Math.round(roi * 100) / 100 // Redondear a 2 decimales
}

/**
 * Calcula la tasa de conversión de leads a pacientes
 *
 * @param convertedPatients - Número de pacientes que realizaron tratamiento
 * @param totalLeads - Número total de leads/pacientes registrados
 * @returns Tasa de conversión como porcentaje (0-100)
 *
 * @example
 * calculateConversionRate(25, 200) // 25 / 200 × 100
 * // returns 12.5 (12.5%)
 */
export function calculateConversionRate(
  convertedPatients: number,
  totalLeads: number
): number {
  if (totalLeads <= 0) return 0
  if (convertedPatients < 0) return 0

  const rate = (convertedPatients / totalLeads) * 100

  return Math.round(rate * 100) / 100 // Redondear a 2 decimales
}

/**
 * Calcula el ratio LTV/CAC
 *
 * Benchmarks de la industria:
 * - ≥ 3:1 → Excelente ✅
 * - 2-3:1 → Bueno 👍
 * - 1-2:1 → Aceptable ⚠️
 * - < 1:1 → Crítico ❌ (perdiendo dinero)
 *
 * @param ltvCents - Lifetime Value en centavos
 * @param cacCents - Customer Acquisition Cost en centavos
 * @returns Ratio LTV/CAC, o 0 si CAC es 0
 *
 * @example
 * calculateLTVCACRatio(200000, 50000) // $2,000 / $500
 * // returns 4.00 (ratio 4:1 - Excelente)
 */
export function calculateLTVCACRatio(
  ltvCents: number,
  cacCents: number
): number {
  if (cacCents <= 0) return 0
  if (ltvCents < 0) return 0

  const ratio = ltvCents / cacCents

  return Math.round(ratio * 100) / 100 // Redondear a 2 decimales
}

/**
 * Determina la calidad del ratio LTV/CAC
 *
 * @param ratio - Ratio LTV/CAC
 * @returns Clasificación del ratio
 */
export function getLTVCACRatioQuality(ratio: number): {
  label: 'excellent' | 'good' | 'acceptable' | 'critical' | 'unknown'
  color: 'green' | 'blue' | 'yellow' | 'red' | 'gray'
  message: string
} {
  if (ratio >= 3) {
    return {
      label: 'excellent',
      color: 'green',
      message: 'Excelente. Cada peso invertido genera más de 3 pesos'
    }
  }

  if (ratio >= 2) {
    return {
      label: 'good',
      color: 'blue',
      message: 'Bueno. Modelo sostenible con margen saludable'
    }
  }

  if (ratio >= 1) {
    return {
      label: 'acceptable',
      color: 'yellow',
      message: 'Aceptable. Considera optimizar canales de adquisición'
    }
  }

  if (ratio > 0) {
    return {
      label: 'critical',
      color: 'red',
      message: 'Crítico. Estás perdiendo dinero en adquisición de clientes'
    }
  }

  return {
    label: 'unknown',
    color: 'gray',
    message: 'Datos insuficientes para calcular el ratio'
  }
}

/**
 * Calcula el CAC objetivo basado en LTV deseado y ratio target
 *
 * @param desiredLTVCents - LTV objetivo en centavos
 * @param targetRatio - Ratio LTV/CAC objetivo (default: 3)
 * @returns CAC objetivo en centavos
 *
 * @example
 * calculateTargetCAC(200000, 3) // $2,000 / 3
 * // returns 66667 (≈ $667 CAC objetivo)
 */
export function calculateTargetCAC(
  desiredLTVCents: number,
  targetRatio: number = 3
): number {
  if (targetRatio <= 0) return 0
  if (desiredLTVCents < 0) return 0

  return Math.round(desiredLTVCents / targetRatio)
}

/**
 * Calcula proyección de crecimiento de pacientes
 *
 * @param currentPatients - Pacientes actuales
 * @param previousPatients - Pacientes periodo anterior
 * @returns Porcentaje de crecimiento, o null cuando no existe una base válida
 *
 * @example
 * calculateGrowthRate(120, 100) // (120 - 100) / 100 × 100
 * // returns 20.00 (20% de crecimiento)
 */
export function calculateGrowthRate(
  currentPatients: number,
  previousPatients: number
): number | null {
  if (previousPatients <= 0) return currentPatients === 0 ? 0 : null

  const growth = ((currentPatients - previousPatients) / previousPatients) * 100

  return Math.round(growth * 100) / 100 // Redondear a 2 decimales
}

/**
 * Calcula el payback period (tiempo para recuperar inversión)
 *
 * @param cacCents - Customer Acquisition Cost en centavos
 * @param averageMonthlyRevenueCents - Ingreso mensual promedio por paciente en centavos
 * @returns Meses necesarios para recuperar inversión, o 0 si revenue es 0
 *
 * @example
 * calculatePaybackPeriod(50000, 20000) // $500 / $200 por mes
 * // returns 2.5 (2.5 meses para recuperar inversión)
 */
export function calculatePaybackPeriod(
  cacCents: number,
  averageMonthlyRevenueCents: number
): number {
  if (averageMonthlyRevenueCents <= 0) return 0
  if (cacCents <= 0) return 0

  const months = cacCents / averageMonthlyRevenueCents

  return Math.round(months * 10) / 10 // Redondear a 1 decimal
}
