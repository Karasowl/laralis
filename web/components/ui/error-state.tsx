'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  AlertCircle, 
  WifiOff, 
  FileQuestion, 
  ServerCrash, 
  RefreshCw,
  Home,
  ArrowLeft
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  error?: Error | string | null
  retry?: () => void
  fullPage?: boolean
  className?: string
  showBackButton?: boolean
  customMessage?: string
}

export function ErrorState({ 
  error, 
  retry, 
  fullPage = false,
  className,
  showBackButton = false,
  customMessage
}: ErrorStateProps) {
  const t = useTranslations('common')
  const router = useRouter()
  
  // Parse error to determine type
  const errorMessage = customMessage || (typeof error === 'string' ? error : error?.message || '')
  const isNetworkError = errorMessage.toLowerCase().includes('fetch') || 
                        errorMessage.toLowerCase().includes('network') ||
                        errorMessage.toLowerCase().includes('failed to fetch')
  const is404 = errorMessage.includes('404') || errorMessage.toLowerCase().includes('not found')
  const is500 = errorMessage.includes('500') || errorMessage.toLowerCase().includes('server error')
  const isUnauthorized = errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized')
  
  // Get appropriate error content
  const getErrorContent = () => {
    if (isNetworkError) return {
      icon: WifiOff,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      borderColor: 'border-orange-200 dark:border-orange-800',
      title: t('errors.network.title', 'Connection Error'),
      description: t('errors.network.description', 'Check your internet connection and try again'),
      actionLabel: t('retry', 'Retry'),
      showRetry: true
    }
    
    if (is404) return {
      icon: FileQuestion,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-800',
      title: t('errors.notFound.title', 'Page Not Found'),
      description: t('errors.notFound.description', 'The content you are looking for is not available'),
      actionLabel: t('goHome', 'Go to Home'),
      showRetry: false,
      goHome: true
    }
    
    if (is500) return {
      icon: ServerCrash,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
      title: t('errors.server.title', 'Server Error'),
      description: t('errors.server.description', 'We are experiencing technical issues. Please try again later'),
      actionLabel: t('retry', 'Retry'),
      showRetry: true
    }
    
    if (isUnauthorized) return {
      icon: AlertCircle,
      iconColor: 'text-yellow-500',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      title: t('errors.unauthorized.title', 'Access Denied'),
      description: t('errors.unauthorized.description', 'You do not have permission to access this resource'),
      actionLabel: t('goBack', 'Go Back'),
      showRetry: false,
      goBack: true
    }
    
    // Default error
    return {
      icon: AlertCircle,
      iconColor: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/20',
      title: t('errors.default.title', 'Something went wrong'),
      description: customMessage || t('errors.default.description', 'An unexpected error occurred. Please try again'),
      actionLabel: t('retry', 'Retry'),
      showRetry: true
    }
  }
  
  const content = getErrorContent()
  const containerClass = cn(
    'flex items-center justify-center p-4',
    fullPage ? 'min-h-screen' : 'min-h-[400px]',
    className
  )
  
  const handleAction = () => {
    if (content.goHome) {
      router.push('/')
    } else if (content.goBack) {
      router.back()
    } else if (retry) {
      retry()
    }
  }
  
  return (
    <div className={containerClass}>
      <Card className={cn(
        'w-full max-w-md transition-all duration-300 hover:shadow-lg',
        content.borderColor,
        content.bgColor
      )}>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Icon with animation */}
            <div className={cn(
              'p-4 rounded-full',
              content.bgColor,
              'animate-in zoom-in-50 duration-300'
            )}>
              <content.icon className={cn('h-8 w-8', content.iconColor)} />
            </div>
            
            {/* Text content */}
            <div className="space-y-2 animate-in fade-in-50 duration-500">
              <h3 className="text-lg font-semibold">{content.title}</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {content.description}
              </p>
              
              {/* Show error details in development */}
              {process.env.NODE_ENV === 'development' && errorMessage && (
                <details className="mt-4 text-left w-full">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    Technical details
                  </summary>
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                    {errorMessage}
                  </pre>
                </details>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex gap-2 w-full animate-in slide-in-from-bottom-2 duration-500">
              {showBackButton && (
                <Button
                  variant="outline"
                  onClick={() => router.back()}
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('back', 'Back')}
                </Button>
              )}
              
              {(content.showRetry || content.goHome || content.goBack) && (
                <Button 
                  onClick={handleAction}
                  className="flex-1"
                  variant={content.showRetry ? 'default' : 'outline'}
                >
                  {content.showRetry && <RefreshCw className="h-4 w-4 mr-2" />}
                  {content.goHome && <Home className="h-4 w-4 mr-2" />}
                  {content.goBack && <ArrowLeft className="h-4 w-4 mr-2" />}
                  {content.actionLabel}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Empty state component for when there's no data
interface EmptyStateProps {
  icon?: React.ElementType
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  icon: Icon = FileQuestion,
  title,
  description,
  action,
  className
}: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center p-8 text-center',
      'min-h-[300px]',
      className
    )}>
      <div className="p-4 bg-muted/30 rounded-full mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}