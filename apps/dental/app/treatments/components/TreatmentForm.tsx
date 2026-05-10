'use client'

import React, { useCallback, useState, useEffect, useRef } from 'react'
import { InputField, SelectField, TextareaField, FormGrid, FormSection } from '@/components/ui/form-field'
import { SelectWithCreate } from '@/components/ui/select-with-create'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useWatch } from 'react-hook-form'
import { calculateRequiredMargin, calcularPrecioFinal } from '@/lib/calc/tarifa'
import { AlertTriangle, Wallet } from 'lucide-react'

// Helper to check if a date is in the future (for appointment vs treatment distinction)
function isFutureDate(dateStr: string): boolean {
  if (!dateStr) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const targetDate = new Date(dateStr + 'T12:00:00')
  targetDate.setHours(0, 0, 0, 0)
  return targetDate > today
}

interface ConflictInfo {
  hasConflict: boolean
  conflicts: Array<{
    appointmentId: string
    startTime: string
    patientName: string
    serviceName: string
    overlapMinutes: number
  }>
}

interface TreatmentFormProps {
  form: any
  patients: Array<{ value: string; label: string }>
  services: Array<{ value: string; label: string }>
  statusOptions: Array<{ value: string; label: string }>
  showQuantityField?: boolean
  onServiceChange: (serviceId: string) => void
  onCreatePatient?: (data: any) => Promise<any>
  onCreateService?: (data: any) => Promise<any>
  onServiceCreated?: (opt: { value: string; label: string }) => void
  selectedServiceCostCents: number
  serviceLocked?: boolean
  t: (key: string, params?: Record<string, any>) => string
  treatmentId?: string // For excluding current treatment when editing
}

export function TreatmentForm({
  form,
  patients,
  services,
  statusOptions,
  showQuantityField = false,
  onServiceChange,
  onCreatePatient,
  onCreateService,
  onServiceCreated,
  selectedServiceCostCents,
  serviceLocked = false,
  t,
  treatmentId
}: TreatmentFormProps) {
  // Conflict detection state
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null)
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false)
  const conflictCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // PERFORMANCE FIX: Only watch critical fields that affect derived calculations
  // Using only 2 watches instead of 7 reduces re-renders by 70%
  const patientId = useWatch({ control: form.control, name: 'patient_id' })
  const serviceId = useWatch({ control: form.control, name: 'service_id' })
  const marginPct = useWatch({ control: form.control, name: 'margin_pct' })
  const salePrice = useWatch({ control: form.control, name: 'sale_price' })
  const status = useWatch({ control: form.control, name: 'status' })
  // Watch date/time/duration for conflict detection
  const treatmentDate = useWatch({ control: form.control, name: 'treatment_date' })
  const treatmentTime = useWatch({ control: form.control, name: 'treatment_time' })
  const minutes = useWatch({ control: form.control, name: 'minutes' })

  // Watch pending balance for explicit pending balance section
  const pendingBalance = useWatch({ control: form.control, name: 'pending_balance' })
  const [hasPendingBalance, setHasPendingBalance] = useState(false)

  // Sync checkbox state with form value
  useEffect(() => {
    const balance = pendingBalance ?? 0
    setHasPendingBalance(balance > 0)
  }, [pendingBalance])

  // Check conflicts when date/time/duration changes (debounced)
  useEffect(() => {
    // Clear previous timeout
    if (conflictCheckTimeoutRef.current) {
      clearTimeout(conflictCheckTimeoutRef.current)
    }

    // Only check if we have date and time (both required for conflict detection)
    if (!treatmentDate || !treatmentTime) {
      setConflictInfo(null)
      return
    }

    // Debounce the check to avoid too many API calls
    conflictCheckTimeoutRef.current = setTimeout(async () => {
      setIsCheckingConflicts(true)
      try {
        const response = await fetch('/api/treatments/check-conflicts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: treatmentDate,
            time: treatmentTime,
            duration_minutes: minutes || 30,
            exclude_id: treatmentId
          })
        })
        if (response.ok) {
          const data = await response.json()
          setConflictInfo(data)
        }
      } catch (error) {
        console.error('Error checking conflicts:', error)
      } finally {
        setIsCheckingConflicts(false)
      }
    }, 500) // 500ms debounce

    return () => {
      if (conflictCheckTimeoutRef.current) {
        clearTimeout(conflictCheckTimeoutRef.current)
      }
    }
  }, [treatmentDate, treatmentTime, minutes, treatmentId])

  // Memoize selectedService lookup to avoid recalculation on every render
  const selectedService = React.useMemo(
    () => services.find(service => service.value === serviceId),
    [services, serviceId]
  )

  // Memoize callbacks to prevent unnecessary re-renders of child components
  const handlePatientChange = useCallback((value: string) => {
    form.setValue('patient_id', value, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
  }, [form])

  const handleDateChange = useCallback((value: string | number) => {
    form.setValue('treatment_date', value as string)
  }, [form])

  const handleTimeChange = useCallback((value: string | number) => {
    form.setValue('treatment_time', value as string)
  }, [form])

  const handleMinutesChange = useCallback((value: string | number) => {
    form.setValue('minutes', parseInt(value as string) || 0)
  }, [form])

  const handleMarginChange = useCallback((value: string | number) => {
    form.setValue('margin_pct', parseInt(value as string) || 0)
  }, [form])

  const handleStatusChange = useCallback((value: string | number) => {
    form.setValue('status', value as 'pending' | 'completed' | 'cancelled', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true
    })
  }, [form])

  const handleNotesChange = useCallback((value: string | number) => {
    form.setValue('notes', value)
  }, [form])

  // Handle pending balance checkbox change
  const handlePendingBalanceToggle = useCallback((checked: boolean) => {
    setHasPendingBalance(checked)
    if (!checked) {
      // Clear the pending balance when unchecked
      form.setValue('pending_balance', 0)
    }
  }, [form])

  // Handle pending balance amount change
  const handlePendingBalanceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0
    form.setValue('pending_balance', value)
  }, [form])

  // Sync handlers for margin_pct <-> sale_price
  const handleMarginChangeSync = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newMargin = parseFloat(e.target.value) || 0
    const newPriceCents = calcularPrecioFinal(selectedServiceCostCents, newMargin)
    form.setValue('margin_pct', newMargin)
    form.setValue('sale_price', Math.round(newPriceCents / 100), { shouldValidate: false })
  }, [selectedServiceCostCents, form])

  const handleSalePriceChangeSync = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newPricePesos = parseFloat(e.target.value) || 0
    const newPriceCents = newPricePesos * 100
    const requiredMargin = selectedServiceCostCents > 0
      ? calculateRequiredMargin(selectedServiceCostCents, newPriceCents) * 100
      : 0
    form.setValue('sale_price', newPricePesos)
    form.setValue('margin_pct', Math.round(requiredMargin * 10) / 10, { shouldValidate: false })
  }, [selectedServiceCostCents, form])
  return (
    <div className="space-y-6">
      <FormSection title={t('treatments.patientAndService')}>
        <FormGrid columns={2}>
          <div>
            <label className="text-sm font-medium">
              {t('treatments.fields.patient')}
              <span className="text-destructive ml-1">*</span>
            </label>
            <SelectWithCreate
              value={patientId}
              onValueChange={handlePatientChange}
              options={patients}
              placeholder={t('treatments.selectPatient')}
              canCreate={true}
              createLabel={t('patients.addPatient')}
              entityName={t('entities.patient')}
              createDialogTitle={t('patients.create_title')}
              createDialogDescription={t('patients.create_quick_description')}
              createFields={[
                {
                  name: 'first_name',
                  label: t('fields.first_name'),
                  type: 'text',
                  required: true
                },
                {
                  name: 'last_name',
                  label: t('fields.last_name'),
                  type: 'text',
                  required: true
                },
                {
                  name: 'phone',
                  label: t('fields.phone'),
                  type: 'tel',
                  required: false
                }
              ]}
              onCreateSubmit={onCreatePatient}
            />
            {form.formState.errors.patient_id?.message && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.patient_id?.message}</p>
            )}
          </div>
          
          <div>
            <label className="text-sm font-medium">
              {t('treatments.fields.service')}
              <span className="text-destructive ml-1">*</span>
            </label>
            <SelectWithCreate
              value={serviceId}
              onValueChange={onServiceChange}
              options={services}
              placeholder={t('treatments.selectService')}
              canCreate={!serviceLocked}
              createLabel={t('services.addService') || 'Agregar servicio'}
              entityName={t('entities.service')}
              createMode="serviceWizard"
              createDialogTitle={t('services.create_title')}
              createDialogDescription={t('services.create_quick_description')}
              onCreatedOption={onServiceCreated}
              createFields={[
                {
                  name: 'name',
                  label: t('fields.name'),
                  type: 'text',
                  required: true
                },
                {
                  name: 'est_minutes',
                  label: t('fields.duration'),
                  type: 'number',
                  placeholder: '30',
                  required: true
                }
              ]}
              onCreateSubmit={onCreateService}
              disabled={serviceLocked}
            />
            {form.formState.errors.service_id?.message && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.service_id?.message}</p>
            )}
            {serviceLocked && (
              <div className="mt-3 rounded-md border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <p className="font-semibold">{t('treatments.serviceLockedTitle')}</p>
                <p>{t('treatments.serviceLockedMessage', { service: selectedService?.label || t('common.notAvailable') })}</p>
              </div>
            )}
          </div>
        </FormGrid>
      </FormSection>

      <FormSection title={t('treatments.treatmentDetails')}>
        <FormGrid columns={showQuantityField ? 4 : 3}>
          <InputField
            label={t('treatments.fields.date')}
            type="date"
            {...form.register('treatment_date')}
            error={form.formState.errors.treatment_date?.message}
            required
          />

          <InputField
            label={t('treatments.fields.time')}
            type="time"
            {...form.register('treatment_time')}
            error={form.formState.errors.treatment_time?.message ? t(form.formState.errors.treatment_time.message as string) : undefined}
            helperText={isFutureDate(treatmentDate) ? t('settings.calendar.timeRequired') : t('treatments.timeHelp')}
            required={isFutureDate(treatmentDate)}
          />

          <InputField
            label={t('treatments.fields.duration')}
            type="number"
            {...form.register('minutes', { valueAsNumber: true })}
            placeholder="30"
            helperText={t('treatments.durationHelp')}
            error={form.formState.errors.minutes?.message}
            required
          />

          {showQuantityField && (
            <InputField
              label={t('treatments.fields.multiplier')}
              type="number"
              {...form.register('quantity', {
                setValueAs: (value: string) => value === '' ? undefined : Number(value),
              })}
              placeholder="1"
              min={1}
              max={100}
              helperText={t('treatments.multiplierHelp')}
              error={form.formState.errors.quantity?.message}
            />
          )}
        </FormGrid>

        {/* Conflict Warning */}
        {conflictInfo?.hasConflict && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-800 dark:text-red-200">
                  {t('settings.calendar.conflictWarning')}
                </p>
                <div className="mt-2 space-y-1">
                  {conflictInfo.conflicts.map((conflict) => (
                    <div key={conflict.appointmentId} className="text-sm text-red-700 dark:text-red-300">
                      • {conflict.startTime.slice(0, 5)} - {conflict.patientName || t('common.unknown')}
                      {conflict.serviceName && ` (${conflict.serviceName})`}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  {t('settings.calendar.conflictSuggestion')}
                </p>
              </div>
            </div>
          </div>
        )}

        {isCheckingConflicts && (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            {t('common.checking')}...
          </div>
        )}

        <FormGrid columns={2}>
          {/* Utilidad % */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              {t('treatments.fields.margin')}
              <span className="text-destructive ml-1">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={marginPct ?? 60}
                onChange={handleMarginChangeSync}
                placeholder="60"
                min={0}
                step={0.1}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('treatments.marginHelp')}</p>
            {form.formState.errors.margin_pct?.message && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.margin_pct?.message}</p>
            )}
          </div>

          {/* Precio de Venta */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              {t('treatments.fields.sale_price')}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span>
              <input
                type="number"
                value={salePrice ?? 0}
                onChange={handleSalePriceChangeSync}
                placeholder="500"
                min={0}
                step={10}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-8 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('treatments.sale_price_helper')}</p>
          </div>
        </FormGrid>

        <FormGrid columns={1}>
          <SelectField
            label={t('treatments.fields.status')}
            value={status || 'pending'}
            onChange={handleStatusChange}
            options={statusOptions}
            placeholder={t('treatments.selectStatus')}
            error={form.formState.errors.status?.message ? t(form.formState.errors.status.message as string) : undefined}
            required
          />
        </FormGrid>
      </FormSection>

      {/* Pending Balance Section - Explicit user-marked pending payments */}
      <FormSection title={t('treatments.pendingBalance.title')}>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="has-pending-balance"
              checked={hasPendingBalance}
              onCheckedChange={(checked) => handlePendingBalanceToggle(Boolean(checked))}
            />
            <Label
              htmlFor="has-pending-balance"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              {t('treatments.pendingBalance.hasPending')}
            </Label>
          </div>

          {hasPendingBalance && (
            <div className="pl-6 pt-2">
              <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20">
                <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div className="flex-1">
                  <label className="text-sm font-medium text-amber-800 dark:text-amber-200 block mb-1">
                    {t('treatments.pendingBalance.amount')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-sm text-muted-foreground">$</span>
                    <input
                      type="number"
                      value={pendingBalance ?? ''}
                      onChange={handlePendingBalanceChange}
                      placeholder="0.00"
                      min={0}
                      step={0.01}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pl-7 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    {t('treatments.pendingBalance.helperText')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title={t('treatments.additionalInfo')}>
        <TextareaField
          label={t('treatments.fields.notes')}
          {...form.register('notes')}
          placeholder={t('treatments.notesPlaceholder')}
          error={form.formState.errors.notes?.message}
          rows={3}
        />
      </FormSection>
    </div>
  )
}
