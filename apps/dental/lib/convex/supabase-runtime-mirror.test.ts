import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseClient: vi.fn(),
  deleteConvexDocumentByLegacyId: vi.fn(),
  getLegacyIdForTable: vi.fn(),
  replaceConvexTableSnapshot: vi.fn(),
  shouldWriteConvexData: vi.fn(),
  upsertConvexDocumentByLegacyId: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createSupabaseClient,
}))

vi.mock('@/lib/data-backend', () => ({
  shouldWriteConvexData: mocks.shouldWriteConvexData,
}))

vi.mock('./server', () => ({
  deleteConvexDocumentByLegacyId: mocks.deleteConvexDocumentByLegacyId,
  getLegacyIdForTable: mocks.getLegacyIdForTable,
  replaceConvexTableSnapshot: mocks.replaceConvexTableSnapshot,
  upsertConvexDocumentByLegacyId: mocks.upsertConvexDocumentByLegacyId,
}))

import { createMirroredSupabaseClient } from './supabase-runtime-mirror'

type SupabaseResult = { data: unknown; error: { message: string } | null }

class FakeWriteBuilder {
  private result: SupabaseResult = { data: null, error: null }

  constructor(
    private table: string,
    private writeResults: Record<string, SupabaseResult>
  ) {}

  insert(payload: unknown) {
    this.result = this.writeResults.insert ?? { data: payload, error: null }
    return this
  }

  upsert(payload: unknown) {
    this.result = this.writeResults.upsert ?? { data: payload, error: null }
    return this
  }

  update(payload: unknown) {
    this.result = this.writeResults.update ?? { data: payload, error: null }
    return this
  }

  delete() {
    this.result = this.writeResults.delete ?? { data: null, error: null }
    return this
  }

  select() {
    return this
  }

  single() {
    return this
  }

  eq() {
    return this
  }

  then<TResult1 = SupabaseResult, TResult2 = never>(
    onFulfilled?: ((value: SupabaseResult) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.result).then(onFulfilled, onRejected)
  }
}

class FakeSnapshotBuilder {
  private result: SupabaseResult = { data: null, error: null }

  constructor(private rows: Array<Record<string, unknown>>) {}

  select() {
    return this
  }

  range(from: number, to: number) {
    this.result = { data: this.rows.slice(from, to + 1), error: null }
    return this
  }

  then<TResult1 = SupabaseResult, TResult2 = never>(
    onFulfilled?: ((value: SupabaseResult) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.result).then(onFulfilled, onRejected)
  }
}

function makeWriteClient(writeResults: Record<string, SupabaseResult>) {
  return {
    marker: 'bound-client',
    getMarker() {
      return this.marker
    },
    from: vi.fn((table: string) => new FakeWriteBuilder(table, writeResults)),
    rpc: vi.fn((name: string) => new FakeWriteBuilder(name, { rpc: { data: [], error: null } })),
    auth: {
      setSession: vi.fn(async () => ({
        data: { session: { user: { id: 'user-session-1', email: 'session@test.dev' } } },
        error: null,
      })),
      updateUser: vi.fn(async () => ({ data: { user: { id: 'user-1', email: 'a@test.dev' } }, error: null })),
      admin: {
        deleteUser: vi.fn(async (userId: string) => ({ data: { user: null, userId }, error: null })),
      },
    },
  } as any
}

function makeSnapshotClient(rowsByTable: Record<string, Array<Record<string, unknown>>>) {
  return {
    from: vi.fn((table: string) => new FakeSnapshotBuilder(rowsByTable[table] ?? [])),
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test'
  process.env.NEXT_PUBLIC_CONVEX_URL = 'https://convex.test'
  process.env.CONVEX_AUTH_BRIDGE_SECRET = 'secret'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
  delete process.env.CONVEX_RUNTIME_MIRROR_ENABLED
  delete process.env.CONVEX_RUNTIME_MIRROR_STRICT
  mocks.shouldWriteConvexData.mockReturnValue(true)
  mocks.getLegacyIdForTable.mockImplementation(
    (table: string, row: Record<string, unknown> | null, explicitLegacyId?: string | number | null) => {
      if (explicitLegacyId !== undefined && explicitLegacyId !== null) return String(explicitLegacyId)
      const id = row?.legacyId ?? row?.id
      if (id !== undefined && id !== null) return String(id)
      if (table === 'user_settings' && row?.user_id && row?.key) {
        return `user_settings:${row.user_id}:${row.key}`
      }
      return null
    }
  )
  mocks.upsertConvexDocumentByLegacyId.mockResolvedValue({})
  mocks.deleteConvexDocumentByLegacyId.mockResolvedValue({})
  mocks.replaceConvexTableSnapshot.mockResolvedValue({})
})

describe('createMirroredSupabaseClient', () => {
  it('upserts returned write rows into Convex by legacy id', async () => {
    const client = createMirroredSupabaseClient(
      makeWriteClient({
        insert: { data: { id: 'patient-1', first_name: 'Ana' }, error: null },
      })
    )

    const result = await client
      .from('patients')
      .insert({ id: 'patient-1', first_name: 'Ana' })
      .select()
      .single()

    expect(result.error).toBeNull()
    expect(mocks.upsertConvexDocumentByLegacyId).toHaveBeenCalledWith(
      'patients',
      'patient-1',
      { id: 'patient-1', first_name: 'Ana' }
    )
  })

  it('deletes returned rows from Convex by legacy id', async () => {
    const client = createMirroredSupabaseClient(
      makeWriteClient({
        delete: { data: { id: 'expense-1' }, error: null },
      })
    )

    await client.from('expenses').delete().eq('id', 'expense-1').select().single()

    expect(mocks.deleteConvexDocumentByLegacyId).toHaveBeenCalledWith('expenses', 'expense-1')
  })

  it('upserts rows without id using a table-specific legacy id', async () => {
    const client = createMirroredSupabaseClient(
      makeWriteClient({
        upsert: { data: { user_id: 'user-1', key: 'locale', value: 'es' }, error: null },
      })
    )

    await client.from('user_settings').upsert({ user_id: 'user-1', key: 'locale', value: 'es' }).select().single()

    expect(mocks.upsertConvexDocumentByLegacyId).toHaveBeenCalledWith(
      'user_settings',
      'user_settings:user-1:locale',
      { user_id: 'user-1', key: 'locale', value: 'es' }
    )
  })

  it('uses a service-role snapshot client for full-table fallback', async () => {
    mocks.createSupabaseClient.mockReturnValueOnce(
      makeSnapshotClient({
        patients: [{ id: 'patient-2', first_name: 'Luis' }],
      })
    )
    const client = createMirroredSupabaseClient(
      makeWriteClient({
        update: { data: null, error: null },
      })
    )

    await client.from('patients').update({ first_name: 'Luis' }).eq('id', 'patient-2')

    expect(mocks.createSupabaseClient).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      'service-role',
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: false }),
      })
    )
    expect(mocks.replaceConvexTableSnapshot).toHaveBeenCalledWith(
      'patients',
      [{ id: 'patient-2', first_name: 'Luis' }],
      'runtime-mirror:update'
    )
  })

  it('does not break the Supabase write when Convex mirror fails in non-strict mode', async () => {
    mocks.upsertConvexDocumentByLegacyId.mockRejectedValueOnce(new Error('convex down'))
    const client = createMirroredSupabaseClient(
      makeWriteClient({
        insert: { data: { id: 'supply-1', name: 'Resina' }, error: null },
      })
    )

    await expect(client.from('supplies').insert({ id: 'supply-1', name: 'Resina' })).resolves.toEqual({
      data: { id: 'supply-1', name: 'Resina' },
      error: null,
    })
  })

  it('mirrors server-side auth updates into supabase_auth_users', async () => {
    const client = createMirroredSupabaseClient(makeWriteClient({}))

    await client.auth.updateUser({ data: { preferred_language: 'es' } })

    expect(mocks.upsertConvexDocumentByLegacyId).toHaveBeenCalledWith(
      'supabase_auth_users',
      'user-1',
      { id: 'user-1', email: 'a@test.dev' }
    )
  })

  it('mirrors server-side auth session results into supabase_auth_users', async () => {
    const client = createMirroredSupabaseClient(makeWriteClient({}))

    await client.auth.setSession({ access_token: 'access', refresh_token: 'refresh' })

    expect(mocks.upsertConvexDocumentByLegacyId).toHaveBeenCalledWith(
      'supabase_auth_users',
      'user-session-1',
      { id: 'user-session-1', email: 'session@test.dev' }
    )
  })

  it('binds non-mirrored Supabase client methods to the original target', () => {
    const client = createMirroredSupabaseClient(makeWriteClient({}))

    expect(client.getMarker()).toBe('bound-client')
  })

  it('does not wrap an already mirrored client twice', async () => {
    const client = createMirroredSupabaseClient(
      makeWriteClient({
        insert: { data: { id: 'patient-3', first_name: 'Mia' }, error: null },
      })
    )

    const wrappedAgain = createMirroredSupabaseClient(client)

    expect(wrappedAgain).toBe(client)

    await wrappedAgain
      .from('patients')
      .insert({ id: 'patient-3', first_name: 'Mia' })
      .select()
      .single()

    expect(mocks.upsertConvexDocumentByLegacyId).toHaveBeenCalledTimes(1)
  })
})
