/**
 * API Endpoint: Adjust Service Margin Action
 *
 * Calculates and optionally applies a new price to achieve a target margin.
 * Supports dry-run mode for calculation-only scenarios.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { aiService } from '@/lib/ai/service'
import type { ActionParams, ActionResult } from '@/lib/ai/types'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'
import { assertClinicAccess } from '@/lib/auth/verify-clinic-access'
import { forbiddenIfMissingPermissions } from '@/lib/permissions'
import { shouldUseConvexOnlyWritePath } from '@/lib/data-backend'
import {
  getConvexDocumentByLegacyId,
  patchConvexDocumentByLegacyId,
  upsertConvexDocumentByLegacyId,
} from '@/lib/convex/server'

const adjustServiceMarginSchema = z.object({
  service_id: z.string().uuid(),
  target_margin_pct: z.coerce.number().min(0),
  adjust_price: z.boolean().optional(),
  clinic_id: z.string().uuid(),
  dry_run: z.boolean().optional(),
})

type ConvexRecord = Record<string, any>

function normalizeConvexRecord(row: ConvexRecord | null | undefined): ConvexRecord | null {
  if (!row) return null
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

/**
 * Convex-only replication of aiService.execute('adjust_service_margin', ...).
 * In DATA_WRITE_MODE_SERVICES=convex (Supabase unreachable) the AIService path
 * throws on the very first supabaseAdmin.from('services') read, so we replicate
 * exactly what executeAdjustServiceMargin + AIService.validate + AIService.logAction
 * write/return against Convex, and reproduce the route's success/error response
 * mapping. Mirrors the action's math (Price = totalCost * (1 + margin/100)),
 * the services patch (price_cents, margin_pct, updated_at) and the action_logs
 * audit insert (only on non-dry-run success).
 */
async function adjustServiceMarginInConvex(args: {
  serviceId: string
  targetMarginPct: number
  adjustPrice: boolean
  clinicId: string
  userId: string
  dryRun: boolean
}): Promise<NextResponse> {
  const { serviceId, targetMarginPct, adjustPrice, clinicId, userId, dryRun } = args

  // Mirror AIService.validate('adjust_service_margin'): bounds + service existence.
  // On invalid params the route maps result.success === false to a 400 with
  // { success: false, error }, exactly as the Supabase path does.
  const validationErrors: string[] = []
  if (!serviceId) validationErrors.push('service_id is required')
  if (targetMarginPct < 0) validationErrors.push('target_margin_pct must be non-negative')
  if (targetMarginPct > 1000) validationErrors.push('target_margin_pct seems too high (max 1000%)')

  const rawService = (await getConvexDocumentByLegacyId('services', serviceId)) as ConvexRecord | null
  const service =
    rawService && String(rawService.clinic_id) === String(clinicId)
      ? normalizeConvexRecord(rawService)
      : null

  if (!service) {
    validationErrors.push(`Service ${serviceId} not found`)
  }

  if (validationErrors.length > 0) {
    const validationResult: ActionResult = {
      success: false,
      action: 'adjust_service_margin',
      params: { service_id: serviceId, target_margin_pct: targetMarginPct, adjust_price: adjustPrice },
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid parameters',
        details: validationErrors,
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
    return NextResponse.json({ success: false, error: validationResult.error }, { status: 400 })
  }

  // Mirror executeAdjustServiceMargin cost/price math against the raw Convex doc.
  // fixed_cost_cents is a derived field (never stored on the raw row) so it reads
  // undefined here exactly as it does from Supabase select('*'); total cost comes
  // from variable_cost_cents, matching the Supabase path behavior bit-for-bit.
  const fixedCostCents = service!.fixed_cost_cents || 0
  const variableCostCents = service!.variable_cost_cents || 0
  const totalCostCents = fixedCostCents + variableCostCents

  if (totalCostCents === 0) {
    const zeroCostResult: ActionResult = {
      success: false,
      action: 'adjust_service_margin',
      params: { service_id: serviceId, target_margin_pct: targetMarginPct, adjust_price: adjustPrice },
      error: {
        code: 'ZERO_COST',
        message:
          'Service has zero cost. Cannot calculate margin. Please configure service costs first.',
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
    return NextResponse.json({ success: false, error: zeroCostResult.error }, { status: 400 })
  }

  const newPriceCents = Math.round(totalCostCents * (1 + targetMarginPct / 100))
  const currentPriceCents = service!.price_cents || 0
  const currentProfitCents = currentPriceCents - totalCostCents
  const currentMarginPct =
    totalCostCents > 0 ? Math.round((currentProfitCents / totalCostCents) * 100 * 100) / 100 : 0
  const newProfitCents = newPriceCents - totalCostCents

  const changes = [
    `Service: "${service!.name}"`,
    `Total cost: $${(totalCostCents / 100).toFixed(2)} (Fixed: $${(fixedCostCents / 100).toFixed(2)}, Variable: $${(variableCostCents / 100).toFixed(2)})`,
    `Current price: $${(currentPriceCents / 100).toFixed(2)} (${currentMarginPct}% markup)`,
    `Target margin: ${targetMarginPct}%`,
    `Calculated price: $${(newPriceCents / 100).toFixed(2)}`,
    `New profit per service: $${(newProfitCents / 100).toFixed(2)}`,
    `Price change: ${(((newPriceCents - currentPriceCents) / currentPriceCents) * 100).toFixed(1)}%`,
  ]

  // Calculation-only / dry-run path: no write, matching executeAdjustServiceMargin.
  if (!adjustPrice || dryRun) {
    changes.push(
      adjustPrice
        ? 'DRY RUN - Price would be updated'
        : 'Calculation only - use adjust_price=true to update'
    )

    const result: ActionResult = {
      success: true,
      action: 'adjust_service_margin',
      params: { service_id: serviceId, target_margin_pct: targetMarginPct, adjust_price: adjustPrice },
      result: {
        before: {
          price_cents: currentPriceCents,
          margin_pct: currentMarginPct,
          profit_cents: currentProfitCents,
        },
        after: {
          price_cents: newPriceCents,
          margin_pct: targetMarginPct,
          profit_cents: newProfitCents,
        },
        changes,
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
    // dryRun (or adjust_price=false) => AIService skips logAction. No audit write here.
    return NextResponse.json({ success: true, data: result }, { status: 200 })
  }

  // Execute price update: replicate the services patch the Supabase action writes
  // (price_cents, margin_pct, updated_at) scoped to the same clinic.
  const updatedAt = new Date().toISOString()
  await patchConvexDocumentByLegacyId('services', serviceId, {
    price_cents: newPriceCents,
    margin_pct: targetMarginPct,
    updated_at: updatedAt,
  })

  changes.push('Price updated successfully')

  const result: ActionResult = {
    success: true,
    action: 'adjust_service_margin',
    params: { service_id: serviceId, target_margin_pct: targetMarginPct, adjust_price: adjustPrice },
    result: {
      before: {
        price_cents: currentPriceCents,
        margin_pct: currentMarginPct,
        profit_cents: currentProfitCents,
        name: service!.name,
      },
      after: {
        price_cents: newPriceCents,
        margin_pct: targetMarginPct,
        profit_cents: newProfitCents,
        name: service!.name,
      },
      changes,
    },
    executed_at: updatedAt,
    executed_by: userId,
  }

  // Mirror AIService.logAction (non-dry-run success only): insert the audit row.
  // Best-effort, exactly like the Supabase path which swallows log failures.
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
      error_code: result.error?.code || null,
      error_message: result.error?.message || null,
      error_details: result.error?.details || null,
      dry_run: false,
      executed_at: result.executed_at,
      created_at: updatedAt,
    })
  } catch (logError) {
    console.error('[adjust-service-margin] Convex action_logs write failed:', logError)
  }

  return NextResponse.json({ success: true, data: result }, { status: 200 })
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
    const parsed = validateSchema(adjustServiceMarginSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const { service_id, target_margin_pct, adjust_price, clinic_id, dry_run } = parsed.data
    const adjustPrice = adjust_price ?? false
    const dryRun = dry_run ?? false    // Verify user has access to the clinic (uses user_has_clinic_access RPC).
    const accessDenied = await assertClinicAccess(user.id, clinic_id, supabase)
    if (accessDenied) return accessDenied

    const forbidden = await forbiddenIfMissingPermissions(user.id, clinic_id, [
      'lara.execute_actions',
      'services.set_prices',
    ])
    if (forbidden) return forbidden

    // Convex-only write path: aiService.execute reads/writes 'services' via
    // supabaseAdmin, which throws when Supabase is unreachable. Replicate the
    // action (read service, compute price for target margin, patch services,
    // audit action_logs) directly against Convex, matching the Supabase
    // response shape/status exactly.
    if (shouldUseConvexOnlyWritePath('services')) {
      return adjustServiceMarginInConvex({
        serviceId: service_id,
        targetMarginPct: target_margin_pct,
        adjustPrice,
        clinicId: clinic_id,
        userId: user.id,
        dryRun,
      })
    }

    // 5. Build action parameters
    const params: ActionParams['adjust_service_margin'] = {
      service_id,
      target_margin_pct,
      adjust_price: adjustPrice,
    }

    // 6. Execute action via AIService
    // Use supabaseAdmin to bypass RLS since we've already verified membership
    const result = await aiService.execute('adjust_service_margin', params, {
      clinicId: clinic_id,
      userId: user.id,
      supabase: supabaseAdmin,
      dryRun,
    })

    // 7. Return result
    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          data: result,
        },
        { status: 200 }
      )
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('[API] /api/actions/adjust-service-margin error:', error)
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
