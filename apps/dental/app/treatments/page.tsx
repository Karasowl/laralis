'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { FormModal } from '@/components/ui/form-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ActionDropdown, createEditAction, createDeleteAction, createRefundAction } from '@/components/ui/ActionDropdown'
import { RefundDialog } from '@/components/ui/RefundDialog'
import { SummaryCards } from '@/components/ui/summary-cards'
import { SmartFilters, useSmartFilter, FilterConfig, FilterValues, detectPreset } from '@/components/ui/smart-filters'
import { TreatmentForm } from './components/TreatmentForm'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { useRequirementsGuard } from '@/lib/requirements/useGuard'
import { toast } from 'sonner'
import { useTreatments, Treatment, Patient, Service } from '@/hooks/use-treatments'
import { PaymentDialog } from './components/PaymentDialog'
import { CreditCard } from 'lucide-react'
import { formatCurrency } from '@/lib/money'
import { getLocalDateISO } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { Calendar, User, DollarSign, FileText, Activity, Clock, Plus, StickyNote, List, Wallet } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { calcularPrecioFinal } from '@/lib/calc/tarifa'
import { useFilteredSummary } from '@/hooks/use-filtered-summary'
import { treatmentSummaryConfig } from '@/lib/calc/summary-configs'

// Helper to check if a date is in the future (for appointment vs treatment distinction)
function isFutureDate(dateStr: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const targetDate = new Date(dateStr + 'T12:00:00')
  targetDate.setHours(0, 0, 0, 0)
  return targetDate > today
}

// Treatment form schema with cross-field validation
const treatmentFormSchema = z.object({
  patient_id: z.string().min(1),
  service_id: z.string().min(1),
  treatment_date: z.string().min(1),
  treatment_time: z.string().optional(), // HH:MM format for appointment time
  quantity: z.number().int().min(1).max(100).optional(),
  minutes: z.number().min(1),
  margin_pct: z.number().min(0), // No upper limit - in-house services can have very high margins
  sale_price: z.number().min(0).optional(), // Price in pesos (converted to cents in hook)
  status: z.enum(['pending', 'completed', 'cancelled']),
  notes: z.string().optional(),
  pending_balance: z.number().min(0).optional(), // Pending balance in pesos (explicit user-marked)
}).refine(
  (data) => {
    // If status is 'completed', require a price > 0
    if (data.status === 'completed') {
      return data.sale_price !== undefined && data.sale_price > 0
    }
    return true
  },
  {
    message: 'treatments.errors.completedRequiresPrice',
    path: ['status'], // Show error on status field
  }
).refine(
  (data) => {
    // If date is in the future (appointment), require treatment_time
    if (isFutureDate(data.treatment_date)) {
      return data.treatment_time !== undefined && data.treatment_time.length > 0
    }
    return true
  },
  {
    message: 'settings.calendar.timeRequired',
    path: ['treatment_time'], // Show error on time field
  }
)

type TreatmentFormData = z.infer<typeof treatmentFormSchema>

const statusOptions = [
  { value: 'pending', label: 'treatments.status.pending' },
  { value: 'completed', label: 'treatments.status.completed' },
  { value: 'cancelled', label: 'treatments.status.cancelled' },
]

export default function TreatmentsPage() {
  const t = useTranslations()
  const tCommon = useTranslations('common')
  const { currentClinic } = useCurrentClinic()
  const searchParams = useSearchParams()
  const patientFilter = searchParams?.get('patient_id') || searchParams?.get('patient') || ''
  const {
    treatments,
    patients,
    services,
    loading,
    isSubmitting,
    createTreatment,
    updateTreatment,
    deleteTreatment,
    fetchTreatments,
    loadRelatedData,
    registerPayment,
    summary
  } = useTreatments({ clinicId: currentClinic?.id, patientId: patientFilter || undefined })

  // Keep a ref of services to use immediately after refresh
  const servicesRef = useRef<Service[]>(services as Service[])
  useEffect(() => { servicesRef.current = services as Service[] }, [services])

  const filteredPatient = (patients || []).find((p: Patient) => p.id === patientFilter)
  const filteredCount = (treatments || []).length

  // Filter state
  const [filterValues, setFilterValues] = useState<FilterValues>({
    treatment_date: { from: '', to: '' },
    status: [],
    service_id: [],
    patient_id: [],
    price_cents: { from: '', to: '' }
  })

  // Type filter: all, appointments (future), treatments (past/completed)
  const [typeFilter, setTypeFilter] = useState<'all' | 'appointments' | 'treatments'>('all')

  // Filter configurations
  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      key: 'treatment_date',
      label: t('treatments.fields.date'),
      type: 'date-range'
    },
    {
      key: 'status',
      label: t('treatments.fields.status'),
      type: 'multi-select',
      options: [
        { value: 'pending', label: t('treatments.status.pending') },
        { value: 'completed', label: t('treatments.status.completed') },
        { value: 'cancelled', label: t('treatments.status.cancelled') }
      ]
    },
    {
      key: 'service_id',
      label: t('treatments.fields.service'),
      type: 'multi-select',
      options: services.map((s: Service) => ({ value: s.id, label: s.name }))
    },
    {
      key: 'patient_id',
      label: t('treatments.filters.patient'),
      type: 'multi-select',
      options: patients.map((p: Patient) => ({
        value: p.id,
        label: `${p.first_name} ${p.last_name}`
      }))
    },
    {
      key: 'price_cents',
      label: t('treatments.fields.price'),
      type: 'number-range',
      multiplier: 100 // User inputs in pesos, data is in cents
    },
    {
      key: 'has_balance',
      label: t('treatments.filters.hasBalance'),
      type: 'boolean'
    }
  ], [t, services, patients])

  // Apply filters to treatments
  const smartFilteredTreatments = useSmartFilter(treatments, filterValues, filterConfigs)

  // Apply balance filter (treatments with explicit pending balance)
  const balanceFilteredTreatments = useMemo(() => {
    if (!filterValues.has_balance) return smartFilteredTreatments
    return smartFilteredTreatments.filter((t: Treatment) =>
      t.pending_balance_cents && t.pending_balance_cents > 0
    )
  }, [smartFilteredTreatments, filterValues.has_balance])

  // Search state
  const [searchTerm, setSearchTerm] = useState('')

  // Apply type filter (all, appointments, treatments)
  const typeFilteredTreatments = useMemo(() => {
    if (typeFilter === 'all') return balanceFilteredTreatments

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return balanceFilteredTreatments.filter((treatment: Treatment) => {
      const treatmentDate = new Date(treatment.treatment_date + 'T12:00:00')
      treatmentDate.setHours(0, 0, 0, 0)
      const isCompleted = treatment.status === 'completed' || treatment.status === 'cancelled'
      const isPast = treatmentDate < today

      if (typeFilter === 'appointments') {
        // Appointments: future dates AND not completed
        return !isPast && !isCompleted
      } else {
        // Treatments: past dates OR completed
        return isPast || isCompleted
      }
    })
  }, [balanceFilteredTreatments, typeFilter])

  // Apply text search filter
  const filteredTreatments = useMemo(() => {
    if (!searchTerm || searchTerm.trim() === '') return typeFilteredTreatments

    const query = searchTerm.toLowerCase().trim()

    return typeFilteredTreatments.filter((treatment: Treatment) => {
      // Search in patient name
      const patient = patients.find((p: Patient) => p.id === treatment.patient_id)
      const patientName = patient
        ? `${patient.first_name} ${patient.last_name}`.toLowerCase()
        : ''
      if (patientName.includes(query)) return true

      // Search in service name
      const service = services.find((s: Service) => s.id === treatment.service_id)
      const serviceName = service?.name?.toLowerCase() || ''
      if (serviceName.includes(query)) return true

      // Search in notes
      const notes = treatment.notes?.toLowerCase() || ''
      if (notes.includes(query)) return true

      return false
    })
  }, [typeFilteredTreatments, searchTerm, patients, services])

  // Get active date period label for summary cards
  const activeDatePeriod = useMemo(() => {
    const dateFilter = filterValues.treatment_date
    if (!dateFilter?.from && !dateFilter?.to) return null // All time, no label needed
    const preset = detectPreset({ from: dateFilter?.from || '', to: dateFilter?.to || '' })
    if (preset === 'allTime') return null
    // Return the preset key to be translated in the render
    return preset
  }, [filterValues.treatment_date])

  // Calculate summary from FILTERED treatments using generic hook
  const filteredSummary = useFilteredSummary(filteredTreatments, treatmentSummaryConfig)

  // Modal states
  const [createOpen, setCreateOpen] = useState(false)
  const [editTreatment, setEditTreatment] = useState<any>(null)
  const [deleteTreatmentData, setDeleteTreatmentData] = useState<any>(null)
  const [refundTreatmentData, setRefundTreatmentData] = useState<Treatment | null>(null)
  const [isRefunding, setIsRefunding] = useState(false)
  const [paymentTreatment, setPaymentTreatment] = useState<Treatment | null>(null)

  // URL params for create/edit from calendar view
  const createParam = searchParams?.get('create')
  const dateParam = searchParams?.get('date')
  const timeParam = searchParams?.get('time')
  const editParam = searchParams?.get('edit')

  // Form
  const treatmentInitialValues: TreatmentFormData = {
    patient_id: '',
    service_id: '',
    treatment_date: getLocalDateISO(),
    treatment_time: '',
    quantity: 1,
    minutes: 30,
    margin_pct: 60,
    sale_price: undefined, // undefined means "calculate from service/margin", 0 would be a valid price
    status: 'pending',
    notes: '',
    pending_balance: 0, // Explicit pending balance (0 = no pending balance)
  }

  const form = useForm<TreatmentFormData>({
    resolver: zodResolver(treatmentFormSchema),
    defaultValues: treatmentInitialValues,
    mode: 'onBlur', // PERFORMANCE: Validate only on blur instead of every keystroke
  })

  // Watch selected service and minutes to calculate base cost
  const selectedServiceId = useWatch({ control: form.control, name: 'service_id' })
  const selectedServiceCostCents = useMemo(() => {
    // CRITICAL FIX: ALWAYS use current service cost from catalog
    // This ensures margin calculations reflect CURRENT pricing, not historical snapshot
    // The historical snapshot is only saved at treatment creation, not used for display
    const service = services.find((s: Service) => s.id === selectedServiceId)
    return service?.total_cost_cents || service?.base_price_cents || service?.price_cents || 0
  }, [services, selectedServiceId])

  // Guard: ensure financial prerequisites before creating treatment
  const { ensureReady } = useRequirementsGuard(() => ({
    clinicId: currentClinic?.id as string
  }))
  const [missingReqs, setMissingReqs] = useState<string[]>([])

  // Handle create from URL params (from calendar view)
  useEffect(() => {
    if (createParam === 'true') {
      const newValues = {
        ...treatmentInitialValues,
        patient_id: patientFilter || '',
        treatment_date: dateParam || getLocalDateISO(),
        treatment_time: timeParam || '',
      }
      form.reset(newValues)
      setCreateOpen(true)
      // Clean up URL params
      window.history.replaceState({}, '', '/treatments')
    }
  }, [createParam, dateParam, timeParam, patientFilter, form])

  // Handle edit from URL params
  useEffect(() => {
    if (editParam && treatments.length > 0) {
      const treatment = treatments.find((t: Treatment) => t.id === editParam)
      if (treatment) {
        setEditTreatment(treatment)
        // Clean up URL params
        window.history.replaceState({}, '', '/treatments')
      }
    }
  }, [editParam, treatments])

  // Submit handlers
  const handleCreate = async (data: TreatmentFormData) => {
    // Just-in-time guard: check tariffs and prerequisites for the selected service
    const ready = await ensureReady('create_treatment', { serviceId: data.service_id })
    if (!ready.allowed) {
      toast.warning(t('onboarding.justInTime.title'))
      setMissingReqs(ready.missing as any)
      return
    }
    setMissingReqs([])
    const success = await createTreatment(data)
    if (success) {
      setCreateOpen(false)
      form.reset()
    }
  }

  // Handler for "Save & Add Another" - saves and keeps modal open
  const handleCreateAndAddAnother = async (data: TreatmentFormData) => {
    const ready = await ensureReady('create_treatment', { serviceId: data.service_id })
    if (!ready.allowed) {
      toast.warning(t('onboarding.justInTime.title'))
      setMissingReqs(ready.missing as any)
      return
    }
    setMissingReqs([])
    const success = await createTreatment(data)
    if (success) {
      // Preserve patient_id and date, reset everything else
      const preservedPatientId = form.getValues('patient_id')
      const preservedDate = form.getValues('treatment_date')
      form.reset({
        ...treatmentInitialValues,
        patient_id: preservedPatientId,
        treatment_date: preservedDate,
      })
      toast.success(t('treatments.savedAddAnother'))
      // Modal stays open (we don't call setCreateOpen(false))
    }
  }

  const handleEdit = async (data: TreatmentFormData) => {
    if (!editTreatment) return

    if (data.service_id !== editTreatment.service_id) {
      toast.error(t('treatments.serviceChangeNotAllowed'))
      form.setValue('service_id', editTreatment.service_id, { shouldDirty: false, shouldTouch: true, shouldValidate: true })
      return
    }

    const success = await updateTreatment(editTreatment.id, data, editTreatment)
    if (success) {
      setEditTreatment(null)
      form.reset()
    }
  }

  const handleDelete = async () => {
    if (!deleteTreatmentData) return
    const success = await deleteTreatment(deleteTreatmentData.id)
    if (success) {
      setDeleteTreatmentData(null)
    }
  }

  const handleRefund = async (reason: string) => {
    if (!refundTreatmentData) return
    setIsRefunding(true)
    try {
      const response = await fetch(`/api/treatments/${refundTreatmentData.id}/refund`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refund_reason: reason })
      })

      if (!response.ok) {
        const errorData = await response.json()
        toast.error(t(errorData.code === 'ALREADY_REFUNDED'
          ? 'treatments.refund.alreadyRefunded'
          : errorData.code === 'CANNOT_REFUND_CANCELLED'
            ? 'treatments.refund.cannotRefundCancelled'
            : 'treatments.refund.error'))
        return
      }

      toast.success(t('treatments.refund.success'))
      setRefundTreatmentData(null)
      // Refresh treatments list
      await fetchTreatments()
    } catch (error) {
      console.error('Error refunding treatment:', error)
      toast.error(t('treatments.refund.error'))
    } finally {
      setIsRefunding(false)
    }
  }

  // Handle service change to update estimated minutes
  const handleServiceChange = (serviceId: string) => {
    form.setValue('service_id', serviceId, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
    const service = services.find((s: Service) => s.id === serviceId)
    if (service && service.est_minutes) {
      form.setValue('minutes', service.est_minutes, { shouldDirty: true })
    }
  }

  // When a new service is created from the wizard, refresh lists and set defaults
  const handleServiceCreated = async (opt: { value: string; label: string }) => {
    try {
      await loadRelatedData()
    } catch { }
    // Select the new service and set minutes if available
    form.setValue('service_id', opt.value)
    const svcList = (servicesRef as any).current || services
    const svc = svcList.find((s: Service) => s.id === opt.value)
    if (svc?.est_minutes) {
      form.setValue('minutes', svc.est_minutes)
    }
  }

  // Table columns - optimized for tablet responsiveness
  // Columns marked with hideOnTablet will be hidden on 768-1024px screens
  const columns = [
    // Combined Date+Time column for tablet (shows on md, hidden on lg where separate columns show)
    // Uses treatment_date as key for sorting (treatment_date_time doesn't exist as a field)
    {
      key: 'treatment_date',
      label: t('treatments.fields.date'),
      sortable: true,
      className: 'lg:hidden', // Only show on tablet, hide on large screens
      render: (_value: any, treatment: Treatment) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <div className="flex flex-col">
            <span>{formatDate(treatment.treatment_date)}</span>
            {treatment?.treatment_time && (
              <span className="text-xs text-muted-foreground">{treatment.treatment_time.slice(0, 5)}</span>
            )}
          </div>
        </div>
      )
    },
    // Separate Date column (hidden on tablet, shows on large screens)
    {
      key: 'treatment_date',
      label: t('treatments.fields.date'),
      sortable: true,
      className: 'hidden lg:table-cell', // Hide on tablet, show on large
      render: (_value: any, treatment: Treatment) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          {formatDate(treatment.treatment_date)}
        </div>
      )
    },
    // Separate Time column (hidden on tablet, shows on large screens)
    {
      key: 'treatment_time',
      label: t('treatments.fields.time'),
      sortable: true,
      className: 'hidden lg:table-cell', // Hide on tablet, show on large
      render: (_value: any, treatment: Treatment) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          {treatment?.treatment_time ? treatment.treatment_time.slice(0, 5) : '—'}
        </div>
      )
    },
    {
      key: 'patient',
      label: t('treatments.fields.patient'),
      render: (_value: any, treatment: Treatment) => {
        const patient = patients.find((p: Patient) => p.id === treatment?.patient_id)
        return patient ? (
          <Link
            href={`/patients/${patient.id}`}
            className="flex items-center gap-2 text-primary hover:underline hover:text-primary/80 transition-colors"
          >
            <User className="h-4 w-4 flex-shrink-0 text-muted-foreground lg:inline hidden" />
            <span className="truncate max-w-[120px] lg:max-w-none">{`${patient.first_name} ${patient.last_name}`}</span>
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 flex-shrink-0 text-muted-foreground lg:inline hidden" />
            {t('common.notAvailable')}
          </div>
        )
      }
    },
    {
      key: 'service',
      label: t('treatments.fields.service'),
      render: (_value: any, treatment: Treatment) => {
        const service = services.find((s: Service) => s.id === treatment?.service_id)
        return (
          <span className="truncate max-w-[100px] lg:max-w-none block">
            {service?.name || t('common.notAvailable')}
          </span>
        )
      }
    },
    // Duration - hidden on tablet (less important)
    {
      key: 'minutes',
      label: t('treatments.fields.duration'),
      hideOnTablet: true,
      render: (value: any) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          {value ?? 0} {t('common.minutes')}
        </div>
      )
    },
    {
      key: 'price',
      label: t('treatments.fields.price'),
      render: (_value: any, treatment: Treatment) => (
        <div className="text-right font-semibold whitespace-nowrap">
          {formatCurrency(treatment?.price_cents || 0)}
        </div>
      )
    },
    // Profit - hidden on tablet (less important, can be derived)
    {
      key: 'profit',
      label: t('treatments.fields.profit'),
      hideOnTablet: true,
      render: (_value: any, treatment: Treatment) => {
        const fixedCost = (treatment?.fixed_cost_per_minute_cents || treatment?.fixed_per_minute_cents || 0) * (treatment?.duration_minutes || treatment?.minutes || 0)
        const variableCost = treatment?.variable_cost_cents || 0
        const totalCost = fixedCost + variableCost
        const profit = (treatment?.price_cents || 0) - totalCost
        return (
          <div className={`text-right font-semibold whitespace-nowrap ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(profit)}
          </div>
        )
      }
    },
    // Notes - shows pending balance badge + notes icon
    {
      key: 'notes',
      label: t('treatments.fields.notes'),
      hideOnTablet: true,
      render: (_value: any, treatment: Treatment) => {
        const hasPendingBalance = treatment?.pending_balance_cents && treatment.pending_balance_cents > 0
        const hasNotes = treatment?.notes && treatment.notes.trim().length > 0

        // If neither pending balance nor notes, show empty indicator
        if (!hasPendingBalance && !hasNotes) {
          return (
            <div className="flex items-center justify-center">
              <span className="text-xs text-muted-foreground">—</span>
            </div>
          )
        }

        return (
          <Popover>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 p-1.5 rounded-md hover:bg-muted transition-colors">
                {hasPendingBalance && (
                  <Badge variant="warning" className="gap-1 text-xs">
                    <Wallet className="h-3 w-3" />
                    {formatCurrency(treatment.pending_balance_cents)}
                  </Badge>
                )}
                {hasNotes && (
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80" side="bottom" collisionPadding={16} avoidCollisions={true}>
              <div className="space-y-3">
                {hasPendingBalance && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        {t('treatments.pendingBalance.label')}
                      </p>
                      <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                        {formatCurrency(treatment.pending_balance_cents)}
                      </p>
                    </div>
                  </div>
                )}
                {hasNotes && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">{t('treatments.fields.notes')}</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{treatment.notes}</p>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )
      }
    },
    {
      key: 'status',
      label: t('treatments.fields.status'),
      render: (_value: any, treatment: Treatment) => (
        treatment?.is_refunded ? (
          <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/30">
            {t('treatments.status.refunded')}
          </Badge>
        ) : (
          <InlineStatusMenu
            value={treatment?.status || 'pending'}
            onChange={async (next) => {
              await updateTreatment(treatment.id, { status: next }, treatment)
            }}
            t={t}
          />
        )
      )
    },
    {
      key: 'actions',
      label: t('common.actions'),
      sortable: false,
      render: (_value: any, treatment: Treatment) => (
        <div className="md:flex md:justify-end">
          <ActionDropdown
            actions={[
              createEditAction(() => {
                // Use the actual saved price
                const actualPricePesos = Math.round((treatment?.price_cents || 0) / 100)
                const actualPriceCents = actualPricePesos * 100

                // CRITICAL FIX: Recalculate margin using CURRENT service cost
                // Don't use historical margin_pct which may be based on old costs
                const currentService = services.find((s: Service) => s.id === treatment?.service_id)
                const currentCostCents = currentService?.total_cost_cents || currentService?.base_price_cents || 0

                // Calculate margin: (price - cost) / cost * 100
                const recalculatedMargin = currentCostCents > 0
                  ? ((actualPriceCents - currentCostCents) / currentCostCents) * 100
                  : (treatment?.margin_pct ?? 60)

                form.reset({
                  patient_id: treatment?.patient_id || '',
                  service_id: treatment?.service_id || '',
                  treatment_date: treatment?.treatment_date || getLocalDateISO(),
                  treatment_time: treatment?.treatment_time || '',
                  minutes: treatment?.minutes ?? 30,
                  margin_pct: Math.round(recalculatedMargin * 10) / 10,
                  sale_price: actualPricePesos,
                  status: treatment?.status || 'pending',
                  notes: treatment?.notes || '',
                  // Convert cents to pesos for form display (explicit pending balance)
                  pending_balance: Math.round((treatment?.pending_balance_cents || 0) / 100),
                })
                setEditTreatment(treatment)
              }, tCommon('edit')),
              // Only show payment action for treatments with explicit pending balance
              ...(treatment?.pending_balance_cents && treatment.pending_balance_cents > 0
                ? [{
                    icon: <CreditCard className="h-4 w-4" />,
                    label: t('treatments.payment.registerPayment'),
                    onClick: () => setPaymentTreatment(treatment),
                  }]
                : []),
              // Only show refund action for completed treatments that are not already refunded
              ...(treatment?.status === 'completed' && !treatment?.is_refunded
                ? [createRefundAction(() => setRefundTreatmentData(treatment), t('treatments.refund.button'))]
                : []),
              createDeleteAction(() => setDeleteTreatmentData(treatment), tCommon('delete'))
            ]}
          />
        </div>
      )
    }
  ]

  // Form options
  const patientOptions = patients.map((patient: Patient) => ({
    value: patient.id,
    label: `${patient.first_name} ${patient.last_name}`
  }))

  const serviceOptions = services.map((service: Service) => ({
    value: service.id,
    label: service.name
  }))

  const statusFormOptions = statusOptions.map(status => ({
    value: status.value,
    label: t(status.label)
  }))

  // Handlers para crear paciente y servicio rápido
  const handleCreatePatient = async (data: any) => {
    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          clinic_id: currentClinic?.id
        })
      })

      if (!response.ok) throw new Error('Failed to create patient')

      const payload = await response.json()
      const newPatient = payload?.data || payload

      // Refrescar la lista de pacientes
      await loadRelatedData()

      return {
        value: newPatient.id,
        label: `${newPatient.first_name} ${newPatient.last_name}`
      }
    } catch (error) {
      console.error('Error creating patient:', error)
      throw error
    }
  }

  const handleCreateService = async (data: any) => {
    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data?.name,
          est_minutes: Number(data?.est_minutes || data?.duration_minutes || 0),
          description: data?.description || undefined,
          category: data?.category || undefined,
          clinic_id: currentClinic?.id
        })
      })

      if (!response.ok) throw new Error('Failed to create service')

      const payload = await response.json()
      const newService = payload?.data || payload

      // Refrescar la lista de servicios
      await loadRelatedData()

      return {
        value: newService.id,
        label: newService.name
      }
    } catch (error) {
      console.error('Error creating service:', error)
      throw error
    }
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-6">
        <PageHeader
          title={t('treatments.title')}
          subtitle={t('treatments.subtitle')}
          actions={
            <Button
              onClick={() => { form.reset({ ...treatmentInitialValues, patient_id: patientFilter || '' }); setCreateOpen(true) }}
              className="whitespace-nowrap"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('treatments.addTreatment')}</span>
              <span className="sm:hidden">{t('common.add')}</span>
            </Button>
          }
        />

        {/* View Toggle Tabs and Type Filter */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-3">
          {/* View Toggle */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-background shadow-sm text-foreground font-medium"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">{t('treatments.views.list')}</span>
            </div>
            <Link
              href="/treatments/calendar"
              className="flex items-center gap-2 px-4 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors"
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">{t('treatments.views.calendar')}</span>
            </Link>
          </div>

          {/* Type Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                typeFilter === 'all'
                  ? 'bg-background shadow-sm text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              {t('settings.calendar.filterAll')}
            </button>
            <button
              onClick={() => setTypeFilter('appointments')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                typeFilter === 'appointments'
                  ? 'bg-background shadow-sm text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              {t('settings.calendar.filterAppointments')}
            </button>
            <button
              onClick={() => setTypeFilter('treatments')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                typeFilter === 'treatments'
                  ? 'bg-background shadow-sm text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              {t('settings.calendar.filterTreatments')}
            </button>
          </div>
        </div>

        {filteredPatient && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg bg-muted/40">
            <div className="text-sm">
              <span className="block sm:inline">{t('treatments.showingTreatmentsFor')}</span>
              <span className="font-semibold"> {filteredPatient.first_name} {filteredPatient.last_name}</span>
              <span className="text-muted-foreground"> — {filteredCount}</span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => window.location.assign(`/patients?view_id=${filteredPatient.id}`)}
                className="flex-1 sm:flex-none text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">{t('treatments.viewPatient')}</span>
                <span className="sm:hidden">{t('patients.patient')}</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.assign('/treatments')}
                className="flex-1 sm:flex-none text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">{t('treatments.removeFilter')}</span>
                <span className="sm:hidden">{t('common.remove')}</span>
              </Button>
            </div>
          </div>
        )}

        <SummaryCards
          cards={[
            {
              label: t('treatments.summary.totalRevenue'),
              value: formatCurrency(filteredSummary.totalRevenue),
              subtitle: t('treatments.summary.allTreatments'),
              periodLabel: activeDatePeriod ? t(`filters.datePresets.${activeDatePeriod}`) : undefined,
              icon: DollarSign,
              color: 'primary'
            },
            {
              label: t('treatments.summary.totalTreatments'),
              value: filteredSummary.totalTreatments.toString(),
              subtitle: t('treatments.summary.registered'),
              periodLabel: activeDatePeriod ? t(`filters.datePresets.${activeDatePeriod}`) : undefined,
              icon: FileText,
              color: 'success'
            },
            {
              label: t('treatments.summary.completionRate'),
              value: `${filteredSummary.completionRate.toFixed(1)}%`,
              subtitle: `${filteredSummary.completedTreatments}/${filteredSummary.totalTreatments}`,
              periodLabel: activeDatePeriod ? t(`filters.datePresets.${activeDatePeriod}`) : undefined,
              icon: Activity,
              color: 'info'
            },
            {
              label: t('treatments.summary.averagePrice'),
              value: formatCurrency(filteredSummary.averagePrice),
              subtitle: t('treatments.summary.perTreatment'),
              periodLabel: activeDatePeriod ? t(`filters.datePresets.${activeDatePeriod}`) : undefined,
              icon: DollarSign,
              color: 'warning'
            },
            {
              label: t('treatments.summary.accountsReceivable'),
              value: formatCurrency(summary.pendingBalanceCents),
              subtitle: t('treatments.summary.treatmentsWithBalance', { count: summary.treatmentsWithBalance }),
              icon: CreditCard,
              color: 'danger'
            },
          ]}
          columns={5}
        />

        <SmartFilters
          filters={filterConfigs}
          values={filterValues}
          onChange={setFilterValues}
          className="mb-4"
        />

        <DataTable
          columns={columns}
          mobileColumns={[
            // Fecha/hora (combined for mobile) - use the combined column
            columns[0], // treatment_date_time combined column
            // Paciente
            columns[3],
            // Servicio
            columns[4],
            // Precio
            columns[6],
            // Notas (Bug #15 fix - was invisible on mobile)
            columns[8],
            // Estado
            columns[9],
            // Acciones
            columns[10]
          ]}
          data={filteredTreatments}
          loading={loading}
          searchPlaceholder={t('treatments.searchPlaceholder')}
          onSearch={setSearchTerm}
          showCount={true}
          countLabel={t('treatments.title').toLowerCase()}
          emptyState={{
            icon: FileText,
            title: t('treatments.emptyTitle'),
            description: t('treatments.emptyDescription')
          }}
        />

        {/* Create Modal */}
        <FormModal
          open={createOpen}
          onOpenChange={(open) => { setCreateOpen(open); if (!open) form.reset(treatmentInitialValues) }}
          title={t('treatments.newTreatment')}
          onSubmit={form.handleSubmit(handleCreate)}
          isSubmitting={isSubmitting}
          maxWidth="2xl"
          secondaryAction={{
            label: t('common.saveAndAddAnother'),
            onClick: form.handleSubmit(handleCreateAndAddAnother),
          }}
        >
          {missingReqs.length > 0 && (
            <div className="mb-4 p-3 border rounded-md bg-amber-50 text-sm">
              <div className="font-medium mb-1">{t('onboarding.justInTime.title')}</div>
              <div className="mb-2">{t('onboarding.justInTime.missing')} {missingReqs.join(', ')}</div>
              <div className="flex flex-wrap gap-2">
                <a href="/time" className="underline text-primary">{t('time.title')}</a>
                <a href="/fixed-costs" className="underline text-primary">{t('fixedCosts.title')}</a>
                <a href="/services" className="underline text-primary">{t('services.title')}</a>
              </div>
            </div>
          )}
          <TreatmentForm
            form={form}
            patients={patientOptions}
            services={serviceOptions}
            statusOptions={statusFormOptions}
            showQuantityField
            onServiceChange={handleServiceChange}
            onCreatePatient={handleCreatePatient}
            onCreateService={handleCreateService}
            onServiceCreated={handleServiceCreated}
            selectedServiceCostCents={selectedServiceCostCents}
            t={t}
          />
        </FormModal>

        {/* Edit Modal */}
        <FormModal
          open={!!editTreatment}
          onOpenChange={(open) => !open && setEditTreatment(null)}
          title={t('treatments.editTreatment')}
          onSubmit={form.handleSubmit(handleEdit)}
          isSubmitting={isSubmitting}
          maxWidth="2xl"
        >
          <TreatmentForm
            form={form}
            patients={patientOptions}
            services={serviceOptions}
            statusOptions={statusFormOptions}
            onServiceChange={handleServiceChange}
            onCreatePatient={handleCreatePatient}
            onCreateService={handleCreateService}
            onServiceCreated={handleServiceCreated}
            selectedServiceCostCents={selectedServiceCostCents}
            serviceLocked
            t={t}
            treatmentId={editTreatment?.id}
          />
        </FormModal>

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={!!deleteTreatmentData}
          onOpenChange={(open) => !open && setDeleteTreatmentData(null)}
          title={t('treatments.deleteTreatment')}
          description={t('treatments.deleteTreatmentConfirm')}
          onConfirm={handleDelete}
          variant="destructive"
        />

        <RefundDialog
          open={!!refundTreatmentData}
          onOpenChange={(open) => !open && setRefundTreatmentData(null)}
          title={t('treatments.refund.title')}
          description={t('treatments.refund.confirmDescription')}
          onConfirm={handleRefund}
          isSubmitting={isRefunding}
        />

        <PaymentDialog
          open={!!paymentTreatment}
          onOpenChange={(open) => !open && setPaymentTreatment(null)}
          treatment={paymentTreatment}
          onSubmit={registerPayment}
        />
      </div>
    </AppLayout>
  )
}

function InlineStatusMenu({ value, onChange, t }: { value: 'pending' | 'completed' | 'cancelled'; onChange: (v: 'pending' | 'completed' | 'cancelled') => void | Promise<void>; t: any }) {
  const statusColors: Record<string, any> = {
    pending: 'warning',
    completed: 'success',
    cancelled: 'destructive'
  }
  const items: Array<{ v: 'pending' | 'completed' | 'cancelled' }> = [
    { v: 'pending' },
    { v: 'completed' },
    { v: 'cancelled' }
  ]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center">
          <Badge variant={statusColors[value] as any} className="cursor-pointer">
            {t(`treatments.status.${value}`)}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {items.map(it => (
          <DropdownMenuItem key={it.v} onSelect={() => onChange(it.v)}>
            {t(`treatments.status.${it.v}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
