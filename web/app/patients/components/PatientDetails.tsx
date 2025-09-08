'use client'

import { FormSection } from '@/components/ui/form-field'
import { formatDate } from '@/lib/format'
import { Patient } from '@/lib/types'

interface PatientDetailsProps {
  patient: Patient
  t: (key: string) => string
}

export function PatientDetails({ patient, t }: PatientDetailsProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xl font-medium">
          {patient.first_name[0]}{patient.last_name[0]}
        </div>
        <div>
          <h3 className="text-xl font-semibold">
            {patient.first_name} {patient.last_name}
          </h3>
          {patient.email && (
            <p className="text-muted-foreground">{patient.email}</p>
          )}
        </div>
      </div>

      <FormSection title={t('contact_information')}>
        <div className="grid grid-cols-2 gap-4">
          {patient.phone && (
            <div>
              <p className="text-sm text-muted-foreground">{t('fields.phone')}</p>
              <p className="font-medium">{patient.phone}</p>
            </div>
          )}
          {patient.email && (
            <div>
              <p className="text-sm text-muted-foreground">{t('fields.email')}</p>
              <p className="font-medium">{patient.email}</p>
            </div>
          )}
          {patient.address && (
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground">{t('fields.address')}</p>
              <p className="font-medium">{patient.address}</p>
              {patient.city && <p className="font-medium">{patient.city} {patient.postal_code}</p>}
            </div>
          )}
        </div>
      </FormSection>

      {(patient.birth_date || patient.first_visit_date) && (
        <FormSection title={t('important_dates')}>
          <div className="grid grid-cols-2 gap-4">
            {patient.birth_date && (
              <div>
                <p className="text-sm text-muted-foreground">{t('fields.birth_date')}</p>
                <p className="font-medium">{formatDate(patient.birth_date)}</p>
              </div>
            )}
            {patient.first_visit_date && (
              <div>
                <p className="text-sm text-muted-foreground">{t('fields.first_visit_date')}</p>
                <p className="font-medium">{formatDate(patient.first_visit_date)}</p>
              </div>
            )}
          </div>
        </FormSection>
      )}

      {patient.notes && (
        <FormSection title={t('fields.notes')}>
          <p className="text-sm">{patient.notes}</p>
        </FormSection>
      )}
    </div>
  )
}