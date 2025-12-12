'use client'

import { useEffect, useMemo } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { formatCurrency, centsToPesos, pesosToCents } from '@/lib/money'
import type { QuoteWithRelations, CreateQuoteData } from '@/hooks/use-quotes'
import type { Patient, Service } from '@/lib/types'

const quoteItemSchema = z.object({
  service_id: z.string().nullable().optional(),
  service_name: z.string().min(1, 'Service name is required'),
  service_description: z.string().nullable().optional(),
  quantity: z.number().int().min(1),
  unit_price: z.number().min(0),
  discount_type: z.enum(['none', 'percentage', 'fixed']),
  discount_value: z.number().min(0),
  tooth_number: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

const quoteSchema = z.object({
  patient_id: z.string().uuid('Please select a patient'),
  quote_date: z.string().min(1, 'Date is required'),
  validity_days: z.number().int().min(1).max(365),
  discount_type: z.enum(['none', 'percentage', 'fixed']),
  discount_value: z.number().min(0),
  tax_rate: z.number().min(0).max(100),
  notes: z.string().nullable().optional(),
  patient_notes: z.string().nullable().optional(),
  terms_conditions: z.string().nullable().optional(),
  items: z.array(quoteItemSchema).min(1, 'At least one service is required'),
})

type QuoteFormData = z.infer<typeof quoteSchema>

interface QuoteFormProps {
  quote?: QuoteWithRelations | null
  patients: Patient[]
  services: Service[]
  onSubmit: (data: CreateQuoteData) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export function QuoteForm({
  quote,
  patients,
  services,
  onSubmit,
  onCancel,
  loading,
}: QuoteFormProps) {
  const t = useTranslations()

  const defaultValues: QuoteFormData = {
    patient_id: quote?.patient_id || '',
    quote_date: quote?.quote_date || new Date().toISOString().split('T')[0],
    validity_days: quote?.validity_days || 30,
    discount_type: quote?.discount_type || 'none',
    discount_value: quote?.discount_value || 0,
    tax_rate: quote?.tax_rate || 0,
    notes: quote?.notes || '',
    patient_notes: quote?.patient_notes || '',
    terms_conditions: quote?.terms_conditions || '',
    items: quote?.items?.map((item) => ({
      service_id: item.service_id || null,
      service_name: item.service_name,
      service_description: item.service_description || '',
      quantity: item.quantity,
      unit_price: centsToPesos(item.unit_price_cents),
      discount_type: item.discount_type || 'none',
      discount_value: item.discount_value || 0,
      tooth_number: item.tooth_number || '',
      notes: item.notes || '',
    })) || [{
      service_id: null,
      service_name: '',
      service_description: '',
      quantity: 1,
      unit_price: 0,
      discount_type: 'none' as const,
      discount_value: 0,
      tooth_number: '',
      notes: '',
    }],
  }

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema),
    defaultValues,
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  const watchItems = form.watch('items')
  const watchDiscountType = form.watch('discount_type')
  const watchDiscountValue = form.watch('discount_value')
  const watchTaxRate = form.watch('tax_rate')

  // Calculate totals
  const totals = useMemo(() => {
    let subtotal = 0

    watchItems.forEach((item) => {
      const itemSubtotal = item.quantity * item.unit_price
      let itemDiscount = 0

      if (item.discount_type === 'percentage') {
        itemDiscount = itemSubtotal * (item.discount_value / 100)
      } else if (item.discount_type === 'fixed') {
        itemDiscount = item.discount_value
      }

      subtotal += itemSubtotal - itemDiscount
    })

    let globalDiscount = 0
    if (watchDiscountType === 'percentage') {
      globalDiscount = subtotal * (watchDiscountValue / 100)
    } else if (watchDiscountType === 'fixed') {
      globalDiscount = watchDiscountValue
    }

    const afterDiscount = subtotal - globalDiscount
    const tax = afterDiscount * (watchTaxRate / 100)
    const total = afterDiscount + tax

    return {
      subtotal: pesosToCents(subtotal),
      discount: pesosToCents(globalDiscount),
      tax: pesosToCents(tax),
      total: pesosToCents(total),
    }
  }, [watchItems, watchDiscountType, watchDiscountValue, watchTaxRate])

  const handleServiceSelect = (index: number, serviceId: string) => {
    const service = services.find((s) => s.id === serviceId)
    if (service) {
      form.setValue(`items.${index}.service_id`, serviceId)
      form.setValue(`items.${index}.service_name`, service.name)
      form.setValue(`items.${index}.service_description`, service.description || '')
      form.setValue(`items.${index}.unit_price`, centsToPesos(service.price_cents || 0))
    }
  }

  const handleSubmit = async (data: QuoteFormData) => {
    const submitData: CreateQuoteData = {
      patient_id: data.patient_id,
      quote_date: data.quote_date,
      validity_days: data.validity_days,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      tax_rate: data.tax_rate,
      notes: data.notes || undefined,
      patient_notes: data.patient_notes || undefined,
      terms_conditions: data.terms_conditions || undefined,
      items: data.items.map((item, index) => ({
        service_id: item.service_id || undefined,
        service_name: item.service_name,
        service_description: item.service_description || undefined,
        quantity: item.quantity,
        unit_price_cents: pesosToCents(item.unit_price),
        discount_type: item.discount_type,
        discount_value: item.discount_value,
        tooth_number: item.tooth_number || undefined,
        notes: item.notes || undefined,
        sort_order: index,
      })),
    }

    await onSubmit(submitData)
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t('quotes.form.basicInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="patient_id">{t('quotes.fields.patient')}</Label>
            <Controller
              name="patient_id"
              control={form.control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('quotes.form.selectPatient')} />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.first_name} {patient.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.patient_id && (
              <p className="text-sm text-destructive">
                {form.formState.errors.patient_id.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote_date">{t('quotes.fields.date')}</Label>
            <Input
              type="date"
              {...form.register('quote_date')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="validity_days">{t('quotes.fields.validityDays')}</Label>
            <Input
              type="number"
              min={1}
              max={365}
              {...form.register('validity_days', { valueAsNumber: true })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax_rate">{t('quotes.fields.taxRate')}</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.01}
              {...form.register('tax_rate', { valueAsNumber: true })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Services */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('quotes.form.services')}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                service_id: null,
                service_name: '',
                service_description: '',
                quantity: 1,
                unit_price: 0,
                discount_type: 'none',
                discount_value: 0,
                tooth_number: '',
                notes: '',
              })
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('quotes.form.addService')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-12 gap-3 items-start p-4 bg-muted/30 rounded-lg"
            >
              <div className="col-span-12 md:col-span-3">
                <Label className="text-xs">{t('quotes.fields.service')}</Label>
                <Select
                  onValueChange={(value) => handleServiceSelect(index, value)}
                  value={form.watch(`items.${index}.service_id`) || ''}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t('quotes.form.selectService')} />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} - {formatCurrency(service.price_cents || 0)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="mt-2"
                  placeholder={t('quotes.form.customServiceName')}
                  {...form.register(`items.${index}.service_name`)}
                />
              </div>

              <div className="col-span-6 md:col-span-1">
                <Label className="text-xs">{t('quotes.fields.quantity')}</Label>
                <Input
                  type="number"
                  min={1}
                  className="mt-1"
                  {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                />
              </div>

              <div className="col-span-6 md:col-span-2">
                <Label className="text-xs">{t('quotes.fields.unitPrice')}</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  className="mt-1"
                  {...form.register(`items.${index}.unit_price`, { valueAsNumber: true })}
                />
              </div>

              <div className="col-span-6 md:col-span-2">
                <Label className="text-xs">{t('quotes.fields.discount')}</Label>
                <div className="flex gap-1 mt-1">
                  <Controller
                    name={`items.${index}.discount_type`}
                    control={form.control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-</SelectItem>
                          <SelectItem value="percentage">%</SelectItem>
                          <SelectItem value="fixed">$</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    className="flex-1"
                    disabled={form.watch(`items.${index}.discount_type`) === 'none'}
                    {...form.register(`items.${index}.discount_value`, { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div className="col-span-6 md:col-span-1">
                <Label className="text-xs">{t('quotes.fields.tooth')}</Label>
                <Input
                  className="mt-1"
                  placeholder="#"
                  {...form.register(`items.${index}.tooth_number`)}
                />
              </div>

              <div className="col-span-10 md:col-span-2">
                <Label className="text-xs">{t('quotes.fields.notes')}</Label>
                <Input
                  className="mt-1"
                  {...form.register(`items.${index}.notes`)}
                />
              </div>

              <div className="col-span-2 md:col-span-1 flex items-end justify-end h-full">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {form.formState.errors.items && (
            <p className="text-sm text-destructive">
              {form.formState.errors.items.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Global Discount & Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('quotes.form.globalDiscount')}</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div className="space-y-2 w-32">
              <Label>{t('quotes.fields.discountType')}</Label>
              <Controller
                name="discount_type"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('quotes.discountTypes.none')}</SelectItem>
                      <SelectItem value="percentage">{t('quotes.discountTypes.percentage')}</SelectItem>
                      <SelectItem value="fixed">{t('quotes.discountTypes.fixed')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2 flex-1">
              <Label>{t('quotes.fields.discountValue')}</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                disabled={watchDiscountType === 'none'}
                {...form.register('discount_value', { valueAsNumber: true })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('quotes.form.totals')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('quotes.fields.subtotal')}</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>{t('quotes.fields.discount')}</span>
                <span>-{formatCurrency(totals.discount)}</span>
              </div>
            )}
            {totals.tax > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('quotes.fields.tax')} ({watchTaxRate}%)
                </span>
                <span>{formatCurrency(totals.tax)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>{t('quotes.fields.total')}</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>{t('quotes.form.notes')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{t('quotes.fields.internalNotes')}</Label>
            <Textarea
              rows={3}
              {...form.register('notes')}
              placeholder={t('quotes.form.internalNotesPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('quotes.fields.patientNotes')}</Label>
            <Textarea
              rows={3}
              {...form.register('patient_notes')}
              placeholder={t('quotes.form.patientNotesPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('quotes.fields.termsConditions')}</Label>
            <Textarea
              rows={3}
              {...form.register('terms_conditions')}
              placeholder={t('quotes.form.termsPlaceholder')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? t('common.saving') : quote ? t('common.save') : t('quotes.createQuote')}
        </Button>
      </div>
    </form>
  )
}
