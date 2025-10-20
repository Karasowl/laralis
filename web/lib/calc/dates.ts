/**
 * Date and Working Days Calculation Library
 *
 * Provides utilities for calculating working days, business days,
 * and analyzing historical patterns of clinic operations.
 */

export interface DayPattern {
  monday: number
  tuesday: number
  wednesday: number
  thursday: number
  friday: number
  saturday: number
  sunday: number
}

export interface WorkingDaysConfig {
  manual: {
    monday: boolean
    tuesday: boolean
    wednesday: boolean
    thursday: boolean
    friday: boolean
    saturday: boolean
    sunday: boolean
  }
  detected: {
    pattern: DayPattern
    confidence: number
    sampleSize: number
    lastUpdated: string
  } | null
  useHistorical: boolean
}

export interface WorkingDaysResult {
  totalDays: number
  workingDays: number
  elapsedDays: number
  elapsedWorkingDays: number
  remainingDays: number
  remainingWorkingDays: number
}

/**
 * Converts day name to day of week number (0 = Sunday, 6 = Saturday)
 */
function getDayOfWeekNumber(dayName: keyof DayPattern): number {
  const mapping: Record<keyof DayPattern, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  }
  return mapping[dayName]
}

/**
 * Converts day of week number to day name
 */
function getDayName(dayNumber: number): keyof DayPattern {
  const days: (keyof DayPattern)[] = [
    'sunday', 'monday', 'tuesday', 'wednesday',
    'thursday', 'friday', 'saturday'
  ]
  return days[dayNumber]
}

/**
 * Creates a boolean pattern from frequency pattern (threshold = 0.5)
 */
export function patternToBoolean(pattern: DayPattern): WorkingDaysConfig['manual'] {
  return {
    monday: pattern.monday >= 0.5,
    tuesday: pattern.tuesday >= 0.5,
    wednesday: pattern.wednesday >= 0.5,
    thursday: pattern.thursday >= 0.5,
    friday: pattern.friday >= 0.5,
    saturday: pattern.saturday >= 0.5,
    sunday: pattern.sunday >= 0.5
  }
}

/**
 * Checks if a specific date is a working day according to pattern
 */
export function isWorkingDay(
  date: Date,
  pattern: WorkingDaysConfig['manual']
): boolean {
  const dayOfWeek = date.getDay()
  const dayName = getDayName(dayOfWeek)
  return pattern[dayName]
}

/**
 * Calculate working days in a specific month
 */
export function calculateWorkingDaysInMonth(
  year: number,
  month: number, // 1-12
  pattern: WorkingDaysConfig['manual']
): WorkingDaysResult {
  const today = new Date()
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0) // Last day of month

  const totalDays = endDate.getDate()
  let workingDays = 0
  let elapsedDays = 0
  let elapsedWorkingDays = 0

  // Count working days and elapsed working days
  for (let day = 1; day <= totalDays; day++) {
    const currentDate = new Date(year, month - 1, day)
    const isWorking = isWorkingDay(currentDate, pattern)

    if (isWorking) {
      workingDays++
    }

    // Check if this day has elapsed
    if (
      currentDate.getFullYear() === today.getFullYear() &&
      currentDate.getMonth() === today.getMonth() &&
      day <= today.getDate()
    ) {
      elapsedDays++
      if (isWorking) {
        elapsedWorkingDays++
      }
    }
  }

  return {
    totalDays,
    workingDays,
    elapsedDays,
    elapsedWorkingDays,
    remainingDays: totalDays - elapsedDays,
    remainingWorkingDays: workingDays - elapsedWorkingDays
  }
}

/**
 * Calculate working days in a date range
 */
export function calculateWorkingDaysInRange(
  fromDate: Date,
  toDate: Date,
  pattern: WorkingDaysConfig['manual']
): WorkingDaysResult {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const start = new Date(fromDate)
  start.setHours(0, 0, 0, 0)

  const end = new Date(toDate)
  end.setHours(0, 0, 0, 0)

  let totalDays = 0
  let workingDays = 0
  let elapsedDays = 0
  let elapsedWorkingDays = 0

  const currentDate = new Date(start)

  while (currentDate <= end) {
    totalDays++
    const isWorking = isWorkingDay(currentDate, pattern)

    if (isWorking) {
      workingDays++
    }

    if (currentDate <= today) {
      elapsedDays++
      if (isWorking) {
        elapsedWorkingDays++
      }
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return {
    totalDays,
    workingDays,
    elapsedDays,
    elapsedWorkingDays,
    remainingDays: totalDays - elapsedDays,
    remainingWorkingDays: workingDays - elapsedWorkingDays
  }
}

/**
 * Estimate average monthly working days based on pattern
 * Useful for simulations and projections
 */
export function estimateMonthlyWorkingDays(
  pattern: WorkingDaysConfig['manual']
): number {
  // Count how many days per week are working days
  const daysPerWeek = Object.values(pattern).filter(Boolean).length

  // Average 4.33 weeks per month
  return Math.round(daysPerWeek * 4.33)
}

/**
 * Analyze historical treatment data to detect working day pattern
 */
export interface TreatmentRecord {
  treatment_date: string // ISO date string
}

export function detectWorkingDayPattern(
  treatments: TreatmentRecord[],
  lookbackDays: number = 60
): WorkingDaysConfig['detected'] | null {
  const minSampleSize = 5

  if (treatments.length < minSampleSize) {
    return null
  }

  // Filter treatments to last N days
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)

  const recentTreatments = treatments.filter(t => {
    const treatmentDate = new Date(t.treatment_date)
    return treatmentDate >= cutoffDate
  })

  if (recentTreatments.length < minSampleSize) {
    return null
  }

  // Count occurrences of each day of week
  const dayCounts: Record<string, number> = {
    sunday: 0,
    monday: 0,
    tuesday: 0,
    wednesday: 0,
    thursday: 0,
    friday: 0,
    saturday: 0
  }

  // Also count total possible occurrences of each day in the period
  const dayOpportunities: Record<string, number> = {
    sunday: 0,
    monday: 0,
    tuesday: 0,
    wednesday: 0,
    thursday: 0,
    friday: 0,
    saturday: 0
  }

  // Count opportunities for each day
  const startDate = new Date(cutoffDate)
  const endDate = new Date()
  let currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    const dayName = getDayName(currentDate.getDay())
    dayOpportunities[dayName]++
    currentDate.setDate(currentDate.getDate() + 1)
  }

  // Count actual treatment days
  recentTreatments.forEach(t => {
    const date = new Date(t.treatment_date)
    const dayName = getDayName(date.getDay())
    dayCounts[dayName]++
  })

  // Calculate frequency for each day (0-1)
  const pattern: DayPattern = {
    sunday: dayOpportunities.sunday > 0 ? dayCounts.sunday / dayOpportunities.sunday : 0,
    monday: dayOpportunities.monday > 0 ? dayCounts.monday / dayOpportunities.monday : 0,
    tuesday: dayOpportunities.tuesday > 0 ? dayCounts.tuesday / dayOpportunities.tuesday : 0,
    wednesday: dayOpportunities.wednesday > 0 ? dayCounts.wednesday / dayOpportunities.wednesday : 0,
    thursday: dayOpportunities.thursday > 0 ? dayCounts.thursday / dayOpportunities.thursday : 0,
    friday: dayOpportunities.friday > 0 ? dayCounts.friday / dayOpportunities.friday : 0,
    saturday: dayOpportunities.saturday > 0 ? dayCounts.saturday / dayOpportunities.saturday : 0
  }

  // Calculate confidence score (0-100)
  // Higher confidence when:
  // - More samples
  // - Clear distinction between working/non-working days
  const sampleSize = recentTreatments.length
  const sampleScore = Math.min(100, (sampleSize / 30) * 100) // Max at 30 treatments

  // Calculate clarity: difference between highest and lowest frequencies
  const frequencies = Object.values(pattern)
  const maxFreq = Math.max(...frequencies)
  const minFreq = Math.min(...frequencies)
  const clarityScore = (maxFreq - minFreq) * 100

  // Combined confidence score (weighted average)
  const confidence = Math.round((sampleScore * 0.6) + (clarityScore * 0.4))

  return {
    pattern,
    confidence,
    sampleSize,
    lastUpdated: new Date().toISOString()
  }
}

/**
 * Get effective working days pattern based on priority system
 */
export function getEffectivePattern(
  config: WorkingDaysConfig
): WorkingDaysConfig['manual'] {
  // Priority 1: Use historical if available, confidence >= 60%, and user wants it
  if (
    config.useHistorical &&
    config.detected &&
    config.detected.confidence >= 60
  ) {
    return patternToBoolean(config.detected.pattern)
  }

  // Priority 2: Use manual configuration
  return config.manual
}

/**
 * Calculate working days for current month using smart config
 */
export function calculateCurrentMonthWorkingDays(
  config: WorkingDaysConfig
): WorkingDaysResult {
  const pattern = getEffectivePattern(config)
  const today = new Date()

  return calculateWorkingDaysInMonth(
    today.getFullYear(),
    today.getMonth() + 1,
    pattern
  )
}

/**
 * Default working days configuration (Monday-Saturday)
 */
export function getDefaultWorkingDaysConfig(): WorkingDaysConfig {
  return {
    manual: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: false
    },
    detected: null,
    useHistorical: true
  }
}
