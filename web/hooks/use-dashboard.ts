'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParallelApi } from '@/hooks/use-api'
import { ActivityItem } from '@/components/dashboard/RecentActivity'

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
  period?: 'day' | 'week' | 'month' | 'year'
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
        current: data[0]?.revenue?.current || 0,
        previous: data[0]?.revenue?.previous || 0,
        change: 0
      },
      expenses: {
        current: data[1]?.expenses?.current || 0,
        previous: data[1]?.expenses?.previous || 0,
        change: 0
      },
      patients: {
        total: data[2]?.patients?.total || 0,
        new: data[2]?.patients?.new || 0,
        change: 0
      },
      treatments: {
        total: data[3]?.treatments?.total || 0,
        completed: data[3]?.treatments?.completed || 0,
        pending: data[3]?.treatments?.pending || 0
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

  static processActivities(data: any[]): ActivityItem[] {
    const activities = data || []
    return activities.map(item => ({
      id: item.id,
      type: item.type,
      title: item.title,
      description: item.description,
      amount: item.amount_cents,
      timestamp: new Date(item.created_at),
      user: item.user_name
    }))
  }
}

// Main hook following Dependency Inversion
export function useDashboard(options: UseDashboardOptions = {}): DashboardState {
  const { clinicId, period = 'month' } = options
  
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
      const results = await fetchAll([
        { endpoint: `/api/dashboard/revenue?clinicId=${clinicId}&period=${period}` },
        { endpoint: `/api/dashboard/expenses?clinicId=${clinicId}&period=${period}` },
        { endpoint: `/api/dashboard/patients?clinicId=${clinicId}` },
        { endpoint: `/api/dashboard/treatments?clinicId=${clinicId}` },
        { endpoint: `/api/dashboard/supplies?clinicId=${clinicId}` },
        { endpoint: `/api/dashboard/appointments?clinicId=${clinicId}` },
        { endpoint: `/api/dashboard/charts/revenue?clinicId=${clinicId}` },
        { endpoint: `/api/dashboard/charts/categories?clinicId=${clinicId}` },
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

      // Process chart data
      const chartData = results.slice(6, 9)
      const charts = DashboardAggregator.processChartData(chartData)

      // Process activities
      const activities = DashboardAggregator.processActivities(results[9]?.data)

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
