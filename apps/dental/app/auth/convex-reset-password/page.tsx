'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { AlertCircle, CheckCircle, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthForm } from '@/components/auth/AuthForm'
import { InputField } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>

function ConvexResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    mode: 'onBlur',
  })

  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setError('El enlace no contiene token de migracion.')
        setChecking(false)
        return
      }

      const response = await fetch(`/api/auth/convex-password-reset/verify?token=${encodeURIComponent(token)}`)
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.ok) {
        setError(body?.error || 'El enlace expiro o no es valido.')
        setChecking(false)
        return
      }

      setEmail(body.email)
      setChecking(false)
    }

    verifyToken().catch((error) => {
      setError(error instanceof Error ? error.message : 'No se pudo verificar el enlace.')
      setChecking(false)
    })
  }, [token])

  const onSubmit = async (data: ResetPasswordForm) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/convex-password-reset/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token,
          password: data.password,
        }),
      })
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || 'No se pudo guardar la nueva contraseña.')
      }

      setSuccess(true)
      toast.success('Contraseña actualizada')
      setTimeout(() => {
        router.push('/')
      }, 1000)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar la nueva contraseña.'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <AuthLayout showLogo={false}>
        <div className="text-center space-y-3 sm:space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary mx-auto" />
          <p className="text-xs sm:text-sm text-muted-foreground">Verificando enlace...</p>
        </div>
      </AuthLayout>
    )
  }

  if (success) {
    return (
      <AuthLayout showLogo={false}>
        <div className="text-center space-y-4 sm:space-y-6">
          <div className="inline-flex p-3 sm:p-4 bg-green-100 dark:bg-green-900/20 rounded-full">
            <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 dark:text-green-400" />
          </div>
          <div className="space-y-1 sm:space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold">Contraseña actualizada</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Entrando a Laralis...</p>
          </div>
        </div>
      </AuthLayout>
    )
  }

  if (error && !email) {
    return (
      <AuthLayout showLogo={false}>
        <div className="text-center space-y-4 sm:space-y-6">
          <div className="inline-flex p-3 sm:p-4 bg-destructive/15 dark:bg-destructive/20 rounded-full">
            <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-destructive dark:text-destructive/80" />
          </div>
          <div className="space-y-1 sm:space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold">Enlace no valido</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => router.push('/auth/login')}>
            Volver al login
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout showLogo={false}>
      <AuthForm
        title="Crear contraseña"
        description={email ? `Cuenta: ${email}` : 'Define tu contraseña de acceso'}
        form={form}
        onSubmit={onSubmit}
        isSubmitting={loading}
        submitLabel="Guardar contraseña"
        error={error}
      >
        <div className="space-y-3 sm:space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-7 sm:top-8 h-4 w-4 text-muted-foreground pointer-events-none" />
            <InputField
              label="Contraseña"
              type="password"
              placeholder="Nueva contraseña"
              {...form.register('password')}
              error={form.formState.errors.password?.message}
              required
              className="pl-10"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-7 sm:top-8 h-4 w-4 text-muted-foreground pointer-events-none" />
            <InputField
              label="Confirmar contraseña"
              type="password"
              placeholder="Repite la contraseña"
              {...form.register('confirmPassword')}
              error={form.formState.errors.confirmPassword?.message}
              required
              className="pl-10"
            />
          </div>
        </div>
      </AuthForm>
    </AuthLayout>
  )
}

export default function ConvexResetPasswordPage() {
  return (
    <Suspense fallback={
      <AuthLayout showLogo={false}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
        </div>
      </AuthLayout>
    }>
      <ConvexResetPasswordContent />
    </Suspense>
  )
}
