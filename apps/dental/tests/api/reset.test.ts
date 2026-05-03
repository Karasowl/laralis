import { describe, expect, it, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const routeMocks = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  adminFrom: vi.fn(),
  deleteClinicData: vi.fn(),
  cookieGet: vi.fn(),
  cookieGetAll: vi.fn(),
  cookieSet: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: routeMocks.cookieGet,
    getAll: routeMocks.cookieGetAll,
    set: routeMocks.cookieSet,
  }),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: routeMocks.authGetUser,
    },
  }),
}))

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: routeMocks.adminFrom,
    auth: {
      admin: {
        updateUserById: vi.fn(),
      },
    },
  },
}))

vi.mock('@/lib/clinic-tables', () => ({
  deleteClinicData: routeMocks.deleteClinicData,
}))

describe('POST /api/reset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeMocks.authGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          user_metadata: {},
        },
      },
      error: null,
    })
    routeMocks.cookieGet.mockReturnValue(undefined)
    routeMocks.cookieGetAll.mockReturnValue([])
  })

  it('disables initial setup reset without touching server data', async () => {
    const { POST } = await import('@/app/api/reset/route')
    const request = new NextRequest('http://localhost/api/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ resetType: 'initial_setup' }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(410)
    expect(payload.code).toBe('INITIAL_SETUP_RESET_DISABLED')
    expect(routeMocks.adminFrom).not.toHaveBeenCalled()
    expect(routeMocks.deleteClinicData).not.toHaveBeenCalled()
    expect(routeMocks.cookieSet).not.toHaveBeenCalled()
  })
})
