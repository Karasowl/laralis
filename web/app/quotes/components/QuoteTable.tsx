'use client'

import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ActionDropdown } from '@/components/ui/ActionDropdown'
import { formatCurrency } from '@/lib/money'
import type { QuoteWithRelations } from '@/hooks/use-quotes'
import {
  FileText,
  Download,
  Send,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Eye,
} from 'lucide-react'

interface QuoteTableProps {
  quotes: QuoteWithRelations[]
  loading: boolean
  onView: (quote: QuoteWithRelations) => void
  onEdit: (quote: QuoteWithRelations) => void
  onDelete: (quote: QuoteWithRelations) => void
  onDownloadPdf: (quote: QuoteWithRelations) => void
  onSend: (quote: QuoteWithRelations) => void
  onUpdateStatus: (quote: QuoteWithRelations, status: 'accepted' | 'rejected') => void
}

export function QuoteTable({
  quotes,
  loading,
  onView,
  onEdit,
  onDelete,
  onDownloadPdf,
  onSend,
  onUpdateStatus,
}: QuoteTableProps) {
  const t = useTranslations()

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'secondary',
      sent: 'default',
      accepted: 'default',
      rejected: 'destructive',
      expired: 'outline',
      converted: 'default',
    }

    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-yellow-100 text-yellow-800',
      converted: 'bg-purple-100 text-purple-800',
    }

    return (
      <Badge variant={variants[status]} className={colors[status]}>
        {t(`quotes.status.${status}`)}
      </Badge>
    )
  }

  const isExpired = (validUntil: string) => new Date(validUntil) < new Date()

  const columns: Column<QuoteWithRelations>[] = [
    {
      key: 'quote_number',
      header: t('quotes.fields.quoteNumber'),
      render: (quote) => (
        <span className="font-mono font-medium">{quote.quote_number}</span>
      ),
    },
    {
      key: 'patient',
      header: t('quotes.fields.patient'),
      render: (quote) => (
        <div>
          <p className="font-medium">
            {quote.patient?.first_name} {quote.patient?.last_name}
          </p>
          {quote.patient?.email && (
            <p className="text-xs text-muted-foreground">{quote.patient.email}</p>
          )}
        </div>
      ),
    },
    {
      key: 'quote_date',
      header: t('quotes.fields.date'),
      render: (quote) => (
        <span>
          {new Date(quote.quote_date).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'valid_until',
      header: t('quotes.fields.validUntil'),
      render: (quote) => (
        <div className="flex items-center gap-2">
          <span className={isExpired(quote.valid_until) ? 'text-red-600' : ''}>
            {new Date(quote.valid_until).toLocaleDateString('es-MX', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
          {isExpired(quote.valid_until) && quote.status !== 'expired' && (
            <Badge variant="destructive" className="text-xs">
              {t('quotes.expired')}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'items',
      header: t('quotes.fields.services'),
      render: (quote) => (
        <span className="text-muted-foreground">
          {quote.items?.length || 0} {t('quotes.services')}
        </span>
      ),
    },
    {
      key: 'total_cents',
      header: t('quotes.fields.total'),
      render: (quote) => (
        <span className="font-semibold">
          {formatCurrency(quote.total_cents)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('quotes.fields.status'),
      render: (quote) => getStatusBadge(quote.status),
    },
    {
      key: 'actions',
      header: '',
      render: (quote) => {
        const actions = [
          {
            label: t('common.view'),
            icon: Eye,
            onClick: () => onView(quote),
          },
          {
            label: t('quotes.downloadPdf'),
            icon: Download,
            onClick: () => onDownloadPdf(quote),
          },
        ]

        // Add edit for drafts
        if (quote.status === 'draft') {
          actions.push({
            label: t('common.edit'),
            icon: Edit,
            onClick: () => onEdit(quote),
          })
        }

        // Add send option for drafts
        if (quote.status === 'draft') {
          actions.push({
            label: t('quotes.send'),
            icon: Send,
            onClick: () => onSend(quote),
          })
        }

        // Add accept/reject for sent quotes
        if (quote.status === 'sent') {
          actions.push(
            {
              label: t('quotes.markAccepted'),
              icon: CheckCircle,
              onClick: () => onUpdateStatus(quote, 'accepted'),
            },
            {
              label: t('quotes.markRejected'),
              icon: XCircle,
              onClick: () => onUpdateStatus(quote, 'rejected'),
            }
          )
        }

        // Add delete for drafts only
        if (quote.status === 'draft') {
          actions.push({
            label: t('common.delete'),
            icon: Trash2,
            onClick: () => onDelete(quote),
            variant: 'destructive' as const,
          })
        }

        return <ActionDropdown actions={actions} />
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={quotes}
      loading={loading}
      emptyState={{
        icon: FileText,
        title: t('quotes.emptyState.title'),
        description: t('quotes.emptyState.description'),
      }}
    />
  )
}
