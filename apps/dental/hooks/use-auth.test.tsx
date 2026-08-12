import { act, renderHook } from '@testing-library/react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  convexSignIn: vi.fn(),
  convexSignOut: vi.fn(),
  routerPush: vi.fn(),
  routerRefresh: vi.fn(),
  supabaseSignIn: vi.fn(),
  supabaseSignUp: vi.fn(),
  supabaseResetPassword: vi.fn(),
  supabaseSignOut: vi.fn(),
  supabaseUpdateUser: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({
    signIn: mocks.convexSignIn,
    signOut: mocks.convexSignOut,
  }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mocks.supabaseSignIn,
      signUp: mocks.supabaseSignUp,
      resetPasswordForEmail: mocks.supabaseResetPassword,
      signOut: mocks.supabaseSignOut,
      updateUser: mocks.supabaseUpdateUser,
    },
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mocks.routerPush,
    refresh: mocks.routerRefresh,
  }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('sonner', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}))

let useAuth: typeof import('./use-auth').useAuth

describe('useAuth in dual mode', () => {
  beforeAll(async () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_BACKEND', 'dual')
    vi.stubEnv('NEXT_PUBLIC_CONVEX_AUTH_BRIDGE', '0')
    ;({ useAuth } = await import('./use-auth'))
  })

  afterAll(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    mocks.convexSignIn.mockResolvedValue(undefined)
    mocks.convexSignOut.mockResolvedValue(undefined)
  })

  it('registers through Convex without creating a Supabase account', async () => {
    const { result } = renderHook(() => useAuth())

    let succeeded = false
    await act(async () => {
      succeeded = await result.current.register({
        email: 'codex.qa@example.test',
        password: 'correct-horse',
        confirmPassword: 'correct-horse',
        firstName: 'Codex',
        lastName: 'QA',
      })
    })

    expect(succeeded).toBe(true)
    expect(mocks.convexSignIn).toHaveBeenCalledWith('password', expect.objectContaining({
      email: 'codex.qa@example.test',
      flow: 'signUp',
    }))
    expect(mocks.supabaseSignUp).not.toHaveBeenCalled()
  })

  it('logs a migrated user in through Convex without Supabase', async () => {
    const { result } = renderHook(() => useAuth())

    let succeeded = false
    await act(async () => {
      succeeded = await result.current.login({
        email: 'migrated@example.test',
        password: 'correct-horse',
      })
    })

    expect(succeeded).toBe(true)
    expect(mocks.convexSignIn).toHaveBeenCalledWith('password', expect.objectContaining({ flow: 'signIn' }))
    expect(mocks.supabaseSignIn).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('starts password reset in Convex without Supabase', async () => {
    const { result } = renderHook(() => useAuth())

    let succeeded = false
    await act(async () => {
      succeeded = await result.current.resetPassword('migrated@example.test')
    })

    expect(succeeded).toBe(true)
    expect(mocks.convexSignIn).toHaveBeenCalledWith('password', {
      email: 'migrated@example.test',
      flow: 'reset',
    })
    expect(mocks.supabaseResetPassword).not.toHaveBeenCalled()
    expect(mocks.routerPush).toHaveBeenCalledWith(expect.stringContaining('convex=1'))
  })

  it('keeps the Supabase fallback for a legacy login with no Convex credential', async () => {
    mocks.convexSignIn.mockRejectedValueOnce(new Error('No Convex credential'))
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    }))
    mocks.supabaseSignIn.mockResolvedValueOnce({
      data: {
        user: { user_metadata: {} },
      },
      error: null,
    })
    const { result } = renderHook(() => useAuth())

    let succeeded = false
    await act(async () => {
      succeeded = await result.current.login({
        email: 'legacy@example.test',
        password: 'correct-horse',
      })
    })

    expect(succeeded).toBe(true)
    expect(fetch).toHaveBeenCalledWith('/api/auth/convex-login', expect.objectContaining({ method: 'POST' }))
    expect(mocks.supabaseSignIn).toHaveBeenCalledOnce()
  })

  it('logs out Convex sessions without waiting for Supabase', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.logout()
    })

    expect(mocks.convexSignOut).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith('/api/auth/convex-logout', { method: 'POST' })
    expect(mocks.supabaseSignOut).not.toHaveBeenCalled()
  })
})
