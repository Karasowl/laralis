'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useParallelApi } from './use-api'
import { 
  generateBusinessInsights, 
  calculateKPIs, 
  TreatmentData, 
  PatientData,
  BusinessInsights 
} from '@/lib/analytics'

interface Treatment {
  id: string
  clinic_id: string
  patient_id: string
  service_id: string
  treatment_date: string
  minutes: number
  fixed_per_minute_cents: number
  variable_cost_cents: number
  margin_pct: number
  price_cents: number
  status: string
  created_at: string
}

interface Patient {
  id: string
  clinic_id: string
  first_name: string
  last_name: string
  created_at: string
}

interface UseReportsOptions {
  clinicId?: string
  autoLoad?: boolean
}

export function useReports(options: UseReportsOptions = {}) {
  const { clinicId, autoLoad = true } = options
  
  // Use parallel API for fetching all report data
  const { fetchAll, loading } = useParallelApi()
  
  // State will be derived from API responses
  const [reportData, setReportData] = useState<{
    treatments: Treatment[]
    patients: Patient[]
  }>({
    treatments: [],
    patients: []
  })

  // Calculate dashboard data using memoization
  const dashboardData = useMemo(() => {
    const { treatments, patients } = reportData
    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()
    
    // Filter current month data
    const monthTreatments = treatments.filter(t => {
      const date = new Date(t.treatment_date)
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear
    })

    const monthPatients = patients.filter(p => {
      const date = new Date(p.created_at)
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear
    })

    // Calculate metrics
    const completedMonth = monthTreatments.filter(t => t.status === 'completed')
    const revenueMonth = completedMonth.reduce((sum, t) => sum + (t.price_cents || 0), 0)
    const margins = completedMonth.map(t => t.margin_pct || 0)
    const averageMargin = margins.length > 0 
      ? margins.reduce((a, b) => a + b, 0) / margins.length
      : 0

    return {
      patientsMonth: monthPatients.length,
      treatmentsMonth: monthTreatments.length,
      revenueMonth,
      averageMargin: Math.round(averageMargin),
      topServices: [],
      monthlyTrend: []
    }
  }, [reportData])

  // Calculate insights and KPIs using memoization
  const { insights, kpis } = useMemo(() => {
    const { treatments, patients } = reportData
    
    if (treatments.length === 0 && patients.length === 0) {
      return { insights: null, kpis: null }
    }

    // Convert to analytics format
    const treatmentAnalytics: TreatmentData[] = treatments.map(t => ({
      id: t.id,
      service_id: t.service_id,
      patient_id: t.patient_id,
      treatment_date: t.treatment_date,
      price_cents: t.price_cents,
      variable_cost_cents: t.variable_cost_cents,
      fixed_per_minute_cents: t.fixed_per_minute_cents,
      minutes: t.minutes,
      margin_pct: t.margin_pct,
      status: t.status
    }))
    
    const patientAnalytics: PatientData[] = patients.map(p => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      created_at: p.created_at
    }))
    
    return {
      insights: generateBusinessInsights(treatmentAnalytics, patientAnalytics),
      kpis: calculateKPIs(treatmentAnalytics, patientAnalytics)
    }
  }, [reportData])

  // Fetch all report data
  const fetchReportsData = useCallback(async () => {
    if (!clinicId) return
    
    try {
      const [treatmentsRes, patientsRes] = await fetchAll<[
        { data: Treatment[] },
        { data: Patient[] }
      ]>([
        { endpoint: `/api/treatments?clinic_id=${clinicId}` },
        { endpoint: `/api/patients?clinic_id=${clinicId}` }
      ])
      
      setReportData({
        treatments: treatmentsRes?.data || [],
        patients: patientsRes?.data || []
      })
    } catch (error) {
      console.error('Error fetching reports data:', error)
    }
  }, [clinicId, fetchAll])

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && clinicId) {
      fetchReportsData()
    }
  }, [autoLoad, clinicId, fetchReportsData])

  return {
    // Calculated data
    dashboardData,
    insights,
    kpis,
    
    // Raw data
    treatments: reportData.treatments,
    patients: reportData.patients,
    
    // State
    loading,
    error: null,
    
    // Operations
    fetchReportsData
  }
}
