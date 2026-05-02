/**
 * Data Visualization Component
 *
 * Simple visualizations for analytics data
 * Shows tables, lists, and basic stats
 */

'use client'

import { TrendingUp, TrendingDown, Minus, DollarSign, Users, Activity } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface DataVisualizationProps {
  data: any
  type?: 'auto' | 'table' | 'list' | 'stats'
}

export function DataVisualization({ data, type = 'auto' }: DataVisualizationProps) {
  const t = useTranslations('aiAssistant.messages')
  if (!data) return null

  // Auto-detect type based on data structure
  if (type === 'auto') {
    if (Array.isArray(data)) {
      type = 'table'
    } else if (typeof data === 'object') {
      type = 'stats'
    } else {
      return null
    }
  }

  // Stats visualization (for objects with metrics)
  if (type === 'stats') {
    return (
      <div className="grid grid-cols-2 gap-2 mt-3">
        {Object.entries(data).map(([key, value]) => {
          // Skip nested objects and nulls
          if (typeof value === 'object' || value === null) return null

          // Format key
          const label = key.replace(/_/g, ' ').replace(/cents/gi, '')

          // Detect if it's money
          const isMoney = key.includes('cents') || key.includes('revenue') || key.includes('price')

          // Detect if it's percentage
          const isPct = key.includes('pct') || key.includes('ratio') || key.includes('percent')

          // Format value
          let displayValue = value
          if (isMoney && typeof value === 'number') {
            displayValue = `$${(value / 100).toFixed(2)}`
          } else if (isPct && typeof value === 'number') {
            displayValue = `${value}%`
          }

          // Detect trend
          let trendIcon = null
          if (typeof value === 'number' && (key.includes('change') || key.includes('growth'))) {
            if (value > 0) {
              trendIcon = <TrendingUp className="h-3 w-3 text-green-500" />
            } else if (value < 0) {
              trendIcon = <TrendingDown className="h-3 w-3 text-red-500" />
            } else {
              trendIcon = <Minus className="h-3 w-3 text-gray-500" />
            }
          }

          return (
            <div
              key={key}
              className="p-2 bg-background/50 rounded border"
            >
              <div className="text-[10px] text-muted-foreground uppercase mb-0.5 capitalize">
                {label}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium">{displayValue}</span>
                {trendIcon}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Table visualization (for arrays of objects)
  if (type === 'table' && Array.isArray(data) && data.length > 0) {
    const keys = Object.keys(data[0]).filter(
      (k) => typeof data[0][k] !== 'object' && data[0][k] !== null
    )

    return (
      <div className="mt-3 border rounded overflow-hidden">
        <div className="overflow-x-auto max-h-48">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr>
                {keys.map((key) => (
                  <th
                    key={key}
                    className="px-2 py-1 text-left font-medium capitalize"
                  >
                    {key.replace(/_/g, ' ').replace(/cents/gi, '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 10).map((row, idx) => (
                <tr
                  key={idx}
                  className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                >
                  {keys.map((key) => {
                    let value = row[key]

                    // Format money
                    if (
                      key.includes('cents') &&
                      typeof value === 'number'
                    ) {
                      value = `$${(value / 100).toFixed(2)}`
                    }

                    // Format percentage
                    if (
                      (key.includes('pct') || key.includes('ratio')) &&
                      typeof value === 'number'
                    ) {
                      value = `${value}%`
                    }

                    return (
                      <td key={key} className="px-2 py-1">
                        {value}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.length > 10 && (
          <div className="px-2 py-1 text-[10px] text-muted-foreground bg-muted text-center">
            {t('showingResults', { total: data.length })}
          </div>
        )}
      </div>
    )
  }

  // Fallback: JSON view
  return (
    <div className="mt-3 p-2 bg-background/50 rounded text-xs border">
      <pre className="overflow-x-auto whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}
