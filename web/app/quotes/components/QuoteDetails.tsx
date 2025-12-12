'use client'

import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/money'
import type { QuoteWithRelations } from '@/hooks/use-quotes'
import {
  Download,
  Send,
  CheckCircle,
  XCircle,
  Edit,
  Calendar,
  User,
  FileText,
  Clock,
} from 'lucide-react'

interface QuoteDetailsProps {
  quote: QuoteWithRelations
  onEdit: () => void
  onDownloadPdf: () => void
  onSend: () => void
  onUpdateStatus: (status: 'accepted' | 'rejected') => void
  onClose: () => void
}

export function QuoteDetails({
  quote,
  onEdit,
  onDownloadPdf,
  onSend,
  onUpdateStatus,
  onClose,
}: QuoteDetailsProps) {
  const t = useTranslations()

  const isExpired = new Date(quote.valid_until) < new Date()

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-yellow-100 text-yellow-800',
      converted: 'bg-purple-100 text-purple-800',
    }

    return (
      <Badge className={colors[status]}>
        {t(`quotes.status.${status}`)}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{quote.quote_number}</h2>
            {getStatusBadge(quote.status)}
            {isExpired && quote.status !== 'expired' && (
              <Badge variant="destructive">{t('quotes.expired')}</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {t('quotes.createdOn')}{' '}
            {new Date(quote.created_at || '').toLocaleDateString('es-MX', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDownloadPdf}>
            <Download className="h-4 w-4 mr-2" />
            {t('quotes.downloadPdf')}
          </Button>
          {quote.status === 'draft' && (
            <>
              <Button variant="outline" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                {t('common.edit')}
              </Button>
              <Button onClick={onSend}>
                <Send className="h-4 w-4 mr-2" />
                {t('quotes.send')}
              </Button>
            </>
          )}
          {quote.status === 'sent' && (
            <>
              <Button
                variant="outline"
                className="text-green-600 border-green-600"
                onClick={() => onUpdateStatus('accepted')}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {t('quotes.markAccepted')}
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-600"
                onClick={() => onUpdateStatus('rejected')}
              >
                <XCircle className="h-4 w-4 mr-2" />
                {t('quotes.markRejected')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <User className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">{t('quotes.fields.patient')}</p>
                <p className="font-semibold">
                  {quote.patient?.first_name} {quote.patient?.last_name}
                </p>
                {quote.patient?.email && (
                  <p className="text-sm text-muted-foreground">{quote.patient.email}</p>
                )}
                {quote.patient?.phone && (
                  <p className="text-sm text-muted-foreground">{quote.patient.phone}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">{t('quotes.fields.date')}</p>
                <p className="font-semibold">
                  {new Date(quote.quote_date).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">{t('quotes.fields.validUntil')}</p>
                <p className={`font-semibold ${isExpired ? 'text-red-600' : ''}`}>
                  {new Date(quote.valid_until).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <p className="text-sm text-muted-foreground">
                  ({quote.validity_days} {t('quotes.days')})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('quotes.form.services')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('quotes.fields.service')}</TableHead>
                <TableHead className="text-center">{t('quotes.fields.quantity')}</TableHead>
                <TableHead className="text-right">{t('quotes.fields.unitPrice')}</TableHead>
                <TableHead className="text-right">{t('quotes.fields.discount')}</TableHead>
                <TableHead className="text-right">{t('quotes.fields.total')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quote.items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.service_name}</p>
                      {item.service_description && (
                        <p className="text-sm text-muted-foreground">
                          {item.service_description}
                        </p>
                      )}
                      {item.tooth_number && (
                        <p className="text-sm text-blue-600">
                          {t('quotes.tooth')}: {item.tooth_number}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-sm text-muted-foreground">{item.notes}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unit_price_cents)}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {item.discount_cents && item.discount_cents > 0
                      ? `-${formatCurrency(item.discount_cents)}`
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.total_cents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="pt-6">
          <div className="w-full md:w-1/2 ml-auto space-y-2">
            <div className="flex justify-between text-muted-foreground">
              <span>{t('quotes.fields.subtotal')}</span>
              <span>{formatCurrency(quote.subtotal_cents)}</span>
            </div>
            {quote.discount_cents && quote.discount_cents > 0 && (
              <div className="flex justify-between text-red-600">
                <span>
                  {t('quotes.fields.discount')}
                  {quote.discount_type === 'percentage' && ` (${quote.discount_value}%)`}
                </span>
                <span>-{formatCurrency(quote.discount_cents)}</span>
              </div>
            )}
            {quote.tax_cents && quote.tax_cents > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>
                  {t('quotes.fields.tax')} ({quote.tax_rate}%)
                </span>
                <span>{formatCurrency(quote.tax_cents)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold border-t pt-2">
              <span>{t('quotes.fields.total')}</span>
              <span>{formatCurrency(quote.total_cents)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {(quote.patient_notes || quote.terms_conditions || quote.notes) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quote.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('quotes.fields.internalNotes')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{quote.notes}</p>
              </CardContent>
            </Card>
          )}
          {quote.patient_notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('quotes.fields.patientNotes')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{quote.patient_notes}</p>
              </CardContent>
            </Card>
          )}
          {quote.terms_conditions && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('quotes.fields.termsConditions')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{quote.terms_conditions}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </div>
  )
}
