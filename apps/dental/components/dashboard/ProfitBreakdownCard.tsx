'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrency } from '@/lib/format'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  Building2,
  Calculator,
  HelpCircle,
  AlertTriangle
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
  subtitle?: string
  amountCents: number
  icon: React.ReactNode
  tooltip?: string
  isSubtraction?: boolean
  isTotal?: boolean
  variant?: 'gross' | 'net' | 'theoretical'
}

function BreakdownLine({
  label,
  subtitle,
  amountCents,
  icon,
  tooltip,
  isSubtraction,
  isTotal,
  variant = 'net'
}: BreakdownLineProps) {
  const content = (
    <div className={cn(
      "flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors",
      isTotal
        ? "bg-muted/50 border-2 border-primary/20"
        : "hover:bg-muted/30"
    )}>
      <div className="flex items-center gap-3 flex-1">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          isTotal
            ? amountCents >= 0
              ? variant === 'net'
                ? "bg-emerald-100 dark:bg-emerald-950/50"
                : variant === 'theoretical'
                ? "bg-blue-100 dark:bg-blue-950/50"
                : "bg-slate-100 dark:bg-slate-950/50"
              : "bg-red-100 dark:bg-red-950/50"
            : isSubtraction
              ? "bg-red-100/50 dark:bg-red-950/30"
              : "bg-emerald-100/50 dark:bg-emerald-950/30"
        )}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "text-sm",
              isTotal ? "font-semibold" : "text-muted-foreground"
            )}>
              {isSubtraction && !isTotal && <span className="text-red-500 mr-1">−</span>}
              {label}
            </span>
            {tooltip && (
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <span className={cn(
        "font-mono tabular-nums shrink-0 ml-2",
        isTotal
          ? cn(
              "text-lg font-bold",
              amountCents >= 0
                ? variant === 'net'
                  ? "text-emerald-600 dark:text-emerald-400"
                  : variant === 'theoretical'
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-600 dark:text-slate-400"
                : "text-red-600 dark:text-red-400"
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

  if (tooltip) {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild className="cursor-help">
            {content}
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <p className="text-sm">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return content
}

export function ProfitBreakdownCard({
  revenueCents,
  expensesCents,
  netProfitCents,
  netMarginPct,
  theoreticalProfitCents,
  differenceCents,
  // Legacy props for backward compat
  variableCostsCents = 0,
  fixedCostsCents = 0,
  depreciationCents = 0,
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
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const isProfitable = netProfitCents > 0
  const isBreakEven = netProfitCents === 0

  // Calculate gross profit (revenue - variable costs only)
  const grossProfitCents = revenueCents - variableCostsCents

  // Calculate theoretical total costs
  const theoreticalTotalCostsCents = variableCostsCents + fixedCostsCents + depreciationCents
  const calculatedTheoreticalProfitCents = revenueCents - theoreticalTotalCostsCents

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
              {t('description')}
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

        {/* Variable Costs (if available) */}
        {variableCostsCents > 0 && (
          <BreakdownLine
            label={t('variableCosts')}
            amountCents={variableCostsCents}
            icon={<Package className="h-4 w-4 text-red-500 dark:text-red-400" />}
            isSubtraction
          />
        )}

        {/* Gross Profit (if variable costs available) */}
        {variableCostsCents > 0 && (
          <>
            <div className="border-t border-dashed border-muted-foreground/30 my-1" />
            <BreakdownLine
              label={t('grossProfit')}
              subtitle={t('grossProfitSubtitle')}
              amountCents={grossProfitCents}
              tooltip={t('grossProfitTooltip')}
              icon={<TrendingUp className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
              isTotal
              variant="gross"
            />
          </>
        )}

        {/* Registered Expenses */}
        <BreakdownLine
          label={t('expenses')}
          amountCents={expensesCents}
          icon={<Building2 className="h-4 w-4 text-red-500 dark:text-red-400" />}
          isSubtraction
        />

        {/* Divider */}
        <div className="border-t border-dashed border-muted-foreground/30 my-2" />

        {/* Net Profit (Real - Total) */}
        <BreakdownLine
          label={t('netProfit')}
          subtitle={t('netProfitSubtitle')}
          amountCents={netProfitCents}
          tooltip={t('netProfitTooltip')}
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
          variant="net"
        />

        {/* Theoretical Profit (if available) */}
        {theoreticalTotalCostsCents > 0 && (
          <BreakdownLine
            label={t('theoreticalProfit')}
            subtitle={t('theoreticalProfitSubtitle')}
            amountCents={calculatedTheoreticalProfitCents}
            tooltip={t('theoreticalProfitTooltip')}
            icon={<Calculator className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
            isTotal
            variant="theoretical"
          />
        )}

        {/* Comparison with theoretical (optional) */}
        {differenceCents !== undefined && differenceCents !== 0 && (
          <div className={cn(
            "flex items-center gap-2 justify-center text-xs pt-2 px-3 py-2 rounded-lg mt-2",
            differenceCents > 0
              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
          )}>
            {differenceCents > 0 ? (
              <TrendingDown className="h-4 w-4" />
            ) : (
              <TrendingUp className="h-4 w-4" />
            )}
            <span className="font-medium">
              {differenceCents > 0
                ? t('spentLess', { amount: formatCurrency(Math.abs(differenceCents)) })
                : t('spentMore', { amount: formatCurrency(Math.abs(differenceCents)) })
              }
            </span>
          </div>
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
