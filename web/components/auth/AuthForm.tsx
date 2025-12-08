'use client'

import { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { UseFormReturn } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

interface AuthFormProps {
  title: string
  description?: string
  form: UseFormReturn<any>
  onSubmit: (data: any) => void | Promise<void>
  isSubmitting?: boolean
  submitLabel: string
  children: ReactNode
  footer?: {
    text: string
    linkText: string
    linkHref: string
  }
  error?: string | null
}

export function AuthForm({
  title,
  description,
  form,
  onSubmit,
  isSubmitting = false,
  submitLabel,
  children,
  footer,
  error
}: AuthFormProps) {
  return (
    <div className="w-full">
      <div className="space-y-1 sm:space-y-2 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-center">{title}</h2>
        {description && (
          <p className="text-center text-xs sm:text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          {error && (
            <div className="p-2.5 sm:p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-xs sm:text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="space-y-3 sm:space-y-4">
            {children}
          </div>

          <div className="space-y-3 sm:space-y-4">
            <Button
              type="submit"
              className="w-full h-10 sm:h-12 font-semibold bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  {submitLabel}...
                </>
              ) : (
                submitLabel
              )}
            </Button>

            {footer && (
              <p className="text-xs sm:text-sm text-center text-muted-foreground">
                {footer.text}{' '}
                <Link href={footer.linkHref} className="font-medium text-primary hover:underline">
                  {footer.linkText}
                </Link>
              </p>
            )}
          </div>
        </form>
      </Form>
    </div>
  )
}