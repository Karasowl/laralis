'use client'

import { FormSection } from '@/components/ui/form-field'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatDate, formatCurrency } from '@/lib/format'
import { Patient } from '@/lib/types'

interface PatientDetailsProps {
  patient: Patient
  t: (key: string) => string
  stats?: { treatments?: number; spent_cents?: number; visits?: number }
}

export function PatientDetails({ patient, t, stats }: PatientDetailsProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
        <div>
          <h3 className="text-xl font-semibold">
            {patient.first_name} {patient.last_name}
          </h3>
          {patient.email && (
            <p className="text-muted-foreground">{patient.email}</p>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md bg-muted/40 p-3 text-center">
          <div className="text-xs text-muted-foreground">Tratamientos</div>
          <div className="text-lg font-semibold">{stats?.treatments ?? 0}</div>
        </div>
        <div className="rounded-md bg-muted/40 p-3 text-center">
          <div className="text-xs text-muted-foreground">Gastado</div>
          <div className="text-lg font-semibold">{formatCurrency(stats?.spent_cents ?? 0)}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <Button variant="outline" asChild>
          <Link href={`/treatments?patient_id=${patient.id}`}>
            Ver Tratamientos
          </Link>
        </Button>
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
