/**
 * API Endpoint: Update Service Price Action
 *
 * Allows Lara (or user) to update a service's price through the Actions System.
 * Supports dry-run mode for simulation.
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
import { getConvexDocumentByLegacyId, patchConvexDocumentByLegacyId, upsertConvexDocumentByLegacyId } from '@/lib/convex/server'
import { shouldUseConvexOnlyWritePath } from '@/lib/data-backend'
import { snapshotCache } from '@/lib/ai/cache/snapshot-cache'

const updateServicePriceSchema = z.object({
  service_id: z.string().uuid(),
  new_price_cents: z.coerce.number().int().positive(),
  reason: z.string().optional(),
  clinic_id: z.string().uuid(),
  dry_run: z.boolean().optional(),
})

/**
 * Convex-only port of aiService.execute('update_service_price', ...).
 *
 * On the Convex-only write path (DATA_WRITE_MODE=convex) Supabase is unreachable,
 * so supabaseAdmin.from()/.rpc() throw before any write. The real handler delegates
 * the DB mutation to aiService.execute -> executeUpdateServicePrice (patches
 * services.price_cents/updated_at) plus AIService.logAction (inserts action_logs),
 * all through supabaseAdmin. We replicate those exact row writes against Convex here:
 *   1. validate the service exists in the clinic (services read),
 *   2. dry-run: return the preview ActionResult WITHOUT logging (mirrors execute()'s
 *      `if (!dryRun && result.success)` log gate),
 *   3. real run: patch services { price_cents, updated_at }, then insert an action_logs
 *      row matching AIService.logAction's logEntry (Postgres defaults id/dry_run/
 *      created_at set explicitly since Convex has no defaults).
 * Returns the same ActionResult shape executeUpdateServicePrice produces so the caller
 * wraps it identically.
 */
async function executeUpdateServicePriceInConvex(
  params: ActionParams['update_service_price'],
  clinicId: string,
  userId: string,
  dryRun: boolean
): Promise<ActionResult> {
  const { service_id, new_price_cents, reason } = params

  try {
    const serviceRow = (await getConvexDocumentByLegacyId('services', service_id)) as Record<string, any> | null
    const serviceBefore = serviceRow && String(serviceRow.clinic_id) === String(clinicId) ? serviceRow : null

    if (!serviceBefore) {
      return {
        success: false,
        action: 'update_service_price',
        params,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: `Service ${service_id} not found`,
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    if (dryRun) {
      return {
        success: true,
        action: 'update_service_price',
        params,
        result: {
          before: {
            price_cents: serviceBefore.price_cents,
          },
          after: {
            price_cents: new_price_cents,
          },
          changes: [
            `Price would change from $${(serviceBefore.price_cents / 100).toFixed(2)} to $${(new_price_cents / 100).toFixed(2)}`,
            reason ? `Reason: ${reason}` : '',
          ].filter(Boolean),
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    const updatedAt = new Date().toISOString()
    await patchConvexDocumentByLegacyId('services', service_id, {
      price_cents: new_price_cents,
      updated_at: updatedAt,
    })

    const serviceAfter: Record<string, any> = { ...serviceBefore, price_cents: new_price_cents, updated_at: updatedAt }

    const result: ActionResult = {
      success: true,
      action: 'update_service_price',
      params,
      result: {
        before: {
          price_cents: serviceBefore.price_cents,
          name: serviceBefore.name,
        },
        after: {
          price_cents: serviceAfter.price_cents,
          name: serviceAfter.name,
        },
        changes: [
          `Updated price for service "${serviceBefore.name}"`,
          `From: $${(serviceBefore.price_cents / 100).toFixed(2)}`,
          `To: $${(serviceAfter.price_cents / 100).toFixed(2)}`,
          `Change: ${(((new_price_cents - serviceBefore.price_cents) / serviceBefore.price_cents) * 100).toFixed(1)}%`,
          reason ? `Reason: ${reason}` : '',
        ].filter(Boolean),
      },
      executed_at: updatedAt,
      executed_by: userId,
    }

    // Mirror AIService.logAction (action_logs insert). Best-effort: a logging
    // failure must not break the action (matches the Supabase path swallowing it).
    try {
      const logId = crypto.randomUUID()
      const loggedAt = new Date().toISOString()
      await upsertConvexDocumentByLegacyId('action_logs', logId, {
        id: logId,
        clinic_id: clinicId,
        user_id: userId,
        action_type: result.action,
        success: result.success,
        params: result.params,
        result: result.result ?? null,
        error_code: result.error?.code ?? null,
        error_message: result.error?.message ?? null,
        error_details: result.error?.details ?? null,
        dry_run: false,
        executed_at: result.executed_at,
        created_at: loggedAt,
      })
    } catch (logError) {
      console.error('[update-service-price] Convex action_logs write failed:', logError)
    }

    // Mirror aiService.execute: invalidate the Lara snapshot cache after a
    // successful non-dry-run mutation so subsequent reads reflect the new price.
    snapshotCache.invalidate(clinicId)

    return result
  } catch (error: any) {
    return {
      success: false,
      action: 'update_service_price',
      params,
      error: {
        code: 'UNEXPECTED_ERROR',
        message: error?.message || 'Unexpected error',
        details: error,
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }
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
    const parsed = validateSchema(updateServicePriceSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const { service_id, new_price_cents, reason, clinic_id, dry_run } = parsed.data
    const dryRun = dry_run ?? false    // Verify user has access to the clinic (uses user_has_clinic_access RPC).
    const accessDenied = await assertClinicAccess(user.id, clinic_id, supabase)
    if (accessDenied) return accessDenied

    const forbidden = await forbiddenIfMissingPermissions(user.id, clinic_id, [
      'lara.execute_actions',
      'services.set_prices',
    ])
    if (forbidden) return forbidden

    // 5. Build action parameters
    const params: ActionParams['update_service_price'] = {
      service_id,
      new_price_cents,
      reason,
    }

    // 6. Execute action
    // On the Convex-only write path Supabase is unreachable (supabaseAdmin.from()
    // throws), so aiService.execute -> executeUpdateServicePrice + logAction would
    // fail. Replicate the same row writes directly against Convex instead.
    const result = shouldUseConvexOnlyWritePath('services')
      ? await executeUpdateServicePriceInConvex(params, clinic_id, user.id, dryRun)
      : // Use supabaseAdmin to bypass RLS since we've already verified membership
        await aiService.execute('update_service_price', params, {
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
        { status: dry_run ? 200 : 200 }
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
    console.error('[API] /api/actions/update-service-price error:', error)
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
