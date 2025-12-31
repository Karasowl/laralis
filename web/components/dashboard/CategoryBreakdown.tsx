'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, Sector } from 'recharts'
import { X, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useClinicCurrency } from '@/hooks/use-clinic-currency'
import { useTranslations } from 'next-intl'

export type MetricType = 'revenue' | 'profit' | 'count'

interface Category {
  id: string
  name: string
}

interface CategoryBreakdownProps {
  data: Array<{
    name: string
    value: number
    color?: string
  }>
  title?: string
  description?: string
  colors?: string[]
  // New props for filtering and metrics
  categories?: Category[]
  selectedCategories?: string[]
  onCategoryChange?: (ids: string[]) => void
  metric?: MetricType
  onMetricChange?: (metric: MetricType) => void
  showMetricSelector?: boolean
}

const DEFAULT_COLORS = ['hsl(221, 83%, 53%)', 'hsl(271, 81%, 56%)', '#10B981', '#F59E0B', 'hsl(0, 84%, 60%)', '#EC4899', '#14B8A6', '#6366F1']

export function CategoryBreakdown({
  data,
  title = 'Category Breakdown',
  description = 'Distribution by category',
  colors = DEFAULT_COLORS,
  categories,
  selectedCategories,
  onCategoryChange,
  metric = 'revenue',
  onMetricChange,
  showMetricSelector = false
}: CategoryBreakdownProps) {
  const { format: formatCurrency } = useClinicCurrency()
  const t = useTranslations('common')
  const tFilters = useTranslations('filters')
  const tDashboard = useTranslations('dashboard')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  // Calculate total for percentage display
  const total = data.reduce((sum, item) => sum + item.value, 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value as number
      const total = data.reduce((a, b) => a + b.value, 0)
      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
      return (
        <div className="bg-background/95 dark:bg-background/95 backdrop-blur-xl p-3 border border-border rounded-lg shadow-lg">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(value)}
          </p>
          <p className="text-xs text-muted-foreground">
            {percentage}%
          </p>
        </div>
      )
    }
    return null
  }

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 10} // Pop-out effect
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke={fill}
        strokeWidth={2}
      />
    )
  }

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    if (percent < 0.05) return null // Don't show label for small slices

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  // Don't render chart if no data
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="transition-all duration-200 hover:shadow-lg">
      <CardHeader className="pb-2 sm:pb-4">
        <div className="flex flex-row items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">{description}</CardDescription>
          </div>

          {/* Category Filter Dropdown */}
          {categories && categories.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Filter className="h-4 w-4 mr-2" />
                  {tFilters('category')}
                  {selectedCategories && selectedCategories.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 justify-center">
                      {selectedCategories.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{tFilters('selectCategories')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {categories.map(cat => (
                  <DropdownMenuCheckboxItem
                    key={cat.id}
                    checked={selectedCategories?.includes(cat.id)}
                    onCheckedChange={(checked) => {
                      const newSelection = checked
                        ? [...(selectedCategories || []), cat.id]
                        : (selectedCategories || []).filter(id => id !== cat.id)
                      onCategoryChange?.(newSelection)
                    }}
                  >
                    {cat.name}
                  </DropdownMenuCheckboxItem>
                ))}
                {selectedCategories && selectedCategories.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onCategoryChange?.([])}>
                      {tFilters('clearAll')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-4 lg:p-6">
        {/* Metric Selector */}
        {showMetricSelector && (
          <div className="flex justify-center mb-4">
            <div className="inline-flex rounded-lg border p-1 bg-muted/30">
              {[
                { value: 'revenue', label: tDashboard('metrics.revenue') },
                { value: 'profit', label: tDashboard('metrics.profit') },
                { value: 'count', label: tDashboard('metrics.count') }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => onMetricChange?.(option.value as MetricType)}
                  className={cn(
                    "px-3 py-1 text-sm rounded-md transition-colors",
                    metric === option.value
                      ? "bg-background shadow-sm font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              labelLine={false}
              label={CustomLabel}
              outerRadius="55%"
              fill="#8884d8"
              dataKey="value"
              activeIndex={activeIndex !== null ? activeIndex : undefined}
              activeShape={renderActiveShape}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={(_, index) => setActiveIndex(prev => prev === index ? null : index)}
              minAngle={15}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color || colors[index % colors.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              content={({ payload }) => (
                <div className="flex flex-wrap gap-2 justify-center mt-4 px-2">
                  {payload?.map((entry: any, index: number) => (
                    <TooltipProvider key={index}>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors",
                              "hover:bg-muted",
                              activeIndex === index && "bg-muted ring-1 ring-primary"
                            )}
                            onClick={() => setActiveIndex(prev => prev === index ? null : index)}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="truncate max-w-[60px] sm:max-w-[100px]">
                              {entry.value}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[200px]">
                          <p className="font-medium">{entry.value}</p>
                          {data[index] && (
                            <p className="text-muted-foreground text-xs">
                              {formatCurrency(data[index].value)}
                            </p>
                          )}
                        </TooltipContent>
                      </UITooltip>
                    </TooltipProvider>
                  ))}
                </div>
              )}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Detail Panel */}
        {activeIndex !== null && data[activeIndex] && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg border animate-in fade-in-0 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colors[activeIndex % colors.length] }}
                />
                <span className="font-medium">{data[activeIndex].name}</span>
              </div>
              <button
                onClick={() => setActiveIndex(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label={t('close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t('total')}</p>
                <p className="text-lg font-semibold">{formatCurrency(data[activeIndex].value)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('percentage')}</p>
                <p className="text-lg font-semibold">
                  {((data[activeIndex].value / total) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
