'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/format'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  Building2,
  Calculator
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfitBreakdownCardProps {
  revenueCents: number
  expensesCents: number           // Registered expenses from expenses table
  netProfitCents: number          // Real profit = revenue - expenses
  netMarginPct?: number
  // Optional: for comparison with theoretical profit
  theoreticalProfitCents?: number
  differenceCents?: number        // positive = spent less than expected
  // Legacy props (kept for backward compatibility)
  variableCostsCents?: number
  fixedCostsCents?: number
  depreciationCents?: number
  loading?: boolean
}

interface BreakdownLineProps {
  label: string
  amountCents: number
  icon: React.ReactNode
  isSubtraction?: boolean
  isTotal?: boolean
  tooltip?: string
}

function BreakdownLine({
  label,
  amountCents,
  icon,
  isSubtraction,
  isTotal
}: BreakdownLineProps) {
  return (
    <div className={cn(
      "flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors",
      isTotal
        ? "bg-muted/50 border-2 border-primary/20"
        : "hover:bg-muted/30"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center",
          isTotal
            ? amountCents >= 0
              ? "bg-emerald-100 dark:bg-emerald-950/50"
              : "bg-red-100 dark:bg-red-950/50"
            : isSubtraction
              ? "bg-red-100/50 dark:bg-red-950/30"
              : "bg-emerald-100/50 dark:bg-emerald-950/30"
        )}>
          {icon}
        </div>
        <span className={cn(
          "text-sm",
          isTotal ? "font-semibold" : "text-muted-foreground"
        )}>
          {isSubtraction && !isTotal && <span className="text-red-500 mr-1">−</span>}
          {label}
        </span>
      </div>
      <span className={cn(
        "font-mono tabular-nums",
        isTotal
          ? cn(
              "text-lg font-bold",
              amountCents >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )
          : isSubtraction
            ? "text-red-600 dark:text-red-400"
            : "text-foreground"
      )}>
        {isSubtraction && !isTotal && "-"}
        {formatCurrency(Math.abs(amountCents))}
      </span>
    </div>
  )
}

export function ProfitBreakdownCard({
  revenueCents,
  expensesCents,
  netProfitCents,
  netMarginPct,
  theoreticalProfitCents,
  differenceCents,
  // Legacy props for backward compat
  variableCostsCents,
  fixedCostsCents,
  depreciationCents,
  loading
}: ProfitBreakdownCardProps) {
  const t = useTranslations('dashboardComponents.profitBreakdown')

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const isProfitable = netProfitCents > 0
  const isBreakEven = netProfitCents === 0

  return (
    <Card className={cn(
      "border-2 transition-all",
      isProfitable
        ? "border-emerald-200 dark:border-emerald-900/50"
        : isBreakEven
          ? "border-amber-200 dark:border-amber-900/50"
          : "border-red-200 dark:border-red-900/50"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              {t('title')}
            </CardTitle>
            <CardDescription className="mt-1">
              {t('descriptionReal')}
            </CardDescription>
          </div>
          {netMarginPct !== undefined && (
            <Badge
              variant="outline"
              className={cn(
                "gap-1",
                isProfitable
                  ? "text-emerald-600 border-emerald-200"
                  : isBreakEven
                    ? "text-amber-600 border-amber-200"
                    : "text-red-600 border-red-200"
              )}
            >
              {isProfitable ? (
                <TrendingUp className="h-3 w-3" />
              ) : isBreakEven ? (
                <Minus className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {netMarginPct.toFixed(1)}% {t('margin')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {/* Revenue */}
        <BreakdownLine
          label={t('revenue')}
          amountCents={revenueCents}
          icon={<DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
        />

        {/* Registered Expenses */}
        <BreakdownLine
          label={t('expenses')}
          amountCents={expensesCents}
          icon={<Building2 className="h-4 w-4 text-red-500 dark:text-red-400" />}
          isSubtraction
        />

        {/* Divider */}
        <div className="border-t border-dashed border-muted-foreground/30 my-2" />

        {/* Real Profit (Total) */}
        <BreakdownLine
          label={t('realProfit')}
          amountCents={netProfitCents}
          icon={
            isProfitable ? (
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : isBreakEven ? (
              <Minus className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
            )
          }
          isTotal
        />

        {/* Comparison with theoretical (optional) */}
        {differenceCents !== undefined && differenceCents !== 0 && (
          <p className={cn(
            "text-xs text-center pt-2",
            differenceCents > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-amber-600 dark:text-amber-400"
          )}>
            {differenceCents > 0
              ? t('spentLess', { amount: formatCurrency(Math.abs(differenceCents)) })
              : t('spentMore', { amount: formatCurrency(Math.abs(differenceCents)) })
            }
          </p>
        )}

        {/* Status message */}
        <p className={cn(
          "text-xs text-center pt-2",
          isProfitable
            ? "text-emerald-600 dark:text-emerald-400"
            : isBreakEven
              ? "text-amber-600 dark:text-amber-400"
              : "text-red-600 dark:text-red-400"
        )}>
          {isProfitable
            ? t('status.profitable')
            : isBreakEven
              ? t('status.breakEven')
              : t('status.losses')
          }
        </p>
      </CardContent>
    </Card>
  )
}
