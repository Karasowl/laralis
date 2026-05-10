'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from './button'
import { Card } from './card'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/20">
          <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-2xl border-0 bg-card/95 backdrop-blur">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-destructive/10">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">¡Oops! Algo salió mal</h2>
              <p className="text-muted-foreground">
                Encontramos un error inesperado. Por favor, intenta recargar la página.
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-4 p-4 bg-muted rounded-lg text-left">
                <p className="text-xs font-mono text-muted-foreground break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                Ir al inicio
              </Button>
              <Button
                onClick={this.handleReset}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reintentar
              </Button>
            </div>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}