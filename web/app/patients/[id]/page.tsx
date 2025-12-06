'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/badge'
import { SummaryCards } from '@/components/ui/summary-cards'
import { Button } from '@/components/ui/button'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { formatCurrency } from '@/lib/money'
import { formatDate } from '@/lib/format'
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Activity,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  User,
  FileText,
  TrendingUp,
  Clock
} from 'lucide-react'

interface Patient {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string
  notes: string | null
  created_at: string
  first_visit_date: string | null
}

interface Treatment {
  id: string
  treatment_date: string
  price_cents: number
  status: 'pending' | 'completed' | 'cancelled'
  duration_minutes: number
  notes: string | null
  service: {
    name: string
  }
}

export default function PatientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations()
  const { currentClinic } = useCurrentClinic()
  const patientId = params?.id as string

  const [patient, setPatient] = useState<Patient | null>(null)
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentClinic?.id || !patientId) return

    async function loadData() {
      setLoading(true)
      try {
        // Load patient info
        const patientRes = await fetch(`/api/patients/${patientId}?clinicId=${currentClinic.id}`)
        if (patientRes.ok) {
          const patientData = await patientRes.json()
          setPatient(patientData.data || patientData)
        }

        // Load patient treatments
        const treatmentsRes = await fetch(`/api/treatments?patient_id=${patientId}&clinicId=${currentClinic.id}`)
        if (treatmentsRes.ok) {
          const treatmentsData = await treatmentsRes.json()
          setTreatments(treatmentsData.data || [])
        }
      } catch (error) {
        console.error('Error loading patient data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [currentClinic?.id, patientId])

  // Calculate statistics
  const completedTreatments = treatments.filter(t => t.status === 'completed')
  const cancelledTreatments = treatments.filter(t => t.status === 'cancelled')
  const totalRevenue = completedTreatments.reduce((sum, t) => sum + (t.price_cents || 0), 0)
  const avgTreatmentPrice = completedTreatments.length > 0
    ? totalRevenue / completedTreatments.length
    : 0

  // Unique services
  const uniqueServices = new Set(treatments.map(t => t.service?.name).filter(Boolean))

  // Table columns for treatments
  const columns = [
    {
      key: 'treatment_date',
      label: t('treatments.fields.date'),
      render: (_value: any, treatment: Treatment) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {formatDate(treatment.treatment_date)}
        </div>
      )
    },
    {
      key: 'service',
      label: t('treatments.fields.service'),
      render: (_value: any, treatment: Treatment) => (
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          {treatment.service?.name || t('common.notAvailable')}
        </div>
      )
    },
    {
      key: 'duration_minutes',
      label: t('treatments.fields.duration'),
      render: (_value: any, treatment: Treatment) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {treatment.duration_minutes || 0} {t('common.minutes')}
        </div>
      )
    },
    {
      key: 'price',
      label: t('treatments.fields.price'),
      render: (_value: any, treatment: Treatment) => (
        <div className="text-right font-semibold">
          {formatCurrency(treatment.price_cents || 0)}
        </div>
      )
    },
    {
      key: 'status',
      label: t('treatments.fields.status'),
      render: (_value: any, treatment: Treatment) => {
        const statusColors = {
          completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
          cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
          pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        }
        return (
          <Badge className={statusColors[treatment.status] || statusColors.pending}>
            {t(`treatments.status.${treatment.status}`)}
          </Badge>
        )
      }
    },
  ]

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">{t('common.loading')}</div>
        </div>
      </AppLayout>
    )
  }

  if (!patient) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <div className="text-muted-foreground">{t('patients.notFound')}</div>
          <Button onClick={() => router.push('/patients')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back')}
          </Button>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title={`${patient.first_name} ${patient.last_name}`}
          description={t('patients.detail_description')}
          actions={
            <Button variant="outline" onClick={() => router.push('/patients')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('common.back')}
            </Button>
          }
        />

        {/* Patient Info Card */}
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {patient.phone && (
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">{t('patients.fields.phone')}</div>
                  <div className="text-sm text-muted-foreground">{patient.phone}</div>
                </div>
              </div>
            )}
            {patient.email && (
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">{t('patients.fields.email')}</div>
                  <div className="text-sm text-muted-foreground">{patient.email}</div>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium">{t('patients.fields.created_at')}</div>
                <div className="text-sm text-muted-foreground">
                  {formatDate(patient.created_at)}
                </div>
              </div>
            </div>
            {patient.first_visit_date && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">{t('patients.fields.first_visit_date')}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(patient.first_visit_date)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {patient.notes && (
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium mb-2">{t('patients.fields.notes')}</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {patient.notes}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Statistics Cards */}
        <SummaryCards
          cards={[
            {
              title: t('patients.stats.total_revenue'),
              value: formatCurrency(totalRevenue),
              icon: DollarSign,
              trend: completedTreatments.length > 0 ? 'up' : undefined,
              description: `${completedTreatments.length} ${t('patients.stats.completed_treatments')}`,
            },
            {
              title: t('patients.stats.avg_treatment_price'),
              value: formatCurrency(avgTreatmentPrice),
              icon: TrendingUp,
              description: t('patients.stats.per_treatment'),
            },
            {
              title: t('patients.stats.total_treatments'),
              value: String(treatments.length),
              icon: Activity,
              description: `${uniqueServices.size} ${t('patients.stats.different_services')}`,
            },
            {
              title: t('patients.stats.completion_rate'),
              value: treatments.length > 0
                ? `${Math.round((completedTreatments.length / treatments.length) * 100)}%`
                : '0%',
              icon: CheckCircle,
              description: `${cancelledTreatments.length} ${t('patients.stats.cancelled')}`,
            },
          ]}
        />

        {/* Treatments Table */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">{t('patients.treatment_history')}</h2>
          <DataTable
            columns={columns}
            mobileColumns={[columns[0], columns[1], columns[3], columns[4]]}
            data={treatments}
            loading={loading}
            searchPlaceholder={t('treatments.searchPlaceholder')}
            showCount={true}
            countLabel={t('treatments.title').toLowerCase()}
            emptyState={{
              icon: Activity,
              title: t('patients.no_treatments_title'),
              description: t('patients.no_treatments_description'),
            }}
          />
        </Card>
      </div>
    </AppLayout>
  )
}
