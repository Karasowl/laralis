import { NextRequest, NextResponse } from 'next/server'
import {
  getConvexAuthCredentialStats,
  checkConvexMutationSecret,
  getConvexTableCounts,
  getConvexUrlHostForDiagnostics,
} from '@/lib/convex/server'
import { getDataReadBackend, getDataWriteMode } from '@/lib/data-backend'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const DEFAULT_TABLES = [
  'workspaces',
  'clinics',
  'workspace_users',
  'workspace_members',
  'clinic_users',
  'patients',
  'treatments',
  'services',
  'service_supplies',
  'supplies',
  'expenses',
  'fixed_costs',
  'assets',
  'settings_time',
  'marketing_campaigns',
  'clinic_google_calendar',
  'clinic_snapshots',
  'role_permissions',
  'supabase_auth_users',
]

export async function GET(request: NextRequest) {
  const authError = authorizeMigrationCheck(request)
  if (authError) return authError

  const requestedTables = request.nextUrl.searchParams.get('tables')
  const includeMutationCheck = request.nextUrl.searchParams.get('mutationCheck') === '1'
  const includeAuthCheck = request.nextUrl.searchParams.get('authCheck') === '1'
  const tables = requestedTables
    ? requestedTables
        .split(',')
        .map((table) => table.trim())
        .filter(Boolean)
    : DEFAULT_TABLES

  const [supabaseCounts, convexCounts] = await Promise.all([
    getSupabaseCounts(tables.filter((table) => table !== 'supabase_auth_users')),
    getConvexTableCounts(tables),
  ])

  const results = tables.map((table) => {
    const supabaseCount = table === 'supabase_auth_users' ? null : supabaseCounts[table] ?? null
    const convexCount = convexCounts[table] ?? null

    return {
      table,
      supabase: supabaseCount,
      convex: convexCount,
      match: table === 'supabase_auth_users' ? convexCount !== null : supabaseCount === convexCount,
    }
  })

  const mutationCheck = includeMutationCheck ? await checkMutationSecret() : null
  const authCheck = includeAuthCheck ? await checkAuthReadiness() : null

  return NextResponse.json({
    ok: results.every((result) => result.match) && (!mutationCheck || mutationCheck.ok) && (!authCheck || authCheck.ok),
    generatedAt: new Date().toISOString(),
    convexHost: getConvexUrlHostForDiagnostics(),
    dataReadBackend: getDataReadBackend(),
    dataWriteMode: getDataWriteMode(),
    storageWriteMode: getDataWriteMode('storage'),
    mutationCheck,
    authCheck,
    tables: results,
  })
}

async function checkMutationSecret() {
  try {
    const result = await checkConvexMutationSecret()
    return { ok: true, result }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function checkAuthReadiness() {
  try {
    const stats = await getConvexAuthCredentialStats()
    return {
      ok: true,
      authBackend: process.env.AUTH_BACKEND ?? null,
      publicAuthBackend: process.env.NEXT_PUBLIC_AUTH_BACKEND ?? null,
      bridgeEnabled: process.env.NEXT_PUBLIC_CONVEX_AUTH_BRIDGE === '1',
      sessionSecretConfigured: Boolean(process.env.CONVEX_AUTH_SESSION_SECRET),
      stats,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function authorizeMigrationCheck(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is required' }, { status: 503 })
  }

  const authorization = request.headers.get('authorization')
  const headerSecret = request.headers.get('x-migration-secret')
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null

  if (bearer === secret || headerSecret === secret) {
    return null
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

async function getSupabaseCounts(tables: string[]) {
  const entries: Array<[string, number | null]> = []

  for (const table of tables) {
    const { count, error } = await supabaseAdmin.from(table).select('*', {
      count: 'exact',
      head: true,
    })

    if (error) {
      entries.push([table, null])
      continue
    }

    entries.push([table, count ?? 0])
  }

  return Object.fromEntries(entries)
}
