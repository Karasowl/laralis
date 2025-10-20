'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Megaphone, TrendingUp, TrendingDown, Users, DollarSign, Target } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface CampaignROI {
  id: string
  name: string
  platform?: string
  investmentCents: number
  revenueCents: number
  patientsCount: number
  roi: number // Percentage
  avgRevenuePerPatientCents: number
  status: 'active' | 'paused' | 'completed'
}

interface MarketingROITableProps {
  campaigns: CampaignROI[]
  loading?: boolean
  title?: string
  description?: string
}

export function MarketingROITable({
  campaigns,
  loading = false,
  title,
  description
}: MarketingROITableProps) {
  const t = useTranslations('dashboardComponents.marketingROI')

  const { totalInvestment, totalRevenue, totalROI, bestCampaign, worstCampaign } = useMemo(() => {
    if (campaigns.length === 0) {
      return {
        totalInvestment: 0,
        totalRevenue: 0,
        totalROI: 0,
        bestCampaign: null,
        worstCampaign: null
      }
    }

    const investment = campaigns.reduce((sum, c) => sum + c.investmentCents, 0)
    const revenue = campaigns.reduce((sum, c) => sum + c.revenueCents, 0)
    const roi = investment > 0 ? ((revenue - investment) / investment) * 100 : 0

    const sorted = [...campaigns].sort((a, b) => b.roi - a.roi)

    return {
      totalInvestment: investment,
      totalRevenue: revenue,
      totalROI: roi,
      bestCampaign: sorted[0] || null,
      worstCampaign: sorted[sorted.length - 1] || null
    }
  }, [campaigns])

  const getROIColor = (roi: number) => {
    if (roi >= 200) return 'text-emerald-600'
    if (roi >= 100) return 'text-green-600'
    if (roi >= 0) return 'text-blue-600'
    return 'text-red-600'
  }

  const getROIBadgeVariant = (roi: number) => {
    if (roi >= 200) return 'default'
    if (roi >= 100) return 'secondary'
    return 'outline'
  }

  const getStatusBadge = (status: CampaignROI['status']) => {
    const variants = {
      active: { label: t('status.active'), className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      paused: { label: t('status.paused'), className: 'bg-amber-100 text-amber-700 border-amber-200' },
      completed: { label: t('status.completed'), className: 'bg-gray-100 text-gray-700 border-gray-200' }
    }
    return variants[status]
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {title || t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {title || t('title')}
          </CardTitle>
          <CardDescription>{description || t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">{t('noCampaigns')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          {title || t('title')}
        </CardTitle>
        <CardDescription>{description || t('description')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              {t('totalInvestment')}
            </div>
            <p className="text-lg font-bold">{formatCurrency(totalInvestment)}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Target className="h-3.5 w-3.5" />
              {t('totalRevenue')}
            </div>
            <p className="text-lg font-bold">{formatCurrency(totalRevenue)}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              {t('totalROI')}
            </div>
            <p className={cn('text-lg font-bold', getROIColor(totalROI))}>
              {totalROI.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.campaign')}</TableHead>
                <TableHead className="text-right">{t('table.investment')}</TableHead>
                <TableHead className="text-right">{t('table.revenue')}</TableHead>
                <TableHead className="text-right">{t('table.patients')}</TableHead>
                <TableHead className="text-right">{t('table.roi')}</TableHead>
                <TableHead>{t('table.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{campaign.name}</p>
                      {campaign.platform && (
                        <p className="text-xs text-muted-foreground">{campaign.platform}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(campaign.investmentCents)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(campaign.revenueCents)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {campaign.patientsCount}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={getROIBadgeVariant(campaign.roi)}
                      className={cn('gap-1', getROIColor(campaign.roi))}
                    >
                      {campaign.roi > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {campaign.roi.toFixed(0)}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={getStatusBadge(campaign.status).className}
                    >
                      {getStatusBadge(campaign.status).label}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Insights */}
        {bestCampaign && worstCampaign && campaigns.length > 1 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg">
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">
                {t('insights.best')}
              </p>
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">
                {bestCampaign.name}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">
                ROI: {bestCampaign.roi.toFixed(0)}%
              </p>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">
                {t('insights.worst')}
              </p>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                {worstCampaign.name}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                ROI: {worstCampaign.roi.toFixed(0)}%
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
