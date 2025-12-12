'use client'

import React, { useCallback, useState } from 'react'
import { UseFormReturn, useFieldArray, useWatch } from 'react-hook-form'
import { InputField, SelectField, TextareaField, FormGrid, FormSection } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2, Search, Pill } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  t: (key: string, params?: Record<string, any>) => string
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

  // Watch for patient selection
  const patientId = useWatch({ control: form.control, name: 'patient_id' })

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

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <FormSection title={t('prescriptions.form.basic_info')}>
        <FormGrid columns={2}>
          <SelectField
            form={form}
            name="patient_id"
            label={t('prescriptions.fields.patient')}
            options={patients}
            required
            disabled={isEditing}
          />
          <InputField
            form={form}
            name="prescription_date"
            label={t('prescriptions.fields.date')}
            type="date"
            required
          />
        </FormGrid>
      </FormSection>

      {/* Prescriber Info */}
      <FormSection title={t('prescriptions.form.prescriber_info')}>
        <FormGrid columns={3}>
          <InputField
            form={form}
            name="prescriber_name"
            label={t('prescriptions.fields.prescriber_name')}
            required
          />
          <InputField
            form={form}
            name="prescriber_license"
            label={t('prescriptions.fields.prescriber_license')}
          />
          <InputField
            form={form}
            name="prescriber_specialty"
            label={t('prescriptions.fields.prescriber_specialty')}
          />
        </FormGrid>
      </FormSection>

      {/* Diagnosis */}
      <FormSection title={t('prescriptions.form.diagnosis')}>
        <TextareaField
          form={form}
          name="diagnosis"
          label={t('prescriptions.fields.diagnosis')}
          rows={2}
        />
      </FormSection>

      {/* Medications */}
      <FormSection
        title={t('prescriptions.form.medications')}
        description={t('prescriptions.form.medications_description')}
      >
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

                  <FormGrid columns={3}>
                    <InputField
                      form={form}
                      name={`items.${index}.medication_name`}
                      label={t('prescriptions.fields.medication_name')}
                      required
                    />
                    <InputField
                      form={form}
                      name={`items.${index}.medication_strength`}
                      label={t('prescriptions.fields.strength')}
                    />
                    <InputField
                      form={form}
                      name={`items.${index}.medication_form`}
                      label={t('prescriptions.fields.form')}
                    />
                  </FormGrid>
                </div>

                {/* Dosage instructions */}
                <FormGrid columns={4}>
                  <InputField
                    form={form}
                    name={`items.${index}.dosage`}
                    label={t('prescriptions.fields.dosage')}
                    required
                  />
                  <InputField
                    form={form}
                    name={`items.${index}.frequency`}
                    label={t('prescriptions.fields.frequency')}
                    required
                  />
                  <InputField
                    form={form}
                    name={`items.${index}.duration`}
                    label={t('prescriptions.fields.duration')}
                  />
                  <InputField
                    form={form}
                    name={`items.${index}.quantity`}
                    label={t('prescriptions.fields.quantity')}
                  />
                </FormGrid>

                <div className="mt-4">
                  <TextareaField
                    form={form}
                    name={`items.${index}.instructions`}
                    label={t('prescriptions.fields.instructions')}
                    rows={2}
                  />
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
      </FormSection>

      {/* Additional Notes */}
      <FormSection title={t('prescriptions.form.additional_info')}>
        <FormGrid columns={2}>
          <InputField
            form={form}
            name="valid_until"
            label={t('prescriptions.fields.valid_until')}
            type="date"
          />
          <div /> {/* Spacer */}
        </FormGrid>
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <TextareaField
            form={form}
            name="notes"
            label={t('prescriptions.fields.notes')}
            rows={2}
          />
          <TextareaField
            form={form}
            name="pharmacy_notes"
            label={t('prescriptions.fields.pharmacy_notes')}
            rows={2}
          />
        </div>
      </FormSection>
    </div>
  )
}
