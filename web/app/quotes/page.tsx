'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/button'
import { FormModal } from '@/components/ui/FormModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useQuotes, useQuote, type QuoteWithRelations, type CreateQuoteData } from '@/hooks/use-quotes'
import { usePatients } from '@/hooks/use-patients'
import { useServices } from '@/hooks/use-services'
import { QuoteTable } from './components/QuoteTable'
import { QuoteForm } from './components/QuoteForm'
import { QuoteDetails } from './components/QuoteDetails'
import { Plus, FileText } from 'lucide-react'
import { toast } from 'sonner'

type ViewMode = 'list' | 'create' | 'edit' | 'view'

export default function QuotesPage() {
  const t = useTranslations()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedQuote, setSelectedQuote] = useState<QuoteWithRelations | null>(null)
  const [quoteToDelete, setQuoteToDelete] = useState<QuoteWithRelations | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data: quotes, loading, refetch, create, update, remove } = useQuotes(
    statusFilter !== 'all' ? { status: statusFilter as QuoteWithRelations['status'] } : {}
  )
  const { data: patients } = usePatients()
  const { data: services } = useServices()

  const handleCreate = useCallback(async (data: CreateQuoteData) => {
    try {
      await create(data)
      toast.success(t('quotes.messages.created'))
      setViewMode('list')
      refetch()
    } catch (error) {
      toast.error(t('quotes.messages.createError'))
    }
  }, [create, refetch, t])

  const handleUpdate = useCallback(async (data: CreateQuoteData) => {
    if (!selectedQuote) return
    try {
      await update(selectedQuote.id, data)
      toast.success(t('quotes.messages.updated'))
      setViewMode('list')
      setSelectedQuote(null)
      refetch()
    } catch (error) {
      toast.error(t('quotes.messages.updateError'))
    }
  }, [selectedQuote, update, refetch, t])

  const handleDelete = useCallback(async () => {
    if (!quoteToDelete) return
    try {
      await remove(quoteToDelete.id)
      toast.success(t('quotes.messages.deleted'))
      setQuoteToDelete(null)
      refetch()
    } catch (error) {
      toast.error(t('quotes.messages.deleteError'))
    }
  }, [quoteToDelete, remove, refetch, t])

  const handleDownloadPdf = useCallback(async (quote: QuoteWithRelations) => {
    try {
      const response = await fetch(`/api/quotes/${quote.id}/pdf`)
      if (!response.ok) throw new Error('Failed to generate PDF')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `presupuesto-${quote.quote_number}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success(t('quotes.messages.pdfGenerated'))
    } catch (error) {
      toast.error(t('quotes.messages.pdfError'))
    }
  }, [t])

  const handleSend = useCallback(async (quote: QuoteWithRelations) => {
    try {
      await update(quote.id, { status: 'sent' })
      toast.success(t('quotes.messages.sent'))
      refetch()
    } catch (error) {
      toast.error(t('quotes.messages.sendError'))
    }
  }, [update, refetch, t])

  const handleUpdateStatus = useCallback(async (
    quote: QuoteWithRelations,
    status: 'accepted' | 'rejected'
  ) => {
    try {
      await update(quote.id, { status })
      toast.success(t(`quotes.messages.${status}`))
      if (viewMode === 'view') {
        setSelectedQuote(null)
        setViewMode('list')
      }
      refetch()
    } catch (error) {
      toast.error(t('quotes.messages.statusError'))
    }
  }, [update, refetch, viewMode, t])

  const handleView = useCallback((quote: QuoteWithRelations) => {
    setSelectedQuote(quote)
    setViewMode('view')
  }, [])

  const handleEdit = useCallback((quote: QuoteWithRelations) => {
    setSelectedQuote(quote)
    setViewMode('edit')
  }, [])

  const handleCancel = useCallback(() => {
    setSelectedQuote(null)
    setViewMode('list')
  }, [])

  // Count quotes by status
  const statusCounts = quotes.reduce((acc, quote) => {
    acc[quote.status] = (acc[quote.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (viewMode === 'create') {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <PageHeader
          title={t('quotes.createQuote')}
          subtitle={t('quotes.createDescription')}
        />
        <QuoteForm
          patients={patients}
          services={services}
          onSubmit={handleCreate}
          onCancel={handleCancel}
        />
      </div>
    )
  }

  if (viewMode === 'edit' && selectedQuote) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <PageHeader
          title={t('quotes.editQuote')}
          subtitle={`${t('quotes.editing')} ${selectedQuote.quote_number}`}
        />
        <QuoteForm
          quote={selectedQuote}
          patients={patients}
          services={services}
          onSubmit={handleUpdate}
          onCancel={handleCancel}
        />
      </div>
    )
  }

  if (viewMode === 'view' && selectedQuote) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <QuoteDetails
          quote={selectedQuote}
          onEdit={() => handleEdit(selectedQuote)}
          onDownloadPdf={() => handleDownloadPdf(selectedQuote)}
          onSend={() => handleSend(selectedQuote)}
          onUpdateStatus={(status) => handleUpdateStatus(selectedQuote, status)}
          onClose={handleCancel}
        />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title={t('quotes.title')}
        subtitle={t('quotes.subtitle')}
        action={
          <Button onClick={() => setViewMode('create')}>
            <Plus className="h-4 w-4 mr-2" />
            {t('quotes.createQuote')}
          </Button>
        }
      />

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">
            {t('quotes.filters.all')} ({quotes.length})
          </TabsTrigger>
          <TabsTrigger value="draft">
            {t('quotes.status.draft')} ({statusCounts.draft || 0})
          </TabsTrigger>
          <TabsTrigger value="sent">
            {t('quotes.status.sent')} ({statusCounts.sent || 0})
          </TabsTrigger>
          <TabsTrigger value="accepted">
            {t('quotes.status.accepted')} ({statusCounts.accepted || 0})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            {t('quotes.status.rejected')} ({statusCounts.rejected || 0})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <QuoteTable
        quotes={quotes}
        loading={loading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={setQuoteToDelete}
        onDownloadPdf={handleDownloadPdf}
        onSend={handleSend}
        onUpdateStatus={handleUpdateStatus}
      />

      <ConfirmDialog
        open={!!quoteToDelete}
        onOpenChange={() => setQuoteToDelete(null)}
        title={t('quotes.deleteConfirm.title')}
        description={t('quotes.deleteConfirm.description', {
          number: quoteToDelete?.quote_number,
        })}
        confirmLabel={t('common.delete')}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}
