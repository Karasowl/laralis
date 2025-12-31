'use client'

import React, { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { FormModal } from '@/components/ui/form-modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { usePrescriptions } from '@/hooks/use-prescriptions'
import { usePatients } from '@/hooks/use-patients'
import { useToast } from '@/hooks/use-toast'
import { PrescriptionForm } from './components/PrescriptionForm'
import { PrescriptionTable } from './components/PrescriptionTable'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Prescription, Patient } from '@/lib/types'

const prescriptionItemSchema = z.object({
  medication_id: z.string().uuid().optional().nullable(),
  medication_name: z.string().min(1, 'Medication name is required'),
  medication_strength: z.string().optional().nullable(),
  medication_form: z.string().optional().nullable(),
  dosage: z.string().min(1, 'Dosage is required'),
  frequency: z.string().min(1, 'Frequency is required'),
  duration: z.string().optional().nullable(),
  quantity: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  sort_order: z.number().default(0),
})

const prescriptionSchema = z.object({
  patient_id: z.string().uuid('Please select a patient'),
  treatment_id: z.string().uuid().optional().nullable(),
  prescription_date: z.string().min(1, 'Date is required'),
  prescriber_name: z.string().min(1, 'Prescriber name is required'),
  prescriber_license: z.string().optional(),
  prescriber_specialty: z.string().optional(),
  diagnosis: z.string().optional(),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
  pharmacy_notes: z.string().optional(),
  items: z.array(prescriptionItemSchema).min(1, 'At least one medication is required'),
})

type PrescriptionFormData = z.infer<typeof prescriptionSchema>

interface PrescriptionWithPatient extends Prescription {
  patient: Patient
}

export default function PrescriptionsPage() {
  const t = useTranslations()
  const { toast } = useToast()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState<PrescriptionWithPatient | null>(null)
  const [prescriptionToCancel, setPrescriptionToCancel] = useState<PrescriptionWithPatient | null>(null)

  const { prescriptions, loading, createPrescription, cancelPrescription, downloadPDF, refresh } = usePrescriptions()
  const { patients } = usePatients()

  const form = useForm<PrescriptionFormData>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: {
      patient_id: '',
      prescription_date: new Date().toISOString().split('T')[0],
      prescriber_name: '',
      prescriber_license: '',
      prescriber_specialty: '',
      diagnosis: '',
      valid_until: '',
      notes: '',
      pharmacy_notes: '',
      items: [
        {
          medication_id: null,
          medication_name: '',
          medication_strength: '',
          medication_form: '',
          dosage: '',
          frequency: '',
          duration: '',
          quantity: '',
          instructions: '',
          sort_order: 0,
        },
      ],
    },
  })

  // Convert patients to select options
  const patientOptions = (patients || []).map((p) => ({
    value: p.id,
    label: `${p.first_name} ${p.last_name}`,
  }))

  const handleOpenModal = useCallback(() => {
    form.reset({
      patient_id: '',
      prescription_date: new Date().toISOString().split('T')[0],
      prescriber_name: '',
      prescriber_license: '',
      prescriber_specialty: '',
      diagnosis: '',
      valid_until: '',
      notes: '',
      pharmacy_notes: '',
      items: [
        {
          medication_id: null,
          medication_name: '',
          medication_strength: '',
          medication_form: '',
          dosage: '',
          frequency: '',
          duration: '',
          quantity: '',
          instructions: '',
          sort_order: 0,
        },
      ],
    })
    setIsModalOpen(true)
  }, [form])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    form.reset()
  }, [form])

  const handleSubmit = useCallback(
    async (data: PrescriptionFormData) => {
      try {
        // Transform items to match API expected types (convert null to undefined)
        const transformedData = {
          ...data,
          items: data.items.map(item => ({
            medication_id: item.medication_id ?? undefined,
            medication_name: item.medication_name,
            medication_strength: item.medication_strength ?? undefined,
            medication_form: item.medication_form ?? undefined,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration ?? undefined,
            quantity: item.quantity ?? undefined,
            instructions: item.instructions ?? undefined,
            sort_order: item.sort_order,
          }))
        }
        await createPrescription(transformedData)
        toast({
          title: t('prescriptions.messages.created'),
        })
        handleCloseModal()
        refresh()
      } catch (error) {
        toast({
          title: t('prescriptions.messages.error'),
          variant: 'destructive',
        })
      }
    },
    [createPrescription, t, toast, handleCloseModal, refresh]
  )

  const handleView = useCallback((prescription: PrescriptionWithPatient) => {
    setSelectedPrescription(prescription)
    setIsViewModalOpen(true)
  }, [])

  const handleDownloadPDF = useCallback(
    async (prescription: PrescriptionWithPatient) => {
      try {
        await downloadPDF(prescription.id)
        toast({
          title: t('prescriptions.messages.pdf_downloaded'),
        })
      } catch (error) {
        toast({
          title: t('prescriptions.messages.pdf_error'),
          variant: 'destructive',
        })
      }
    },
    [downloadPDF, t, toast]
  )

  const handleCancelConfirm = useCallback(async () => {
    if (!prescriptionToCancel) return

    try {
      await cancelPrescription(prescriptionToCancel.id)
      toast({
        title: t('prescriptions.messages.cancelled'),
      })
      refresh()
    } catch (error) {
      toast({
        title: t('prescriptions.messages.error'),
        variant: 'destructive',
      })
    } finally {
      setPrescriptionToCancel(null)
    }
  }, [prescriptionToCancel, cancelPrescription, t, toast, refresh])

  return (
    <AppLayout>
      <div className="container mx-auto py-6">
        <PageHeader
          title={t('prescriptions.title')}
          description={t('prescriptions.description')}
          actions={
            <Button onClick={handleOpenModal}>
              <Plus className="h-4 w-4 mr-2" />
              {t('prescriptions.actions.new')}
            </Button>
          }
        />

        <div className="mt-6">
          <PrescriptionTable
            prescriptions={(prescriptions || []) as PrescriptionWithPatient[]}
            loading={loading}
            onView={handleView}
            onCancel={setPrescriptionToCancel}
            onDownloadPDF={handleDownloadPDF}
            t={t}
          />
        </div>

        {/* Create Modal */}
        <FormModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          title={t('prescriptions.modal.create_title')}
          description={t('prescriptions.modal.create_description')}
          onSubmit={form.handleSubmit(handleSubmit)}
          submitLabel={t('common.save')}
          maxWidth="xl"
        >
          <PrescriptionForm
            form={form}
            patients={patientOptions}
            t={t}
          />
        </FormModal>

        {/* View Modal */}
        <FormModal
          open={isViewModalOpen}
          onOpenChange={setIsViewModalOpen}
          title={t('prescriptions.modal.view_title')}
          description={selectedPrescription?.prescription_number || ''}
          showFooter={false}
          maxWidth="lg"
        >
          {selectedPrescription && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('prescriptions.fields.patient')}</p>
                  <p className="font-medium">
                    {selectedPrescription.patient?.first_name} {selectedPrescription.patient?.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('prescriptions.fields.date')}</p>
                  <p className="font-medium">
                    {new Date(selectedPrescription.prescription_date).toLocaleDateString('es-MX')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('prescriptions.fields.prescriber')}</p>
                  <p className="font-medium">{selectedPrescription.prescriber_name}</p>
                  {selectedPrescription.prescriber_license && (
                    <p className="text-xs text-muted-foreground">
                      {t('prescriptions.fields.license')}: {selectedPrescription.prescriber_license}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('prescriptions.fields.status')}</p>
                  <p className="font-medium">{t(`prescriptions.status.${selectedPrescription.status}`)}</p>
                </div>
              </div>

              {selectedPrescription.diagnosis && (
                <div>
                  <p className="text-sm text-muted-foreground">{t('prescriptions.fields.diagnosis')}</p>
                  <p className="font-medium">{selectedPrescription.diagnosis}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-2">{t('prescriptions.fields.medications')}</p>
                <div className="space-y-2">
                  {selectedPrescription.items?.map((item, index) => (
                    <div key={item.id} className="p-3 bg-muted rounded-lg">
                      <p className="font-medium">
                        {index + 1}. {item.medication_name}
                        {item.medication_strength && ` ${item.medication_strength}`}
                      </p>
                      <p className="text-sm">
                        {item.dosage} - {item.frequency}
                        {item.duration && ` - ${item.duration}`}
                      </p>
                      {item.instructions && (
                        <p className="text-sm text-muted-foreground italic mt-1">{item.instructions}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </FormModal>

        {/* Cancel Confirmation */}
        <ConfirmDialog
          open={!!prescriptionToCancel}
          onOpenChange={(open) => !open && setPrescriptionToCancel(null)}
          title={t('prescriptions.confirm.cancel_title')}
          description={t('prescriptions.confirm.cancel_description')}
          confirmText={t('prescriptions.actions.cancel')}
          onConfirm={handleCancelConfirm}
          variant="destructive"
        />
      </div>
    </AppLayout>
  )
}
