'use client'

import React from 'react'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, FileText, Eye, XCircle, Download } from 'lucide-react'
import type { Prescription, Patient } from '@/lib/types'

interface PrescriptionWithPatient extends Prescription {
  patient: Patient
}

interface PrescriptionTableProps {
  prescriptions: PrescriptionWithPatient[]
  loading: boolean
  onView: (prescription: PrescriptionWithPatient) => void
  onCancel: (prescription: PrescriptionWithPatient) => void
  onDownloadPDF: (prescription: PrescriptionWithPatient) => void
  t: (key: string, params?: Record<string, any>) => string
}

export function PrescriptionTable({
  prescriptions,
  loading,
  onView,
  onCancel,
  onDownloadPDF,
  t,
}: PrescriptionTableProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      dispensed: 'secondary',
      expired: 'outline',
      cancelled: 'destructive',
    }
    return (
      <Badge variant={variants[status] || 'default'}>
        {t(`prescriptions.status.${status}`)}
      </Badge>
    )
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const columns = [
    {
      key: 'prescription_number',
      header: t('prescriptions.fields.number'),
      sortable: true,
      render: (row: PrescriptionWithPatient) => (
        <span className="font-mono text-sm">{row.prescription_number}</span>
      ),
    },
    {
      key: 'prescription_date',
      header: t('prescriptions.fields.date'),
      sortable: true,
      render: (row: PrescriptionWithPatient) => formatDate(row.prescription_date),
    },
    {
      key: 'patient',
      header: t('prescriptions.fields.patient'),
      sortable: true,
      render: (row: PrescriptionWithPatient) => (
        <div>
          <div className="font-medium">
            {row.patient?.first_name} {row.patient?.last_name}
          </div>
          {row.patient?.phone && (
            <div className="text-xs text-muted-foreground">{row.patient.phone}</div>
          )}
        </div>
      ),
    },
    {
      key: 'prescriber_name',
      header: t('prescriptions.fields.prescriber'),
      sortable: true,
    },
    {
      key: 'items_count',
      header: t('prescriptions.fields.medications_count'),
      render: (row: PrescriptionWithPatient) => (
        <Badge variant="outline">{row.items?.length || 0}</Badge>
      ),
    },
    {
      key: 'status',
      header: t('prescriptions.fields.status'),
      sortable: true,
      render: (row: PrescriptionWithPatient) => getStatusBadge(row.status),
    },
    {
      key: 'actions',
      header: '',
      render: (row: PrescriptionWithPatient) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(row)}>
              <Eye className="mr-2 h-4 w-4" />
              {t('common.view')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownloadPDF(row)}>
              <Download className="mr-2 h-4 w-4" />
              {t('prescriptions.actions.download_pdf')}
            </DropdownMenuItem>
            {row.status === 'active' && (
              <DropdownMenuItem
                onClick={() => onCancel(row)}
                className="text-destructive"
              >
                <XCircle className="mr-2 h-4 w-4" />
                {t('prescriptions.actions.cancel')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={prescriptions}
      loading={loading}
      searchable
      searchPlaceholder={t('prescriptions.search_placeholder')}
      emptyState={{
        icon: FileText,
        title: t('prescriptions.empty.title'),
        description: t('prescriptions.empty.description'),
      }}
    />
  )
}
