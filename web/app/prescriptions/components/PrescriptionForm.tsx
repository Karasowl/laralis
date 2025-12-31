'use client'

import React, { useCallback } from 'react'
import { UseFormReturn, useFieldArray, Controller } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'

interface MedicationItemData {
  medication_id?: string | null
  medication_name: string
  medication_strength?: string | null
  medication_form?: string | null
  dosage: string
  frequency: string
  duration?: string | null
  quantity?: string | null
  instructions?: string | null
  sort_order: number
}

interface PrescriptionFormData {
  patient_id: string
  treatment_id?: string | null
  prescription_date: string
  prescriber_name: string
  prescriber_license?: string
  prescriber_specialty?: string
  diagnosis?: string
  valid_until?: string
  notes?: string
  pharmacy_notes?: string
  items: MedicationItemData[]
}

interface PrescriptionFormProps {
  form: UseFormReturn<PrescriptionFormData>
  patients: Array<{ value: string; label: string }>
  t: ReturnType<typeof import('next-intl').useTranslations>
  isEditing?: boolean
}

export function PrescriptionForm({
  form,
  patients,
  t,
  isEditing = false,
}: PrescriptionFormProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  const addMedicationItem = useCallback(() => {
    append({
      medication_id: null,
      medication_name: '',
      medication_strength: '',
      medication_form: '',
      dosage: '',
      frequency: '',
      duration: '',
      quantity: '',
      instructions: '',
      sort_order: fields.length,
    })
  }, [append, fields.length])

  const { errors } = form.formState

  return (
    <div className="space-y-6">
      {/* Basic Info - Paciente y Fecha */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            {t('prescriptions.fields.patient')} <span className="text-destructive">*</span>
          </Label>
          <Controller
            name="patient_id"
            control={form.control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                <SelectTrigger>
                  <SelectValue placeholder={t('common.select')} />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.value} value={patient.value}>
                      {patient.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.patient_id && (
            <p className="text-sm text-destructive">{errors.patient_id.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>
            {t('prescriptions.fields.date')} <span className="text-destructive">*</span>
          </Label>
          <Input type="date" {...form.register('prescription_date')} />
          {errors.prescription_date && (
            <p className="text-sm text-destructive">{errors.prescription_date.message}</p>
          )}
        </div>
      </div>

      {/* Prescriber Info */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">{t('prescriptions.form.prescriber_info')}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>
              {t('prescriptions.fields.prescriber_name')} <span className="text-destructive">*</span>
            </Label>
            <Input {...form.register('prescriber_name')} placeholder="Dr. Juan Pérez" />
            {errors.prescriber_name && (
              <p className="text-sm text-destructive">{errors.prescriber_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('prescriptions.fields.prescriber_license')}</Label>
            <Input {...form.register('prescriber_license')} placeholder="CED. 12345678" />
          </div>

          <div className="space-y-2">
            <Label>{t('prescriptions.fields.prescriber_specialty')}</Label>
            <Input {...form.register('prescriber_specialty')} placeholder="Odontología" />
          </div>
        </div>
      </div>

      {/* Diagnosis - Solo un campo, sin duplicación */}
      <div className="space-y-2">
        <Label>{t('prescriptions.fields.diagnosis')}</Label>
        <Input {...form.register('diagnosis')} placeholder={t('prescriptions.placeholders.diagnosis')} />
      </div>

      {/* Medications */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-muted-foreground">{t('prescriptions.form.medications')}</h4>
          <Button type="button" variant="outline" size="sm" onClick={addMedicationItem}>
            <Plus className="h-4 w-4 mr-1" />
            {t('prescriptions.actions.add_medication')}
          </Button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <Card key={field.id} className="relative">
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    {t('prescriptions.fields.medication')} {index + 1}
                  </span>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Medicamento - Nombre, Concentración, Forma */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {t('prescriptions.fields.medication_name')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      {...form.register(`items.${index}.medication_name`)}
                      placeholder="Amoxicilina"
                      className="h-9"
                    />
                    {errors.items?.[index]?.medication_name && (
                      <p className="text-xs text-destructive">
                        {errors.items[index]?.medication_name?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">{t('prescriptions.fields.strength')}</Label>
                    <Input
                      {...form.register(`items.${index}.medication_strength`)}
                      placeholder="500mg"
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">{t('prescriptions.fields.form')}</Label>
                    <Input
                      {...form.register(`items.${index}.medication_form`)}
                      placeholder="Cápsulas"
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Posología - Dosis, Frecuencia, Duración, Cantidad */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {t('prescriptions.fields.dosage')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      {...form.register(`items.${index}.dosage`)}
                      placeholder="1 cápsula"
                      className="h-9"
                    />
                    {errors.items?.[index]?.dosage && (
                      <p className="text-xs text-destructive">{errors.items[index]?.dosage?.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">
                      {t('prescriptions.fields.frequency')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      {...form.register(`items.${index}.frequency`)}
                      placeholder="Cada 8 horas"
                      className="h-9"
                    />
                    {errors.items?.[index]?.frequency && (
                      <p className="text-xs text-destructive">{errors.items[index]?.frequency?.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">{t('prescriptions.fields.duration')}</Label>
                    <Input
                      {...form.register(`items.${index}.duration`)}
                      placeholder="7 días"
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">{t('prescriptions.fields.quantity')}</Label>
                    <Input
                      {...form.register(`items.${index}.quantity`)}
                      placeholder="21 cápsulas"
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Instrucciones */}
                <div className="space-y-1">
                  <Label className="text-xs">{t('prescriptions.fields.instructions')}</Label>
                  <Input
                    {...form.register(`items.${index}.instructions`)}
                    placeholder="Tomar después de los alimentos"
                    className="h-9"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Additional Info - Validez y Notas */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('prescriptions.fields.valid_until')}</Label>
            <Input type="date" {...form.register('valid_until')} />
          </div>
          <div className="space-y-2">
            <Label>{t('prescriptions.fields.notes')}</Label>
            <Input {...form.register('notes')} placeholder={t('prescriptions.placeholders.notes')} />
          </div>
        </div>
      </div>
    </div>
  )
}
