export type MirroredTreatment = Record<string, unknown>

export type NormalizedTreatment = MirroredTreatment & {
  minutes: unknown
  fixed_per_minute_cents: unknown
  amount_paid_cents: unknown
  is_paid: unknown
  status: string
}

export interface TreatmentListFilters {
  patientId?: string
  dateFrom?: string
  dateTo?: string
  statuses?: string[]
  serviceIds?: string[]
  patientIds?: string[]
  priceFrom?: number
  priceTo?: number
  hasBalance?: boolean
  typeFilter?: 'all' | 'appointments' | 'treatments'
  today: string
  search?: string
  matchingPatientIds?: string[]
  matchingServiceIds?: string[]
}

function normalizeStatus(status: unknown) {
  if (status === 'scheduled' || status === 'in_progress') return 'pending'
  return typeof status === 'string' && status ? status : 'pending'
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

function outstandingBalance(row: MirroredTreatment) {
  if (row.pending_balance_cents !== undefined) {
    return Math.max(0, Math.round(numberValue(row.pending_balance_cents)))
  }
  return Math.max(
    0,
    Math.round(numberValue(row.price_cents)) - Math.round(numberValue(row.amount_paid_cents))
  )
}

function canRegisterPayment(row: MirroredTreatment) {
  const status = normalizeStatus(row.status)
  return row.is_refunded !== true && status !== 'cancelled' && outstandingBalance(row) > 0
}

export function normalizeTreatmentForList(row: MirroredTreatment): NormalizedTreatment {
  return {
    ...row,
    minutes: row.duration_minutes ?? row.minutes ?? 0,
    fixed_per_minute_cents:
      row.fixed_cost_per_minute_cents ?? row.fixed_per_minute_cents ?? 0,
    amount_paid_cents: row.amount_paid_cents ?? 0,
    is_paid: row.is_paid ?? false,
    status: normalizeStatus(row.status),
  }
}

export function summarizeTreatments(rows: MirroredTreatment[]) {
  const activeRows = rows.filter((row) => normalizeStatus(row.status) !== 'cancelled')
  const completedRows = activeRows.filter((row) => normalizeStatus(row.status) === 'completed')
  const successfulRows = completedRows.filter((row) => row.is_refunded !== true)
  const refundedRows = activeRows.filter((row) => row.is_refunded === true)
  const payableRows = rows.filter(canRegisterPayment)
  const totalRevenue = successfulRows.reduce(
    (sum, row) => sum + numberValue(row.price_cents),
    0
  )
  const refundLoss = refundedRows.reduce((sum, row) => {
    const minutes = numberValue(row.duration_minutes ?? row.minutes)
    const fixedPerMinute = numberValue(
      row.fixed_cost_per_minute_cents ?? row.fixed_per_minute_cents
    )
    return sum + fixedPerMinute * minutes + numberValue(row.variable_cost_cents)
  }, 0)

  return {
    totalTreatments: activeRows.length,
    completedTreatments: completedRows.length,
    successfulTreatments: successfulRows.length,
    pendingTreatments: activeRows.filter((row) => normalizeStatus(row.status) === 'pending').length,
    refundedTreatments: refundedRows.length,
    totalRevenue,
    refundLoss,
    netRevenue: totalRevenue - refundLoss,
    averagePrice: successfulRows.length > 0 ? totalRevenue / successfulRows.length : 0,
    completionRate: activeRows.length > 0 ? (completedRows.length / activeRows.length) * 100 : 0,
    treatmentsWithBalance: payableRows.length,
    pendingBalanceCents: payableRows.reduce(
      (sum, row) => sum + outstandingBalance(row),
      0
    ),
  }
}

function matchesFilters(row: MirroredTreatment, filters: TreatmentListFilters) {
  const status = normalizeStatus(row.status)
  const treatmentDate = String(row.treatment_date ?? '').slice(0, 10)
  const patientId = String(row.patient_id ?? '')
  const serviceId = String(row.service_id ?? '')
  const price = numberValue(row.price_cents)

  if (filters.patientId && patientId !== filters.patientId) return false
  if (filters.dateFrom && treatmentDate < filters.dateFrom) return false
  if (filters.dateTo && treatmentDate > filters.dateTo) return false
  if (filters.statuses?.length && !filters.statuses.includes(status)) return false
  if (filters.serviceIds?.length && !filters.serviceIds.includes(serviceId)) return false
  if (filters.patientIds?.length && !filters.patientIds.includes(patientId)) return false
  if (filters.priceFrom !== undefined && price < filters.priceFrom) return false
  if (filters.priceTo !== undefined && price > filters.priceTo) return false
  if (filters.hasBalance && !canRegisterPayment(row)) return false

  if (filters.typeFilter === 'appointments') {
    if (treatmentDate < filters.today || status === 'completed' || status === 'cancelled') return false
  } else if (filters.typeFilter === 'treatments') {
    const isCompleted = status === 'completed' || status === 'cancelled'
    if (treatmentDate >= filters.today && !isCompleted) return false
  }

  const search = filters.search?.trim().toLowerCase()
  if (search) {
    const notesMatch = String(row.notes ?? '').toLowerCase().includes(search)
    const patient = row.patient as Record<string, unknown> | null | undefined
    const service = row.service as Record<string, unknown> | null | undefined
    const patientNameMatch = patient
      ? `${String(patient.first_name ?? '')} ${String(patient.last_name ?? '')}`
          .toLowerCase()
          .includes(search)
      : false
    const serviceNameMatch = service
      ? String(service.name ?? '').toLowerCase().includes(search)
      : false
    const patientMatch = filters.matchingPatientIds?.includes(patientId) ?? false
    const serviceMatch = filters.matchingServiceIds?.includes(serviceId) ?? false
    if (!notesMatch && !patientNameMatch && !serviceNameMatch && !patientMatch && !serviceMatch) return false
  }

  return true
}

export function createTreatmentListPage(params: {
  rows: MirroredTreatment[]
  filters: TreatmentListFilters
  page: number
  pageSize: number
  truncated?: boolean
}) {
  const pageSize = Math.max(1, Math.min(Math.floor(params.pageSize), 100))
  const requestedPage = Math.max(0, Math.floor(params.page))
  const normalizedRows = params.rows.map(normalizeTreatmentForList)
  const scopedRows = params.filters.patientId
    ? normalizedRows.filter(
        (row) => String(row.patient_id ?? '') === params.filters.patientId
      )
    : normalizedRows
  const filteredRows = scopedRows
    .filter((row) => matchesFilters(row, params.filters))
    .sort((left, right) => {
      const byDate = String(right.treatment_date ?? '').localeCompare(
        String(left.treatment_date ?? '')
      )
      if (byDate !== 0) return byDate
      const byTime = String(right.treatment_time ?? '').localeCompare(
        String(left.treatment_time ?? '')
      )
      if (byTime !== 0) return byTime
      return String(right.created_at ?? '').localeCompare(String(left.created_at ?? ''))
    })
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const page = Math.min(requestedPage, pageCount - 1)
  const offset = page * pageSize

  return {
    data: filteredRows.slice(offset, offset + pageSize),
    pagination: {
      page,
      pageSize,
      total: filteredRows.length,
      pageCount,
      truncated: params.truncated === true,
    },
    filteredSummary: summarizeTreatments(filteredRows),
    overallSummary: summarizeTreatments(scopedRows),
  }
}
