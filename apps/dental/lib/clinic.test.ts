import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const authGetUser = vi.fn()
  const rpc = vi.fn()
  const supabaseClient = {
    auth: { getUser: authGetUser },
    rpc,
  }

  return {
    authBackend: 'dual' as 'supabase' | 'dual' | 'convex',
    authGetUser,
    createClient: vi.fn(() => supabaseClient),
    getConvexAuthContext: vi.fn(),
    getConvexAuthUserLegacyId: vi.fn(),
    getConvexSessionFromCookieStore: vi.fn(),
    rpc,
    shouldReturnConvexData: vi.fn(() => false),
  }
})

vi.mock('@/lib/auth/convex-session', () => ({
  getAuthBackend: () => mocks.authBackend,
  getConvexSessionFromCookieStore: mocks.getConvexSessionFromCookieStore,
  isConvexAuthEnabled: () => mocks.authBackend === 'dual' || mocks.authBackend === 'convex',
}))

vi.mock('@/lib/convex/server', () => ({
  convexUserHasClinicAccess: vi.fn(),
  getConvexAuthContext: mocks.getConvexAuthContext,
  getConvexAuthUserLegacyId: mocks.getConvexAuthUserLegacyId,
}))

vi.mock('@/lib/data-backend', () => ({
  shouldReturnConvexData: mocks.shouldReturnConvexData,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => {
      throw new Error('Unexpected Supabase admin query')
    }),
  },
}))

import { resolveClinicContext } from '@/lib/clinic'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const CLINIC_ID = '22222222-2222-4222-8222-222222222222'

type ClinicCookieStore = Parameters<typeof resolveClinicContext>[0]['cookieStore']
type TestCookieStore = {
  delete: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
}

function createCookieStore(clinicId?: string) {
  const store = {
    delete: vi.fn(),
    get: vi.fn((name: string) => name === 'clinicId' && clinicId ? { value: clinicId } : undefined),
    set: vi.fn(),
  }
  return store as TestCookieStore & ClinicCookieStore
}

function mockAccessibleConvexClinic() {
  mocks.getConvexAuthContext.mockResolvedValue({
    clinics: [{ id: CLINIC_ID, legacyId: CLINIC_ID }],
    defaultClinic: { id: CLINIC_ID },
  })
}

describe('resolveClinicContext auth backend selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authBackend = 'dual'
    mocks.getConvexSessionFromCookieStore.mockResolvedValue(null)
    mocks.getConvexAuthUserLegacyId.mockResolvedValue(null)
    mocks.shouldReturnConvexData.mockReturnValue(false)
    mocks.rpc.mockResolvedValue({ data: true, error: null })
  })

  it('uses a valid Convex session in dual mode without creating or calling Supabase', async () => {
    const cookieStore = createCookieStore()
    mocks.getConvexSessionFromCookieStore.mockResolvedValue({
      sub: USER_ID,
      email: 'qa@example.test',
      iat: 1,
      exp: 2,
    })
    mockAccessibleConvexClinic()

    const result = await resolveClinicContext({ requestedClinicId: CLINIC_ID, cookieStore })

    expect(result).toEqual({ clinicId: CLINIC_ID, userId: USER_ID })
    expect(mocks.getConvexSessionFromCookieStore).toHaveBeenCalledOnce()
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.authGetUser).not.toHaveBeenCalled()
  })

  it('keeps the Supabase fallback in dual mode when no valid Convex session exists', async () => {
    const cookieStore = createCookieStore()
    mocks.authGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    })

    const result = await resolveClinicContext({ requestedClinicId: CLINIC_ID, cookieStore })

    expect(result).toEqual({ clinicId: CLINIC_ID, userId: USER_ID })
    expect(mocks.getConvexSessionFromCookieStore).toHaveBeenCalledOnce()
    expect(mocks.getConvexAuthUserLegacyId).toHaveBeenCalledOnce()
    expect(mocks.createClient).toHaveBeenCalledOnce()
    expect(mocks.authGetUser).toHaveBeenCalledOnce()
    expect(mocks.rpc).toHaveBeenCalledWith('user_has_clinic_access', { clinic_id: CLINIC_ID })
  })

  it('uses a valid @convex-dev/auth identity in dual mode without Supabase', async () => {
    const cookieStore = createCookieStore()
    mocks.getConvexAuthUserLegacyId.mockResolvedValue({ legacyId: USER_ID, email: 'qa@example.test' })
    mockAccessibleConvexClinic()

    const result = await resolveClinicContext({ requestedClinicId: CLINIC_ID, cookieStore })

    expect(result).toEqual({ clinicId: CLINIC_ID, userId: USER_ID })
    expect(mocks.getConvexSessionFromCookieStore).toHaveBeenCalledOnce()
    expect(mocks.getConvexAuthUserLegacyId).toHaveBeenCalledOnce()
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.authGetUser).not.toHaveBeenCalled()
  })

  it('keeps pure Supabase mode independent from Convex session lookup', async () => {
    const cookieStore = createCookieStore()
    mocks.authBackend = 'supabase'
    mocks.authGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    })

    const result = await resolveClinicContext({ requestedClinicId: CLINIC_ID, cookieStore })

    expect(result).toEqual({ clinicId: CLINIC_ID, userId: USER_ID })
    expect(mocks.getConvexSessionFromCookieStore).not.toHaveBeenCalled()
    expect(mocks.createClient).toHaveBeenCalledOnce()
    expect(mocks.authGetUser).toHaveBeenCalledOnce()
  })

  it('returns unauthorized when neither Convex nor Supabase authenticates the request', async () => {
    const cookieStore = createCookieStore()
    mocks.authGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Invalid Supabase session'),
    })

    const result = await resolveClinicContext({ cookieStore })

    expect(result).toEqual({ error: { status: 401, message: 'Unauthorized' } })
    expect(mocks.createClient).toHaveBeenCalledOnce()
    expect(mocks.authGetUser).toHaveBeenCalledOnce()
    expect(mocks.getConvexAuthContext).not.toHaveBeenCalled()
  })

  it('does not fall back to Supabase when a valid Convex session lacks clinic access', async () => {
    const cookieStore = createCookieStore(CLINIC_ID)
    mocks.getConvexSessionFromCookieStore.mockResolvedValue({
      sub: USER_ID,
      email: 'qa@example.test',
      iat: 1,
      exp: 2,
    })
    mocks.getConvexAuthContext.mockResolvedValue({ clinics: [], defaultClinic: null })

    const result = await resolveClinicContext({ requestedClinicId: CLINIC_ID, cookieStore })

    expect(result).toEqual({ error: { status: 403, message: 'Clinic access denied' } })
    expect(cookieStore.delete).toHaveBeenCalledWith('clinicId')
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.authGetUser).not.toHaveBeenCalled()
  })

  it('keeps the legacy Convex identity fallback in pure Convex mode', async () => {
    const cookieStore = createCookieStore()
    mocks.authBackend = 'convex'
    mocks.getConvexAuthUserLegacyId.mockResolvedValue({ legacyId: USER_ID, email: 'qa@example.test' })
    mockAccessibleConvexClinic()

    const result = await resolveClinicContext({ requestedClinicId: CLINIC_ID, cookieStore })

    expect(result).toEqual({ clinicId: CLINIC_ID, userId: USER_ID })
    expect(mocks.getConvexAuthUserLegacyId).toHaveBeenCalledOnce()
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.authGetUser).not.toHaveBeenCalled()
  })
})
