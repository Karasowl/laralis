'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface SummaryCardData {
  id?: string;
  label: string;
  value: string | number | React.ReactNode;
  subtitle?: string;
  /** Optional period indicator shown after the label (e.g., "This month") */
  periodLabel?: string;
  icon?: LucideIcon | React.ReactNode;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  color?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  onClick?: () => void;
}

interface SummaryCardsProps {
  cards: SummaryCardData[];
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
  cardClassName?: string;
}

const colorClasses = {
  default: '',
  primary: 'text-primary',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  danger: 'text-red-600 dark:text-red-400',
  info: 'text-primary dark:text-primary/80',
};

const columnClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
};

export function SummaryCards({
  cards,
  columns = 4,
  className,
  cardClassName,
}: SummaryCardsProps) {
  return (
    <div className={cn(`grid ${columnClasses[columns]} gap-4`, className)}>
      {cards.map((card, index) => (
        <SummaryCard
          key={card.id || index}
          {...card}
          className={cardClassName}
        />
      ))}
    </div>
  );
}

interface SummaryCardProps extends SummaryCardData {
  className?: string;
}

export function SummaryCard({
  label,
  value,
  subtitle,
  periodLabel,
  icon,
  trend,
  color = 'default',
  onClick,
  className,
}: SummaryCardProps) {
  const isClickable = !!onClick;
  const Icon = icon;

  return (
    <Card
      className={cn(
        'p-4 transition-all',
        isClickable && 'cursor-pointer hover:shadow-md hover:scale-[1.02]',
        className
      )}
      onClick={onClick}
    >
      <div className="space-y-2">
        {/* Header with icon */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">
              {label}
              {periodLabel && (
                <span className="ml-1 text-xs font-normal opacity-75">
                  ({periodLabel})
                </span>
              )}
            </p>
          </div>
          {Icon && (
            <div className={cn('ml-2', colorClasses[color])}>
              {React.isValidElement(Icon) ? (
                Icon
              ) : typeof Icon === 'function' ? (
                <Icon className="h-4 w-4" />
              ) : null}
            </div>
          )}
        </div>
        
        {/* Value */}
        <div className={cn('text-2xl font-semibold', colorClasses[color])}>
          {value}
        </div>
        
        {/* Subtitle or trend */}
        {(subtitle || trend) && (
          <div className="flex items-center justify-between">
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    'text-xs font-medium',
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {trend.isPositive ? '↑' : '↓'} {trend.value}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {trend.label}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// Preset card layouts for common use cases
interface MetricCardsProps {
  metrics: {
    label: string;
    value: string | number;
    change?: number;
    changeLabel?: string;
    icon?: LucideIcon;
  }[];
  className?: string;
}

export function MetricCards({ metrics, className }: MetricCardsProps) {
  const cards: SummaryCardData[] = metrics.map((metric) => ({
    label: metric.label,
    value: metric.value,
    icon: metric.icon,
    trend: metric.change
      ? {
          value: metric.change,
          label: metric.changeLabel || 'vs last period',
          isPositive: metric.change > 0,
        }
      : undefined,
  }));

  return <SummaryCards cards={cards} columns={metrics.length as any} className={className} />;
}

// Stats cards with consistent styling
interface StatsCardsProps {
  stats: {
    title: string;
    value: string | number;
    description?: string;
    icon?: LucideIcon;
    color?: SummaryCardData['color'];
  }[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export function StatsCards({ stats, columns = 4, className }: StatsCardsProps) {
  const cards: SummaryCardData[] = stats.map((stat) => ({
    label: stat.title,
    value: stat.value,
    subtitle: stat.description,
    icon: stat.icon,
    color: stat.color,
  }));

  return <SummaryCards cards={cards} columns={columns} className={className} />;
}