import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  deleteConvexDocumentByLegacyId,
  getLegacyIdForTable,
  replaceConvexTableSnapshot,
  upsertConvexDocumentByLegacyId,
} from './server'
import { shouldWriteConvexData } from '@/lib/data-backend'

type WriteOperation = 'insert' | 'update' | 'upsert' | 'delete' | 'rpc'

type MirrorState = {
  table: string
  operation?: WriteOperation
  payload?: unknown
  rpcName?: string
  mirrored?: boolean
}

const WRITE_METHODS = new Set(['insert', 'update', 'upsert', 'delete'])
const AUTH_USER_UPSERT_METHODS = new Set([
  'exchangeCodeForSession',
  'setSession',
  'signInWithOtp',
  'signInWithPassword',
  'signUp',
  'updateUser',
  'verifyOtp',
])
const PAGE_SIZE = 1000
const MIRRORED_RPC_REFRESH_TABLES: Record<string, string[]> = {
  process_recurring_expenses: ['expenses'],
}
let snapshotClient: SupabaseClient | null | undefined
const MIRRORED_CLIENT_MARKER = Symbol.for('laralis.convex.mirroredSupabaseClient')

export const MIRRORED_TABLES = new Set([
  'supabase_auth_users',
  'workspaces',
  'clinics',
  'workspace_users',
  'workspace_members',
  'clinic_users',
  'invitations',
  'user_settings',
  'verification_codes',
  'category_types',
  'categories',
  'custom_categories',
  'patient_sources',
  'settings_time',
  'clinic_google_calendar',
  'fixed_costs',
  'assets',
  'supplies',
  'services',
  'service_supplies',
  'tariffs',
  'marketing_campaigns',
  'marketing_campaign_status_history',
  'patients',
  'treatments',
  'expenses',
  'ai_chat_sessions',
  'ai_chat_messages',
  'chat_sessions',
  'chat_messages',
  'ai_feedback',
  'workspace_activity',
  'public_bookings',
  'public_booking_services',
  'booking_blocked_slots',
  'medications',
  'prescriptions',
  'prescription_items',
  'quotes',
  'quote_items',
  'email_notifications',
  'scheduled_reminders',
  'sms_notifications',
  'push_subscriptions',
  'push_notifications',
  'clinic_snapshots',
  'custom_role_templates',
  'role_permissions',
  'leads',
  'marketing_campaign_channels',
  'inbox_conversations',
  'inbox_messages',
  'notification_retry_queue',
  'whatsapp_notifications',
  'whatsapp_templates',
  'action_logs',
  'organizations',
])

export function createMirroredSupabaseClient<T extends SupabaseClient>(client: T): T {
  if ((client as any)?.[MIRRORED_CLIENT_MARKER]) {
    return client
  }

  const mirroredClient = new Proxy(client as any, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => wrapQueryBuilder(target.from(table), { table })
      }

      if (prop === 'rpc') {
        return (fn: string, args?: Record<string, unknown>, options?: Record<string, unknown>) =>
          wrapQueryBuilder(target.rpc(fn, args, options), {
            table: '',
            operation: 'rpc',
            rpcName: fn,
            payload: args,
          })
      }

      if (prop === 'auth') {
        return wrapAuthClient(Reflect.get(target, prop, receiver))
      }

      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as T

  Object.defineProperty(mirroredClient, MIRRORED_CLIENT_MARKER, {
    value: true,
  })

  return mirroredClient
}

function wrapAuthClient(auth: any): any {
  if (!auth || typeof auth !== 'object') return auth

  return new Proxy(auth, {
    get(target, prop, receiver) {
      if (prop === 'admin') {
        return wrapAuthAdmin(Reflect.get(target, prop, receiver))
      }

      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') return value
      if (!AUTH_USER_UPSERT_METHODS.has(String(prop))) return value.bind(target)

      return async (...args: unknown[]) => {
        const result = await value.apply(target, args)
        await mirrorAuthUserResult(result)
        return result
      }
    },
  })
}

function wrapAuthAdmin(admin: any): any {
  if (!admin || typeof admin !== 'object') return admin

  return new Proxy(admin, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') return value

      if (prop === 'deleteUser') {
        return async (userId: string, ...args: unknown[]) => {
          const result = await value.apply(target, [userId, ...args])
          if (!result?.error) await mirrorAuthUserDelete(userId)
          return result
        }
      }

      if (prop === 'createUser' || prop === 'updateUserById' || prop === 'inviteUserByEmail') {
        return async (...args: unknown[]) => {
          const result = await value.apply(target, args)
          await mirrorAuthUserResult(result)
          return result
        }
      }

      return value.bind(target)
    },
  })
}

function wrapQueryBuilder(builder: any, state: MirrorState): any {
  if (!builder || typeof builder !== 'object') return builder

  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === 'then') {
        const then = Reflect.get(target, prop, target)
        if (typeof then !== 'function') return undefined

        return (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
          return then.call(
            target,
            async (result: unknown) => {
              await mirrorCompletedWrite(state, result)
              return onFulfilled ? onFulfilled(result) : result
            },
            onRejected
          )
        }
      }

      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') return value

      return (...args: unknown[]) => {
        const propName = String(prop)
        const nextState = WRITE_METHODS.has(propName)
          ? {
              table: state.table,
              operation: propName as WriteOperation,
              payload: args[0],
            }
          : state
        const nextBuilder = value.apply(target, args)
        return wrapQueryBuilder(nextBuilder, nextState)
      }
    },
  })
}

async function mirrorCompletedWrite(state: MirrorState, result: unknown) {
  if (!state.operation || state.mirrored) return
  state.mirrored = true

  const supabaseResult = result as { data?: unknown; error?: { message?: string } | null }
  if (supabaseResult?.error) return

  try {
    if (state.operation === 'rpc') {
      await mirrorCompletedRpc(state)
      return
    }

    if (!shouldRuntimeMirrorTable(state.table)) return

    const rows = normalizeRows(supabaseResult?.data)
    const payloadRows = normalizeRows(state.payload)

    if (state.operation === 'delete') {
      const deletableRows = rows
        .map((row) => getLegacyIdForTable(state.table, row))
        .filter((legacyId): legacyId is string => Boolean(legacyId))

      if (rows.length > 0 && deletableRows.length === rows.length) {
        await Promise.all(deletableRows.map((legacyId) => deleteConvexDocumentByLegacyId(state.table, legacyId)))
        return
      }

      await replaceTableFromSupabase(state.table, `runtime-mirror:${state.operation}`)
      return
    }

    const mirrorRows = rows.length > 0 ? rows : payloadRows
    const upsertableRows = mirrorRows
      .map((row) => ({ row, legacyId: getLegacyIdForTable(state.table, row) }))
      .filter((entry): entry is { row: Record<string, unknown>; legacyId: string } => Boolean(entry.legacyId))

    if (mirrorRows.length > 0 && upsertableRows.length === mirrorRows.length) {
      await Promise.all(
        upsertableRows.map(({ row, legacyId }) => upsertConvexDocumentByLegacyId(state.table, legacyId, row))
      )
      return
    }

    await replaceTableFromSupabase(state.table, `runtime-mirror:${state.operation}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[convex runtime mirror] ${state.operation} ${state.table} failed:`, message)

    if (process.env.CONVEX_RUNTIME_MIRROR_STRICT === '1') {
      throw error
    }
  }
}

async function mirrorCompletedRpc(state: MirrorState) {
  if (!state.rpcName) return

  const tables = MIRRORED_RPC_REFRESH_TABLES[state.rpcName] ?? []
  for (const table of tables) {
    if (!shouldRuntimeMirrorTable(table)) continue
    await replaceTableFromSupabase(table, `runtime-mirror:rpc:${state.rpcName}`)
  }
}

function shouldRuntimeMirrorTable(table: string) {
  if (process.env.CONVEX_RUNTIME_MIRROR_ENABLED === '0') return false
  if (!MIRRORED_TABLES.has(table)) return false
  if (!process.env.NEXT_PUBLIC_CONVEX_URL || !process.env.CONVEX_AUTH_BRIDGE_SECRET) return false
  return shouldWriteConvexData(table)
}

async function mirrorAuthUserResult(result: any) {
  if (!shouldRuntimeMirrorTable('supabase_auth_users')) return
  if (result?.error) return

  const user = result?.data?.user ?? result?.data?.session?.user ?? result?.user ?? result?.session?.user
  if (!user?.id) return

  try {
    await upsertConvexDocumentByLegacyId(
      'supabase_auth_users',
      String(user.id),
      JSON.parse(JSON.stringify(user)) as Record<string, unknown>
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[convex runtime mirror] auth user upsert failed:', message)

    if (process.env.CONVEX_RUNTIME_MIRROR_STRICT === '1') {
      throw error
    }
  }
}

async function mirrorAuthUserDelete(userId: string) {
  if (!shouldRuntimeMirrorTable('supabase_auth_users')) return

  try {
    await deleteConvexDocumentByLegacyId('supabase_auth_users', userId)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[convex runtime mirror] auth user delete failed:', message)

    if (process.env.CONVEX_RUNTIME_MIRROR_STRICT === '1') {
      throw error
    }
  }
}

function normalizeRows(value: unknown): Array<Record<string, unknown>> {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(isRecord)
  return isRecord(value) ? [value] : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

async function replaceTableFromSupabase(table: string, source: string) {
  const readClient = getSnapshotReadClient()
  if (!readClient) {
    throw new Error(`SUPABASE_SERVICE_ROLE_KEY is required for full-table Convex mirror fallback on ${table}`)
  }

  const rows: Array<Record<string, unknown>> = []
  let offset = 0

  while (true) {
    const { data, error } = await readClient
      .from(table)
      .select('*')
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      throw new Error(`Supabase snapshot read failed for ${table}: ${error.message}`)
    }

    const page = (data ?? []) as Array<Record<string, unknown>>
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  await replaceConvexTableSnapshot(table, rows, source)
}

function getSnapshotReadClient() {
  if (snapshotClient !== undefined) return snapshotClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    snapshotClient = null
    return snapshotClient
  }

  snapshotClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  return snapshotClient
}
