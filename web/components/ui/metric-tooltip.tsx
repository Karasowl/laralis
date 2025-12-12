'use client'

import * as React from 'react'
import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatCurrency } from '@/lib/money'

export interface MetricTooltipData {
  formula: string
  values?: { label: string; amount: number; isCount?: boolean }[]
  explanation: string
}

interface MetricTooltipProps {
  data: MetricTooltipData
  children: React.ReactNode
}

export function MetricTooltip({ data, children }: MetricTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5 cursor-help">
            {children}
            <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs p-3" side="top">
          <div className="space-y-2">
            <p className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded inline-block">
              {data.formula}
            </p>
            {data.values && data.values.length > 0 && (
              <div className="space-y-1 border-t pt-2">
                {data.values.map((v, i) => (
                  <div key={i} className="flex justify-between text-xs gap-4">
                    <span className="text-muted-foreground">{v.label}</span>
                    <span className="font-medium">{v.isCount ? v.amount.toLocaleString() : formatCurrency(v.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground border-t pt-2">
              {data.explanation}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
