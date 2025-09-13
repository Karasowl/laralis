'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParallelApi } from '@/hooks/use-api'
import { ActivityItem } from '@/components/dashboard/RecentActivity'
import { parseISO } from 'date-fns'

export interface DashboardMetrics {
  revenue: {
    current: number
    previous: number
    change: number
  }
  expenses: {
    current: number
    previous: number
    change: number
  }
  patients: {
    total: number
    new: number
    change: number
  }
  treatments: {
    total: number
    completed: number
    pending: number
  }
  supplies: {
    lowStock: number
    totalValue: number
  }
  appointments: {
    today: number
    week: number
  }
}

export interface ChartData {
  revenue: Array<{ month: string; revenue: number; expenses: number }>
  categories: Array<{ name: string; value: number }>
  services: Array<{ name: string; count: number; revenue: number }>
}

interface UseDashboardOptions {
  clinicId?: string
  period?: 'day' | 'week' | 'month' | 'year' | 'custom'
  from?: string
  to?: string
}

interface DashboardState {
  metrics: DashboardMetrics
  charts: ChartData
  activities: ActivityItem[]
  loading: boolean
  error: string | null
}

// Single Responsibility: Dashboard data aggregation
export class DashboardAggregator {
  static calculateChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  static aggregateMetrics(data: any[]): DashboardMetrics {
    // This would process raw API data into metrics
    // Simplified for example
    return {
      revenue: {
        // Accept multiple shapes: {revenue:{current}}, {total}, {total_cents}
        current: (data[0]?.revenue?.current ?? data[0]?.total ?? data[0]?.total_cents ?? 0),
        previous: (data[0]?.revenue?.previous ?? data[0]?.previous ?? 0),
        change: 0
      },
      expenses: {
        current: (data[1]?.expenses?.current ?? data[1]?.total ?? 0),
        previous: (data[1]?.expenses?.previous ?? data[1]?.previous ?? 0),
        change: 0
      },
      patients: {
        total: (data[2]?.patients?.total ?? data[2]?.total ?? 0),
        new: (data[2]?.patients?.new ?? data[2]?.new ?? 0),
        change: 0
      },
      treatments: {
        total: (data[3]?.treatments?.total ?? data[3]?.total ?? 0),
        completed: (data[3]?.treatments?.completed ?? data[3]?.completed ?? 0),
        pending: (data[3]?.treatments?.pending ?? data[3]?.pending ?? 0)
      },
      supplies: {
        lowStock: data[4]?.supplies?.lowStock || 0,
        totalValue: data[4]?.supplies?.totalValue || 0
      },
      appointments: {
        today: data[5]?.appointments?.today || 0,
        week: data[5]?.appointments?.week || 0
      }
    }
  }

  static processChartData(data: any[]): ChartData {
    return {
      revenue: data[0]?.revenue || [],
      categories: data[1]?.categories || [],
      services: data[2]?.services || []
    }
  }

  static processActivities(data: any): ActivityItem[] {
    const pickArray = (input: any): any[] => {
      if (Array.isArray(input)) return input
      if (input && Array.isArray(input.data)) return input.data
      if (input && input.data && Array.isArray(input.data.data)) return input.data.data
      if (input && Array.isArray(input.items)) return input.items
      if (input && Array.isArray(input.activities)) return input.activities
      return []
    }

    const activities = pickArray(data)

    const toValidDate = (input: any): Date | null => {
      if (!input && input !== 0) return null
      try {
        if (input instanceof Date) {
          return isNaN(input.getTime()) ? null : input
        }
        if (typeof input === 'number') {
          const d = new Date(input)
          return isNaN(d.getTime()) ? null : d
        }
        if (typeof input === 'string') {
          const s = input.trim()
          // Try numeric timestamp in string
          const maybeNum = Number(s)
          if (!Number.isNaN(maybeNum)) {
            const dNum = new Date(maybeNum)
            if (!isNaN(dNum.getTime())) return dNum
          }
          // Try ISO parse first
          const dIso = parseISO(s)
          if (!isNaN(dIso.getTime())) return dIso
          // Fallback to native Date parser
          const d = new Date(s)
          return isNaN(d.getTime()) ? null : d
        }
      } catch {}
      return null
    }

    return activities
      .map((item: any) => {
        const rawTs = item.created_at ?? item.timestamp ?? item.date ?? item.createdAt
        const ts = toValidDate(rawTs)
        if (!ts) return null
        const ai: ActivityItem = {
          id: String(item.id ?? `${item.type ?? 'activity'}-${Math.random().toString(36).slice(2)}`),
          type: (item.type ?? 'treatment') as ActivityItem['type'],
          title: item.title ?? item.name ?? 'Activity',
          description: item.description ?? undefined,
          amount: item.amount_cents ?? item.amount ?? undefined,
          timestamp: ts,
          user: item.user_name ?? item.user ?? undefined
        }
        return ai
      })
      .filter(Boolean) as ActivityItem[]
  }
}

// Main hook following Dependency Inversion
export function useDashboard(options: UseDashboardOptions = {}): DashboardState {
  const { clinicId, period = 'month', from, to } = options
  
  const [state, setState] = useState<DashboardState>({
    metrics: {
      revenue: { current: 0, previous: 0, change: 0 },
      expenses: { current: 0, previous: 0, change: 0 },
      patients: { total: 0, new: 0, change: 0 },
      treatments: { total: 0, completed: 0, pending: 0 },
      supplies: { lowStock: 0, totalValue: 0 },
      appointments: { today: 0, week: 0 }
    },
    charts: {
      revenue: [],
      categories: [],
      services: []
    },
    activities: [],
    loading: true,
    error: null
  })

  const { fetchAll } = useParallelApi()

  const loadDashboardData = useCallback(async () => {
    if (!clinicId) {
      // If there is no clinic selected, don't keep the UI in skeleton state.
      // Render with empty metrics and wait until a clinic is chosen to fetch.
      setState(prev => ({ ...prev, loading: false, error: null }))
      return
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }))

      // Fetch all dashboard data in parallel
      const range = period === 'custom' && from && to ? `&date_from=${from}&date_to=${to}` : ''
      const results = await fetchAll([
        { endpoint: `/api/dashboard/revenue?clinicId=${clinicId}&period=${period}${range}` },
        { endpoint: `/api/dashboard/expenses?clinicId=${clinicId}&period=${period}${range}` },
        { endpoint: `/api/dashboard/patients?clinicId=${clinicId}&period=${period}${range}` },
        { endpoint: `/api/dashboard/treatments?clinicId=${clinicId}&period=${period}${range}` },
        { endpoint: `/api/dashboard/supplies?clinicId=${clinicId}` },
        { endpoint: `/api/dashboard/appointments?clinicId=${clinicId}` },
        { endpoint: `/api/dashboard/charts/revenue?clinicId=${clinicId}&period=${period}${range}` },
        { endpoint: `/api/dashboard/charts/categories?clinicId=${clinicId}&period=${period}${range}` },
        { endpoint: `/api/dashboard/charts/services?clinicId=${clinicId}` },
        { endpoint: `/api/dashboard/activities?clinicId=${clinicId}&limit=10` }
      ])

      // Process metrics
      const metricsData = results.slice(0, 6)
      const metrics = DashboardAggregator.aggregateMetrics(metricsData)
      
      // Calculate changes
      metrics.revenue.change = DashboardAggregator.calculateChange(
        metrics.revenue.current,
        metrics.revenue.previous
      )
      metrics.expenses.change = DashboardAggregator.calculateChange(
        metrics.expenses.current,
        metrics.expenses.previous
      )
      metrics.patients.change = DashboardAggregator.calculateChange(
        metrics.patients.new,
        metrics.patients.total - metrics.patients.new
      )

      // Fallbacks when backend endpoints are not available or return base shapes
      try {
        // Fallback for Treatments metrics using /api/treatments
        if (!metrics.treatments || metrics.treatments.total === 0) {
          const tretRes = await fetch(`/api/treatments?clinicId=${clinicId}`, { credentials: 'include' })
          if (tretRes.ok) {
            const js = await tretRes.json()
            const items = js?.data || js || []
            const nonCancelled = items.filter((t: any) => t.status !== 'cancelled')
            const completed = nonCancelled.filter((t: any) => t.status === 'completed')
            const pending = nonCancelled.filter((t: any) => t.status === 'pending')
            metrics.treatments = {
              total: nonCancelled.length,
              completed: completed.length,
              pending: pending.length
            } as any
            // If revenue.current is 0, compute quick fallback for selected period
            if (!metrics.revenue || metrics.revenue.current === 0) {
              const now = new Date()
              let start = new Date(now)
              let end = new Date(now)
              if (period === 'custom' && from && to) {
                start = new Date(from)
                end = new Date(to)
                end.setHours(23,59,59,999)
              } else if (period === 'today') {
                start.setHours(0, 0, 0, 0)
              } else if (period === 'week') {
                start.setDate(now.getDate() - 7)
              } else if (period === 'month') {
                start = new Date(now.getFullYear(), now.getMonth(), 1)
              } else if (period === 'year') {
                start = new Date(now.getFullYear(), 0, 1)
              }
              const inRange = completed.filter((t: any) => {
                const dt = new Date(t.created_at || t.treatment_date)
                return dt >= start && dt <= end
              })
              const total = inRange.reduce((sum: number, t: any) => sum + (t.price_cents || 0), 0)
              metrics.revenue = metrics.revenue || { current: 0, previous: 0, change: 0 }
              metrics.revenue.current = total
            }
          }
        }
      } catch (e) {
        console.warn('[Dashboard] fallback metrics calc failed', e)
      }

      // Process chart data
      const chartData = results.slice(6, 9)
      const charts = DashboardAggregator.processChartData(chartData)

      // Process activities
      const activities = DashboardAggregator.processActivities(results[9]?.data || results[9])

      setState({
        metrics,
        charts,
        activities,
        loading: false,
        error: null
      })

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error loading dashboard'
      setState(prev => ({ ...prev, error: errorMsg, loading: false }))
      console.error('Dashboard error:', err)
    }
  }, [clinicId, period, fetchAll])

  // Run once on mount and whenever clinicId changes.
  // Also set up auto-refresh only when a clinic is selected.
  useEffect(() => {
    // Always attempt a load to clear skeleton when clinic is missing
    loadDashboardData()

    if (clinicId) {
      const interval = setInterval(loadDashboardData, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [loadDashboardData, clinicId])

  return state
}
