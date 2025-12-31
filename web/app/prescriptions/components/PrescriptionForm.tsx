'use client'

import React, { useCallback, useState } from 'react'
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
import { Plus, Trash2, Search, Pill } from 'lucide-react'
import type { Medication } from '@/lib/types'

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
  medications: Medication[]
  t: ReturnType<typeof import('next-intl').useTranslations>
  isEditing?: boolean
}

export function PrescriptionForm({
  form,
  patients,
  medications,
  t,
  isEditing = false,
}: PrescriptionFormProps) {
  const [medicationSearch, setMedicationSearch] = useState('')
  const [showMedicationSearch, setShowMedicationSearch] = useState<number | null>(null)

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  // Filter medications based on search
  const filteredMedications = medications.filter((med) => {
    if (!medicationSearch) return true
    const search = medicationSearch.toLowerCase()
    return (
      med.name.toLowerCase().includes(search) ||
      med.generic_name?.toLowerCase().includes(search) ||
      med.brand_name?.toLowerCase().includes(search)
    )
  })

  // Handle medication selection
  const handleSelectMedication = useCallback(
    (index: number, medication: Medication) => {
      form.setValue(`items.${index}.medication_id`, medication.id)
      form.setValue(`items.${index}.medication_name`, medication.name)
      form.setValue(`items.${index}.medication_strength`, medication.strength || '')
      form.setValue(`items.${index}.medication_form`, medication.dosage_form || '')
      form.setValue(`items.${index}.dosage`, medication.default_dosage || '')
      form.setValue(`items.${index}.frequency`, medication.default_frequency || '')
      form.setValue(`items.${index}.duration`, medication.default_duration || '')
      form.setValue(`items.${index}.instructions`, medication.default_instructions || '')
      setShowMedicationSearch(null)
      setMedicationSearch('')
    },
    [form]
  )

  // Add new medication item
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
      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">{t('prescriptions.form.basic_info')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="patient_id">
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
            <Label htmlFor="prescription_date">
              {t('prescriptions.fields.date')} <span className="text-destructive">*</span>
            </Label>
            <Input type="date" {...form.register('prescription_date')} />
            {errors.prescription_date && (
              <p className="text-sm text-destructive">{errors.prescription_date.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Prescriber Info */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">{t('prescriptions.form.prescriber_info')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="prescriber_name">
              {t('prescriptions.fields.prescriber_name')} <span className="text-destructive">*</span>
            </Label>
            <Input {...form.register('prescriber_name')} />
            {errors.prescriber_name && (
              <p className="text-sm text-destructive">{errors.prescriber_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="prescriber_license">{t('prescriptions.fields.prescriber_license')}</Label>
            <Input {...form.register('prescriber_license')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prescriber_specialty">{t('prescriptions.fields.prescriber_specialty')}</Label>
            <Input {...form.register('prescriber_specialty')} />
          </div>
        </div>
      </div>

      {/* Diagnosis */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">{t('prescriptions.form.diagnosis')}</h3>
        <div className="space-y-2">
          <Label htmlFor="diagnosis">{t('prescriptions.fields.diagnosis')}</Label>
          <Textarea {...form.register('diagnosis')} rows={2} />
        </div>
      </div>

      {/* Medications */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">{t('prescriptions.form.medications')}</h3>
          <p className="text-sm text-muted-foreground">{t('prescriptions.form.medications_description')}</p>
        </div>

        <div className="space-y-4">
          {fields.map((field, index) => (
            <Card key={field.id} className="relative">
              <CardContent className="pt-6">
                {/* Medication search/selection */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Label className="text-sm font-medium">
                      {t('prescriptions.fields.medication')} {index + 1}
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowMedicationSearch(showMedicationSearch === index ? null : index)}
                    >
                      <Search className="h-4 w-4 mr-1" />
                      {t('prescriptions.actions.search_medication')}
                    </Button>
                  </div>

                  {showMedicationSearch === index && (
                    <div className="mb-4 p-3 border rounded-lg bg-muted/50">
                      <Input
                        placeholder={t('prescriptions.placeholders.search_medication')}
                        value={medicationSearch}
                        onChange={(e) => setMedicationSearch(e.target.value)}
                        className="mb-2"
                      />
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {filteredMedications.slice(0, 10).map((med) => (
                          <button
                            key={med.id}
                            type="button"
                            className="w-full text-left px-3 py-2 rounded hover:bg-accent flex items-center gap-2"
                            onClick={() => handleSelectMedication(index, med)}
                          >
                            <Pill className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{med.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {med.strength} - {med.dosage_form}
                              </div>
                            </div>
                          </button>
                        ))}
                        {filteredMedications.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            {t('prescriptions.messages.no_medications_found')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>
                        {t('prescriptions.fields.medication_name')} <span className="text-destructive">*</span>
                      </Label>
                      <Input {...form.register(`items.${index}.medication_name`)} />
                      {errors.items?.[index]?.medication_name && (
                        <p className="text-sm text-destructive">
                          {errors.items[index]?.medication_name?.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>{t('prescriptions.fields.strength')}</Label>
                      <Input {...form.register(`items.${index}.medication_strength`)} />
                    </div>

                    <div className="space-y-2">
                      <Label>{t('prescriptions.fields.form')}</Label>
                      <Input {...form.register(`items.${index}.medication_form`)} />
                    </div>
                  </div>
                </div>

                {/* Dosage instructions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>
                      {t('prescriptions.fields.dosage')} <span className="text-destructive">*</span>
                    </Label>
                    <Input {...form.register(`items.${index}.dosage`)} />
                    {errors.items?.[index]?.dosage && (
                      <p className="text-sm text-destructive">{errors.items[index]?.dosage?.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>
                      {t('prescriptions.fields.frequency')} <span className="text-destructive">*</span>
                    </Label>
                    <Input {...form.register(`items.${index}.frequency`)} />
                    {errors.items?.[index]?.frequency && (
                      <p className="text-sm text-destructive">{errors.items[index]?.frequency?.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t('prescriptions.fields.duration')}</Label>
                    <Input {...form.register(`items.${index}.duration`)} />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('prescriptions.fields.quantity')}</Label>
                    <Input {...form.register(`items.${index}.quantity`)} />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Label>{t('prescriptions.fields.instructions')}</Label>
                  <Textarea {...form.register(`items.${index}.instructions`)} rows={2} />
                </div>

                {/* Remove button */}
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 text-destructive hover:text-destructive"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}

          <Button type="button" variant="outline" onClick={addMedicationItem} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            {t('prescriptions.actions.add_medication')}
          </Button>
        </div>
      </div>

      {/* Additional Notes */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">{t('prescriptions.form.additional_info')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="valid_until">{t('prescriptions.fields.valid_until')}</Label>
            <Input type="date" {...form.register('valid_until')} />
          </div>
          <div /> {/* Spacer */}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="notes">{t('prescriptions.fields.notes')}</Label>
            <Textarea {...form.register('notes')} rows={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pharmacy_notes">{t('prescriptions.fields.pharmacy_notes')}</Label>
            <Textarea {...form.register('pharmacy_notes')} rows={2} />
          </div>
        </div>
      </div>
    </div>
  )
}
