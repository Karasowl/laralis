'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { TrendingDown, TrendingUp } from 'lucide-react'

interface ProfitTrendData {
  month: string
  [serviceId: string]: number | string // service_id: margin_percentage
}

interface ServiceInfo {
  id: string
  name: string
  color: string
  currentMargin: number
  previousMargin: number
  change: number
}

interface ProfitTrendsChartProps {
  data: ProfitTrendData[]
  services: ServiceInfo[]
  loading?: boolean
}

const CHART_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ef4444', // red-500
]

export function ProfitTrendsChart({ data, services, loading }: ProfitTrendsChartProps) {
  const t = useTranslations('dashboard.profitability')
  const tCommon = useTranslations('common')

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-48 animate-pulse" />
          <div className="h-4 bg-muted rounded w-64 animate-pulse mt-2" />
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0 || !services || services.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('margin_evolution')}</CardTitle>
          <CardDescription>{t('top_services_6_months')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-80 text-sm text-muted-foreground">
            {t('no_trend_data')}
          </div>
        </CardContent>
      </Card>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-border rounded-lg shadow-lg">
          <p className="font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => {
            const service = services.find(s => s.id === entry.dataKey)
            return (
              <p key={index} className="text-sm" style={{ color: entry.color }}>
                {service?.name}: {entry.value.toFixed(1)}%
              </p>
            )
          })}
        </div>
      )
    }
    return null
  }

  // Calculate insights
  const decliningServices = services.filter(s => s.change < -5)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{t('margin_evolution')}</CardTitle>
            <CardDescription>{t('top_services_6_months')}</CardDescription>
          </div>
          {decliningServices.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <TrendingDown className="h-3 w-3" />
              {decliningServices.length} {t('declining')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Chart */}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value) => {
                    const service = services.find(s => s.id === value)
                    return service?.name || value
                  }}
                />
                {services.map((service, index) => (
                  <Line
                    key={service.id}
                    type="monotone"
                    dataKey={service.id}
                    stroke={service.color}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Service Summary */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 pt-4 border-t">
            {services.map((service) => (
              <div key={service.id} className="flex items-start gap-2">
                <div
                  className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                  style={{ backgroundColor: service.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{service.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <p className="text-xs text-muted-foreground">
                      {service.currentMargin.toFixed(1)}%
                    </p>
                    {service.change !== 0 && (
                      <span className={`text-xs flex items-center gap-0.5 ${
                        service.change > 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {service.change > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {Math.abs(service.change).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Insights */}
          {decliningServices.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-4">
              <div className="flex items-start gap-2">
                <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    {t('margin_decline_alert')}
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                    {decliningServices.map(s => s.name).join(', ')} {t('declining_margin_action')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
