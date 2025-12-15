import { describe, it, expect, beforeEach } from 'vitest'
import {
  isWorkingDay,
  calculateWorkingDaysInMonth,
  calculateWorkingDaysInRange,
  estimateMonthlyWorkingDays,
  detectWorkingDayPattern,
  getEffectivePattern,
  calculateCurrentMonthWorkingDays,
  getDefaultWorkingDaysConfig,
  patternToBoolean,
  type WorkingDaysConfig,
  type TreatmentRecord,
  type DayPattern
} from './dates'

describe('dates.ts - Working Days Calculations', () => {
  describe('isWorkingDay', () => {
    const mondayToSaturday: WorkingDaysConfig['manual'] = {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: false
    }

    it('should identify Monday as working day', () => {
      const monday = new Date('2025-10-20') // Monday
      expect(isWorkingDay(monday, mondayToSaturday)).toBe(true)
    })

    it('should identify Sunday as non-working day', () => {
      const sunday = new Date('2025-10-19') // Sunday
      expect(isWorkingDay(sunday, mondayToSaturday)).toBe(false)
    })

    it('should identify Saturday as working day', () => {
      const saturday = new Date('2025-10-25') // Saturday
      expect(isWorkingDay(saturday, mondayToSaturday)).toBe(true)
    })
  })

  describe('calculateWorkingDaysInMonth', () => {
    it('should calculate correctly for October 2025 with Mon-Sat pattern', () => {
      const pattern: WorkingDaysConfig['manual'] = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: false
      }

      // October 2025 has 31 days
      // Sundays: 5th, 12th, 19th, 26th (4 Sundays)
      // Working days: 31 - 4 = 27
      const result = calculateWorkingDaysInMonth(2025, 10, pattern)

      expect(result.totalDays).toBe(31)
      expect(result.workingDays).toBe(27)
    })

    it('should calculate correctly for February 2025 (non-leap year)', () => {
      const pattern: WorkingDaysConfig['manual'] = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false
      }

      // February 2025 has 28 days
      // Saturdays and Sundays to exclude
      const result = calculateWorkingDaysInMonth(2025, 2, pattern)

      expect(result.totalDays).toBe(28)
      expect(result.workingDays).toBe(20) // 28 - 8 weekend days
    })

    it('should calculate elapsed days correctly', () => {
      const pattern = getDefaultWorkingDaysConfig().manual
      const today = new Date()

      const result = calculateWorkingDaysInMonth(
        today.getFullYear(),
        today.getMonth() + 1,
        pattern
      )

      expect(result.elapsedDays).toBe(today.getDate())
      expect(result.elapsedWorkingDays).toBeGreaterThan(0)
      expect(result.elapsedWorkingDays).toBeLessThanOrEqual(result.elapsedDays)
    })

    it('should calculate remaining days correctly', () => {
      const pattern = getDefaultWorkingDaysConfig().manual
      const today = new Date()

      const result = calculateWorkingDaysInMonth(
        today.getFullYear(),
        today.getMonth() + 1,
        pattern
      )

      expect(result.remainingDays).toBeGreaterThanOrEqual(0)
      expect(result.remainingWorkingDays).toBeGreaterThanOrEqual(0)
      expect(result.elapsedDays + result.remainingDays).toBe(result.totalDays)
    })
  })

  describe('calculateWorkingDaysInRange', () => {
    it('should calculate for a one-week range', () => {
      const pattern: WorkingDaysConfig['manual'] = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false
      }

      const from = new Date('2025-10-20') // Monday
      const to = new Date('2025-10-26') // Sunday

      const result = calculateWorkingDaysInRange(from, to, pattern)

      expect(result.totalDays).toBe(7)
      expect(result.workingDays).toBe(5) // Mon-Fri
    })

    it('should handle single day range', () => {
      const pattern = getDefaultWorkingDaysConfig().manual
      const date = new Date('2025-10-20') // Monday

      const result = calculateWorkingDaysInRange(date, date, pattern)

      expect(result.totalDays).toBe(1)
      expect(result.workingDays).toBe(1) // Monday is working day
    })

    it('should handle cross-month range', () => {
      const pattern: WorkingDaysConfig['manual'] = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: false
      }

      const from = new Date('2025-10-28') // October
      const to = new Date('2025-11-03') // November

      const result = calculateWorkingDaysInRange(from, to, pattern)

      expect(result.totalDays).toBe(7)
      // Should have 1 Sunday (Oct 2 or Nov 2)
      expect(result.workingDays).toBe(6)
    })
  })

  describe('estimateMonthlyWorkingDays', () => {
    it('should estimate ~26 days for Mon-Sat pattern', () => {
      const pattern: WorkingDaysConfig['manual'] = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: false
      }

      const estimate = estimateMonthlyWorkingDays(pattern)

      // 6 days/week * 4.33 weeks = ~26 days
      expect(estimate).toBeGreaterThanOrEqual(25)
      expect(estimate).toBeLessThanOrEqual(27)
    })

    it('should estimate ~22 days for Mon-Fri pattern', () => {
      const pattern: WorkingDaysConfig['manual'] = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false
      }

      const estimate = estimateMonthlyWorkingDays(pattern)

      // 5 days/week * 4.33 weeks = ~22 days
      expect(estimate).toBeGreaterThanOrEqual(21)
      expect(estimate).toBeLessThanOrEqual(23)
    })

    it('should estimate ~30 days for 7-day pattern', () => {
      const pattern: WorkingDaysConfig['manual'] = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true
      }

      const estimate = estimateMonthlyWorkingDays(pattern)

      expect(estimate).toBeGreaterThanOrEqual(29)
      expect(estimate).toBeLessThanOrEqual(31)
    })
  })

  describe('detectWorkingDayPattern', () => {
    it('should return null for insufficient data', () => {
      const treatments: TreatmentRecord[] = [
        { treatment_date: '2025-10-20' },
        { treatment_date: '2025-10-21' }
      ]

      const result = detectWorkingDayPattern(treatments, 60)

      expect(result).toBeNull()
    })

    it('should detect Mon-Fri pattern', () => {
      // Generate 30 treatments on weekdays only
      const treatments: TreatmentRecord[] = []
      const startDate = new Date('2025-09-01')

      for (let i = 0; i < 60; i++) {
        const date = new Date(startDate)
        date.setDate(startDate.getDate() + i)

        // Only add if weekday
        const dayOfWeek = date.getDay()
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          treatments.push({
            treatment_date: date.toISOString().split('T')[0]
          })
        }
      }

      const result = detectWorkingDayPattern(treatments, 60)

      expect(result).not.toBeNull()
      expect(result!.sampleSize).toBeGreaterThan(5)
      expect(result!.pattern.monday).toBeGreaterThan(0.5)
      expect(result!.pattern.friday).toBeGreaterThan(0.5)
      expect(result!.pattern.sunday).toBeLessThan(0.5)
    })

    it('should calculate confidence score', () => {
      const treatments: TreatmentRecord[] = []
      const startDate = new Date('2025-09-01')

      // Generate clear pattern: only Mondays
      for (let i = 0; i < 60; i++) {
        const date = new Date(startDate)
        date.setDate(startDate.getDate() + i)

        if (date.getDay() === 1) { // Monday
          treatments.push({
            treatment_date: date.toISOString().split('T')[0]
          })
        }
      }

      const result = detectWorkingDayPattern(treatments, 60)

      expect(result).not.toBeNull()
      expect(result!.confidence).toBeGreaterThan(0)
      expect(result!.confidence).toBeLessThanOrEqual(100)
    })

    it('should filter old treatments outside lookback window', () => {
      const oldTreatments: TreatmentRecord[] = [
        { treatment_date: '2024-01-01' },
        { treatment_date: '2024-02-01' },
        { treatment_date: '2024-03-01' }
      ]

      const result = detectWorkingDayPattern(oldTreatments, 60)

      expect(result).toBeNull() // Should ignore old data
    })
  })

  describe('patternToBoolean', () => {
    it('should convert high frequencies to true', () => {
      const pattern: DayPattern = {
        monday: 0.95,
        tuesday: 0.90,
        wednesday: 0.85,
        thursday: 0.92,
        friday: 0.88,
        saturday: 0.75,
        sunday: 0.05
      }

      const result = patternToBoolean(pattern)

      expect(result.monday).toBe(true)
      expect(result.tuesday).toBe(true)
      expect(result.sunday).toBe(false)
    })

    it('should use 0.5 as threshold', () => {
      const pattern: DayPattern = {
        monday: 0.51,
        tuesday: 0.49,
        wednesday: 0.50,
        thursday: 0.5,
        friday: 0.5,
        saturday: 0.5,
        sunday: 0.5
      }

      const result = patternToBoolean(pattern)

      expect(result.monday).toBe(true) // >= 0.5
      expect(result.tuesday).toBe(false) // < 0.5
      expect(result.wednesday).toBe(true) // >= 0.5
    })
  })

  describe('getEffectivePattern', () => {
    it('should use historical pattern when confidence >= 60% and enabled', () => {
      const config: WorkingDaysConfig = {
        manual: {
          monday: true,
          tuesday: true,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false
        },
        detected: {
          pattern: {
            monday: 0.9,
            tuesday: 0.9,
            wednesday: 0.9,
            thursday: 0.9,
            friday: 0.9,
            saturday: 0.05,
            sunday: 0.05
          },
          confidence: 80,
          sampleSize: 40,
          lastUpdated: new Date().toISOString()
        },
        useHistorical: true
      }

      const result = getEffectivePattern(config)

      expect(result.monday).toBe(true)
      expect(result.friday).toBe(true)
      expect(result.sunday).toBe(false)
    })

    it('should use manual when confidence < 60%', () => {
      const config: WorkingDaysConfig = {
        manual: {
          monday: true,
          tuesday: false,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false
        },
        detected: {
          pattern: {
            monday: 0.9,
            tuesday: 0.9,
            wednesday: 0.9,
            thursday: 0.9,
            friday: 0.9,
            saturday: 0.9,
            sunday: 0.9
          },
          confidence: 50, // Low confidence
          sampleSize: 5,
          lastUpdated: new Date().toISOString()
        },
        useHistorical: true
      }

      const result = getEffectivePattern(config)

      // Should use manual (only Monday)
      expect(result.monday).toBe(true)
      expect(result.tuesday).toBe(false)
    })

    it('should use manual when useHistorical is false', () => {
      const config: WorkingDaysConfig = {
        manual: {
          monday: true,
          tuesday: true,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false
        },
        detected: {
          pattern: {
            monday: 0.9,
            tuesday: 0.9,
            wednesday: 0.9,
            thursday: 0.9,
            friday: 0.9,
            saturday: 0.05,
            sunday: 0.05
          },
          confidence: 95, // High confidence but disabled
          sampleSize: 100,
          lastUpdated: new Date().toISOString()
        },
        useHistorical: false
      }

      const result = getEffectivePattern(config)

      // Should use manual
      expect(result.monday).toBe(true)
      expect(result.tuesday).toBe(true)
      expect(result.wednesday).toBe(false)
    })

    it('should use manual when no detected pattern', () => {
      const config: WorkingDaysConfig = {
        manual: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: false
        },
        detected: null,
        useHistorical: true
      }

      const result = getEffectivePattern(config)

      expect(result.monday).toBe(true)
      expect(result.saturday).toBe(false)
    })
  })

  describe('getDefaultWorkingDaysConfig', () => {
    it('should return Mon-Sat as default', () => {
      const config = getDefaultWorkingDaysConfig()

      expect(config.manual.monday).toBe(true)
      expect(config.manual.saturday).toBe(true)
      expect(config.manual.sunday).toBe(false)
      expect(config.detected).toBeNull()
      expect(config.useHistorical).toBe(true)
    })
  })

  describe('calculateCurrentMonthWorkingDays', () => {
    it('should calculate for current month using effective pattern', () => {
      const config = getDefaultWorkingDaysConfig()

      const result = calculateCurrentMonthWorkingDays(config)

      expect(result.totalDays).toBeGreaterThan(27) // At least 28 days
      expect(result.workingDays).toBeGreaterThan(0)
      expect(result.elapsedWorkingDays).toBeGreaterThanOrEqual(0)
    })

    it('should correctly calculate remaining working days for a specific mid-month date', () => {
      // Bug scenario: User reports being on day 14 with 20 working days configured
      // System showed "23 días restantes" which is impossible

      // December 2024: 31 total days, using Mon-Sat pattern (typical 26-27 working days)
      const pattern: WorkingDaysConfig['manual'] = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: false
      }

      const result = calculateWorkingDaysInMonth(2024, 12, pattern)

      // Basic sanity checks
      expect(result.totalDays).toBe(31)
      expect(result.workingDays).toBeGreaterThanOrEqual(20) // Should be ~26

      // Key assertion: remainingWorkingDays should NEVER exceed total workingDays
      expect(result.remainingWorkingDays).toBeLessThanOrEqual(result.workingDays)

      // remainingWorkingDays should be >= 0
      expect(result.remainingWorkingDays).toBeGreaterThanOrEqual(0)

      // elapsedWorkingDays + remainingWorkingDays should equal total workingDays
      expect(result.elapsedWorkingDays + result.remainingWorkingDays).toBe(result.workingDays)
    })
  })
})
