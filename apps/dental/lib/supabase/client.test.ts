import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createBrowserClient: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: mocks.createBrowserClient,
}))

import { createClient } from './client'

const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'qa@example.test' }

describe('browser auth resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.example.test')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('NEXT_PUBLIC_AUTH_BACKEND', 'dual')
    mocks.createBrowserClient.mockReturnValue({
      auth: {
        getUser: mocks.getUser,
        getSession: mocks.getSession,
      },
    })
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns the server-resolved Convex user in dual mode without browser Supabase auth', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ user: USER }), { status: 200 }))

    await expect(createClient().auth.getUser()).resolves.toEqual({
      data: { user: USER },
      error: null,
    })
    expect(mocks.getUser).not.toHaveBeenCalled()
  })

  it('returns a compatible session without browser Supabase auth when Convex is valid', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ user: USER }), { status: 200 }))

    const result = await createClient().auth.getSession()

    expect(result.data.session?.user).toEqual(USER)
    expect(mocks.getSession).not.toHaveBeenCalled()
  })

  it('uses the browser Supabase fallback in dual mode when the server has no Convex identity', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }))
    mocks.getUser.mockResolvedValue({ data: { user: USER }, error: null })

    await expect(createClient().auth.getUser()).resolves.toEqual({
      data: { user: USER },
      error: null,
    })
    expect(mocks.getUser).toHaveBeenCalledOnce()
  })

  it('keeps pure Supabase mode free of the Convex server probe', async () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_BACKEND', 'supabase')
    mocks.getUser.mockResolvedValue({ data: { user: USER }, error: null })

    await expect(createClient().auth.getUser()).resolves.toEqual({
      data: { user: USER },
      error: null,
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(mocks.getUser).toHaveBeenCalledOnce()
  })
})
