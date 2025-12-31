'use client'

import React from 'react'
import { Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface PrescriptionFiltersState {
  status: string
  patientId: string
  startDate: string
  endDate: string
}

interface PatientOption {
  value: string
  label: string
}

interface PrescriptionFiltersProps {
  filters: PrescriptionFiltersState
  onFiltersChange: (filters: PrescriptionFiltersState) => void
  patients: PatientOption[]
  t: ReturnType<typeof import('next-intl').useTranslations>
}

export function PrescriptionFilters({
  filters,
  onFiltersChange,
  patients,
  t,
}: PrescriptionFiltersProps) {
  const handleStatusChange = (value: string) => {
    onFiltersChange({ ...filters, status: value === 'all' ? '' : value })
  }

  const handlePatientChange = (value: string) => {
    onFiltersChange({ ...filters, patientId: value === 'all' ? '' : value })
  }

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, startDate: e.target.value })
  }

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, endDate: e.target.value })
  }

  const resetFilters = () => {
    onFiltersChange({
      status: '',
      patientId: '',
      startDate: '',
      endDate: '',
    })
  }

  const hasActiveFilters =
    filters.status || filters.patientId || filters.startDate || filters.endDate

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {t('prescriptions.filters.title')}
          </span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-8 px-2 text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              {t('prescriptions.filters.reset')}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Status Filter */}
          <div className="space-y-2">
            <Label className="text-sm">{t('prescriptions.filters.status')}</Label>
            <Select
              value={filters.status || 'all'}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('prescriptions.filters.all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('prescriptions.filters.all')}</SelectItem>
                <SelectItem value="active">{t('prescriptions.status.active')}</SelectItem>
                <SelectItem value="dispensed">{t('prescriptions.status.dispensed')}</SelectItem>
                <SelectItem value="expired">{t('prescriptions.status.expired')}</SelectItem>
                <SelectItem value="cancelled">{t('prescriptions.status.cancelled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Patient Filter */}
          <div className="space-y-2">
            <Label className="text-sm">{t('prescriptions.filters.patient')}</Label>
            <Select
              value={filters.patientId || 'all'}
              onValueChange={handlePatientChange}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('prescriptions.filters.all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('prescriptions.filters.all')}</SelectItem>
                {patients.map((patient) => (
                  <SelectItem key={patient.value} value={patient.value}>
                    {patient.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date Filter */}
          <div className="space-y-2">
            <Label className="text-sm">{t('prescriptions.filters.dateFrom')}</Label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={handleStartDateChange}
            />
          </div>

          {/* End Date Filter */}
          <div className="space-y-2">
            <Label className="text-sm">{t('prescriptions.filters.dateTo')}</Label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={handleEndDateChange}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
