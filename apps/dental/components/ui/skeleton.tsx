import * as React from 'react'
import { cn } from '@/lib/utils'

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('animate-pulse rounded-md bg-muted', className)}
        {...props}
      />
    )
  }
)
Skeleton.displayName = 'Skeleton'

const SkeletonCard = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('rounded-lg border bg-card p-6 shadow-sm', className)}
        {...props}
      >
        <div className="space-y-3">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-4/5" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      </div>
    )
  }
)
SkeletonCard.displayName = 'SkeletonCard'

const SkeletonTable = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('rounded-md border', className)}
        {...props}
      >
        <div className="border-b bg-muted/50 p-3 sm:p-4">
          <div className="flex space-x-2 sm:space-x-4 overflow-hidden">
            <Skeleton className="h-4 w-16 sm:w-24 shrink-0" />
            <Skeleton className="h-4 w-20 sm:w-32 shrink-0 hidden sm:block" />
            <Skeleton className="h-4 w-16 sm:w-28 shrink-0" />
            <Skeleton className="h-4 w-12 sm:w-20 shrink-0 hidden md:block" />
          </div>
        </div>
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex space-x-2 sm:space-x-4 p-3 sm:p-4 overflow-hidden">
              <Skeleton className="h-4 w-16 sm:w-24 shrink-0" />
              <Skeleton className="h-4 w-20 sm:w-32 shrink-0 hidden sm:block" />
              <Skeleton className="h-4 w-16 sm:w-28 shrink-0" />
              <Skeleton className="h-4 w-12 sm:w-20 shrink-0 hidden md:block" />
            </div>
          ))}
        </div>
      </div>
    )
  }
)
SkeletonTable.displayName = 'SkeletonTable'

export { Skeleton, SkeletonCard, SkeletonTable }
