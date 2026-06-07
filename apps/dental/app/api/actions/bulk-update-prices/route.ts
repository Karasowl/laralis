/**
 * API Endpoint: Bulk Update Prices Action
 *
 * Allows Lara (or user) to update multiple service prices at once.
 * Supports percentage or fixed amount changes.
 * Supports dry-run mode for preview.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { aiService } from '@/lib/ai/service'
import type { ActionParams } from '@/lib/ai/types'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'
import { assertClinicAccess } from '@/lib/auth/verify-clinic-access'
import { forbiddenIfMissingPermissions } from '@/lib/permissions'
import { shouldUseConvexOnlyWritePath } from '@/lib/data-backend'
import {
  listConvexDocumentsByClinic,
  patchConvexDocumentByLegacyId,
  upsertConvexDocumentByLegacyId,
} from '@/lib/convex/server'

const bulkUpdatePricesSchema = z.object({
  change_type: z.enum(['percentage', 'fixed']),
  change_value: z.coerce.number(),
  service_ids: z.array(z.string().uuid()).optional(),
  category: z.string().min(1).optional(),
  clinic_id: z.string().uuid(),
  dry_run: z.boolean().optional(),
})

type ConvexServiceRow = Record<string, any>

// Helper mirrored from lib/ai/actions/operational-actions.ts (executeBulkUpdatePrices)
function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Convex-only replica of aiService.execute('bulk_update_prices', ...).
 *
 * In CONVEX-ONLY write mode Supabase is unreachable, so supabaseAdmin.from() and the
 * createClient() shim throw on the first read. executeBulkUpdatePrices (and the runtime
 * mirror that wraps it) therefore cannot run. This reproduces EXACTLY the same row writes
 * the Supabase action performs — patch services.price_cents + updated_at — directly against
 * Convex, returning the identical ActionResult shape the route wraps in { success, data }.
 */
async function bulkUpdatePricesInConvex(
  params: ActionParams['bulk_update_prices'],
  context: { clinicId: string; userId: string; dryRun: boolean }
): Promise<{ success: boolean; data?: any; error?: any }> {
  const { clinicId, userId, dryRun } = context
  const { change_type, change_value, service_ids, category } = params

  // Read services from Convex (replaces supabase.from('services').select(...).eq('clinic_id')).
  const allServices = (await listConvexDocumentsByClinic('services', clinicId, 5000)) as ConvexServiceRow[]
  const serviceIdSet =
    service_ids && service_ids.length > 0 ? new Set(service_ids.map((id) => String(id))) : null

  const services = allServices.filter((row) => {
    const id = String(row.id ?? row.legacyId ?? '')
    if (serviceIdSet && !serviceIdSet.has(id)) return false
    if (category && row.category !== category) return false
    return true
  })

  if (services.length === 0) {
    return {
      success: false,
      data: {
        success: false,
        action: 'bulk_update_prices',
        params,
        error: { code: 'NO_SERVICES', message: 'No services found matching criteria' },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      },
      error: { code: 'NO_SERVICES', message: 'No services found matching criteria' },
    }
  }

  // Calculate new prices (identical math to executeBulkUpdatePrices).
  const updates = services.map((s) => {
    const oldPrice = Number(s.price_cents) || 0
    let newPrice: number
    if (change_type === 'percentage') {
      newPrice = Math.round(oldPrice * (1 + change_value / 100))
    } else {
      newPrice = oldPrice + change_value
    }
    return {
      id: String(s.id ?? s.legacyId ?? ''),
      legacyId: String(s.legacyId ?? s.id ?? ''),
      name: s.name,
      old_price_cents: oldPrice,
      new_price_cents: Math.max(0, newPrice), // Don't allow negative prices
      change_cents: newPrice - oldPrice,
    }
  })

  const totalOld = updates.reduce((sum, u) => sum + u.old_price_cents, 0)
  const totalNew = updates.reduce((sum, u) => sum + u.new_price_cents, 0)

  const changes = [
    `💰 Bulk Price Update (${change_type === 'percentage' ? `${change_value}%` : formatCurrency(change_value)})`,
    `Services affected: ${updates.length}`,
    '',
  ]

  updates.forEach((u) => {
    const arrow = u.change_cents > 0 ? '↑' : u.change_cents < 0 ? '↓' : '→'
    changes.push(`${u.name}: ${formatCurrency(u.old_price_cents)} ${arrow} ${formatCurrency(u.new_price_cents)}`)
  })

  changes.push('', `**Total impact:** ${formatCurrency(totalOld)} → ${formatCurrency(totalNew)}`)

  // Strip internal legacyId helper before returning updates (Supabase result has no legacyId).
  const publicUpdates = updates.map(({ legacyId: _legacyId, ...rest }) => rest)

  if (dryRun) {
    changes.push('', '⚠️ DRY RUN - No changes made')
    return {
      success: true,
      data: {
        success: true,
        action: 'bulk_update_prices',
        params,
        result: { changes, updates: publicUpdates, dry_run: true },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      },
    }
  }

  // Execute updates — patch services.price_cents + updated_at, matching the Supabase
  // .update({ price_cents, updated_at }).eq('id', u.id) loop.
  for (const u of updates) {
    await patchConvexDocumentByLegacyId('services', u.legacyId, {
      price_cents: u.new_price_cents,
      updated_at: new Date().toISOString(),
    })
  }

  changes.push('', '✅ Prices updated successfully')

  const executedAt = new Date().toISOString()
  const result = {
    success: true,
    action: 'bulk_update_prices' as const,
    params,
    result: { changes, updates: publicUpdates, services_updated: updates.length },
    executed_at: executedAt,
    executed_by: userId,
  }

  // Reproduce aiService.logAction (insert into action_logs) for the convex-only path.
  // Best-effort: a logging failure must never break the action (matches the Supabase path,
  // which swallows action_logs insert errors).
  try {
    const logId = crypto.randomUUID()
    await upsertConvexDocumentByLegacyId('action_logs', logId, {
      id: logId,
      clinic_id: clinicId,
      user_id: userId,
      action_type: result.action,
      success: result.success,
      params: result.params,
      result: result.result || null,
      error_code: null,
      error_message: null,
      error_details: null,
      dry_run: false,
      executed_at: executedAt,
    })
  } catch (logError) {
    console.error('[bulk-update-prices] Convex action_logs insert failed:', logError)
  }

  return { success: true, data: result }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse and validate request body
    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const parsed = validateSchema(bulkUpdatePricesSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const { change_type, change_value, service_ids, category, clinic_id, dry_run } = parsed.data
    const dryRun = dry_run ?? false    // Verify user has access to the clinic (uses user_has_clinic_access RPC).
    const accessDenied = await assertClinicAccess(user.id, clinic_id, supabase)
    if (accessDenied) return accessDenied

    const forbidden = await forbiddenIfMissingPermissions(user.id, clinic_id, [
      'lara.execute_actions',
      'services.set_prices',
    ])
    if (forbidden) return forbidden

    // 5. Build action parameters
    const params: ActionParams['bulk_update_prices'] = {
      change_type,
      change_value,
      service_ids,
      category,
    }

    // 6. Execute action.
    // In CONVEX-ONLY write mode Supabase is unreachable, so aiService.execute() (which reads
    // and patches services through supabaseAdmin) would throw on the first query. Replicate
    // the exact same service price patches directly against Convex instead.
    if (shouldUseConvexOnlyWritePath('services')) {
      const convexResult = await bulkUpdatePricesInConvex(params, {
        clinicId: clinic_id,
        userId: user.id,
        dryRun,
      })

      if (convexResult.success) {
        return NextResponse.json({ success: true, data: convexResult.data }, { status: 200 })
      }
      return NextResponse.json({ success: false, error: convexResult.error }, { status: 400 })
    }

    // 6b. Execute action via AIService (Supabase / dual write paths).
    const result = await aiService.execute('bulk_update_prices', params, {
      clinicId: clinic_id,
      userId: user.id,
      supabase: supabaseAdmin,
      dryRun,
    })

    // 7. Return result
    if (result.success) {
      return NextResponse.json({ success: true, data: result }, { status: 200 })
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
  } catch (error: any) {
    console.error('[API] /api/actions/bulk-update-prices error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Internal server error',
        },
      },
      { status: 500 }
    )
  }
}
