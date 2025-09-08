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
      <div className="space-y-2 mb-6">
        <h2 className="text-2xl font-bold text-center">{title}</h2>
        {description && (
          <p className="text-center text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          
          <div className="space-y-4">
            {children}
          </div>
          
          <div className="space-y-4">
            <Button 
              type="submit" 
              className="w-full h-12 font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]" 
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {submitLabel}...
                </>
              ) : (
                submitLabel
              )}
            </Button>
            
            {footer && (
              <p className="text-sm text-center text-muted-foreground">
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