import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveServerAuthUser } from './server-auth'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const cookieStore = { get: vi.fn() }

const getConvexSession = vi.fn()
const getConvexIdentity = vi.fn()
const getConvexProfile = vi.fn()
const getSupabaseUser = vi.fn()

function resolve(authBackend: 'supabase' | 'dual' | 'convex') {
  return resolveServerAuthUser({
    cookieStore,
    authBackend,
    getConvexSession,
    getConvexIdentity,
    getConvexProfile,
    getSupabaseUser,
  })
}

describe('resolveServerAuthUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getConvexSession.mockResolvedValue(null)
    getConvexIdentity.mockResolvedValue(null)
    getConvexProfile.mockResolvedValue(null)
    getSupabaseUser.mockResolvedValue({
      data: { user: null },
      error: new Error('No Supabase session'),
    })
  })

  it('uses the HMAC Convex session in dual mode without calling any fallback', async () => {
    getConvexSession.mockResolvedValue({
      sub: USER_ID,
      email: 'qa@example.test',
      userMetadata: { full_name: 'QA User' },
      iat: 1,
      exp: 2,
    })

    await expect(resolve('dual')).resolves.toEqual({
      user: {
        id: USER_ID,
        email: 'qa@example.test',
        user_metadata: { full_name: 'QA User' },
      },
      error: null,
      source: 'convex-session',
    })
    expect(getConvexIdentity).not.toHaveBeenCalled()
    expect(getSupabaseUser).not.toHaveBeenCalled()
  })

  it('uses a valid @convex-dev/auth identity in dual mode before Supabase', async () => {
    getConvexIdentity.mockResolvedValue({ legacyId: USER_ID, email: 'qa@example.test' })
    getConvexProfile.mockResolvedValue({ user_metadata: { full_name: 'QA User' } })

    await expect(resolve('dual')).resolves.toEqual({
      user: {
        id: USER_ID,
        email: 'qa@example.test',
        user_metadata: { full_name: 'QA User' },
      },
      error: null,
      source: 'convex-auth',
    })
    expect(getSupabaseUser).not.toHaveBeenCalled()
  })

  it('falls back to Supabase in dual mode only when both Convex sessions are absent', async () => {
    const supabaseUser = { id: USER_ID, email: 'legacy@example.test' }
    getSupabaseUser.mockResolvedValue({ data: { user: supabaseUser }, error: null })

    await expect(resolve('dual')).resolves.toEqual({
      user: supabaseUser,
      error: null,
      source: 'supabase',
    })
    expect(getConvexSession).toHaveBeenCalledOnce()
    expect(getConvexIdentity).toHaveBeenCalledOnce()
    expect(getSupabaseUser).toHaveBeenCalledOnce()
  })

  it('keeps pure Supabase mode independent from Convex', async () => {
    const supabaseUser = { id: USER_ID }
    getSupabaseUser.mockResolvedValue({ data: { user: supabaseUser }, error: null })

    await expect(resolve('supabase')).resolves.toMatchObject({
      user: supabaseUser,
      source: 'supabase',
    })
    expect(getConvexSession).not.toHaveBeenCalled()
    expect(getConvexIdentity).not.toHaveBeenCalled()
  })

  it('does not call Supabase when pure Convex mode has no session', async () => {
    const result = await resolve('convex')

    expect(result.user).toBeNull()
    expect(result.source).toBeNull()
    expect(result.error).toBeInstanceOf(Error)
    expect(getSupabaseUser).not.toHaveBeenCalled()
  })

  it('allows the dual Supabase fallback after a Convex resolver error', async () => {
    getConvexIdentity.mockRejectedValue(new Error('Convex unavailable'))
    getSupabaseUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    })

    await expect(resolve('dual')).resolves.toMatchObject({
      user: { id: USER_ID },
      source: 'supabase',
    })
    expect(getSupabaseUser).toHaveBeenCalledOnce()
  })
})
