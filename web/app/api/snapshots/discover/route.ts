/**
 * Snapshot Discovery API
 *
 * GET /api/snapshots/discover - Show all discovered tables
 *
 * This endpoint is for transparency and debugging.
 * It shows exactly which tables will be included in a snapshot.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { TableDiscoveryService, DiscoverTablesResponse } from '@/lib/snapshots'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/snapshots/discover
 * Show all tables that would be included in a snapshot
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const clinicContext = await resolveClinicContext({
      requestedClinicId: request.nextUrl.searchParams.get('clinicId'),
      cookieStore,
    })

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error },
        { status: 401 }
      )
    }

    const { clinicId } = clinicContext

    // Discover tables
    const discovery = new TableDiscoveryService(supabaseAdmin)
    const result = await discovery.discoverClinicTables()

    // Optionally get record counts for each table
    const includeCounts = request.nextUrl.searchParams.get('counts') === 'true'

    let tablesWithCounts = result.tables

    if (includeCounts) {
      tablesWithCounts = await Promise.all(
        result.tables.map(async (table) => {
          try {
            let query = supabaseAdmin
              .from(table.name as 'treatments')
              .select('*', { count: 'exact', head: true })

            if (table.category === 'direct') {
              query = query.eq('clinic_id', clinicId)
            } else if (table.category === 'hybrid') {
              query = query.or(`clinic_id.eq.${clinicId},clinic_id.is.null`)
            }
            // For indirect tables, we'd need to join - skip count for now

            const { count } = await query

            return {
              ...table,
              recordCount: count || 0,
            }
          } catch {
            return {
              ...table,
              recordCount: -1, // Error getting count
            }
          }
        })
      )
    }

    const response: DiscoverTablesResponse & { recordCounts?: Record<string, number> } = {
      tables: tablesWithCounts,
      foreignKeyOrder: result.foreignKeyOrder,
      discoveredAt: result.discoveredAt,
      method: 'dynamic',
    }

    // Add summary
    const summary = {
      totalTables: result.tables.length,
      directTables: result.tables.filter((t) => t.category === 'direct').length,
      indirectTables: result.tables.filter((t) => t.category === 'indirect').length,
      hybridTables: result.tables.filter((t) => t.category === 'hybrid').length,
    }

    return NextResponse.json({
      ...response,
      summary,
    })
  } catch (error) {
    console.error('Error in GET /api/snapshots/discover:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Discovery failed',
      },
      { status: 500 }
    )
  }
}
