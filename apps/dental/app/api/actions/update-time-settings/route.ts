/**
 * API Endpoint: Update Time Settings Action
 *
 * Allows Lara (or user) to update clinic time/productivity settings.
 * Supports dry-run mode for preview.
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
  listConvexDocumentsByClinic,
  patchConvexDocumentByLegacyId,
  upsertConvexDocumentByLegacyId,
} from '@/lib/convex/server'

const updateTimeSettingsSchema = z.object({
  work_days: z.coerce.number().int().positive().optional(),
  hours_per_day: z.coerce.number().positive().optional(),
  real_productivity_pct: z.coerce.number().min(0).max(100).optional(),
  clinic_id: z.string().uuid(),
  dry_run: z.boolean().optional(),
}).refine(
  (data) =>
    data.work_days !== undefined ||
    data.hours_per_day !== undefined ||
    data.real_productivity_pct !== undefined,
  {
    message: 'At least one setting (work_days, hours_per_day, or real_productivity_pct) is required',
  }
)

/**
 * Convex-only replica of executeUpdateTimeSettings (lib/ai/actions/pricing-actions.ts).
 *
 * In DATA_WRITE_MODE=convex blanket mode the underlying Supabase admin client is
 * unreachable: aiService.execute('update_time_settings', ...) hits
 * supabaseAdmin.from('settings_time').select(...) which throws before any write
 * runs. This helper reproduces the SAME settings_time upsert the action performs,
 * mirroring the saveTimeSettingsToConvex pattern used by the core /api/settings/time
 * route, and returns an ActionResult shaped identically to the action handler so the
 * route response stays byte-for-byte the same.
 */
async function executeUpdateTimeSettingsInConvex(
  params: ActionParams['update_time_settings'],
  clinicId: string,
  userId: string,
  dryRun: boolean
): Promise<ActionResult> {
  const { work_days, hours_per_day, real_productivity_pct } = params

  // Get current settings (latest by updated_at), mirroring the action's
  // .order('updated_at', { ascending: false }).limit(1).single()
  const rows = (await listConvexDocumentsByClinic('settings_time', clinicId, 10)) as Array<
    Record<string, any>
  >
  const currentSettings =
    rows
      .slice()
      .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0] ?? null

  const changes: string[] = []

  const currentWorkDays =
    currentSettings?.working_days_per_month ?? currentSettings?.work_days ?? 22
  const currentHoursPerDay = currentSettings?.hours_per_day ?? 8
  const rawRealPct =
    currentSettings?.real_hours_percentage ?? currentSettings?.real_pct ?? 0.8
  const currentRealPct = rawRealPct <= 1 ? rawRealPct * 100 : rawRealPct

  const updates: Record<string, any> = {}

  if (work_days !== undefined) {
    updates.work_days = work_days
    updates.working_days_per_month = work_days
    changes.push(`Work days: ${currentWorkDays} → ${work_days} days/month`)
  }

  if (hours_per_day !== undefined) {
    updates.hours_per_day = hours_per_day
    changes.push(`Hours per day: ${currentHoursPerDay} → ${hours_per_day} hours`)
  }

  if (real_productivity_pct !== undefined) {
    const realPctDecimal = real_productivity_pct / 100
    updates.real_pct = realPctDecimal
    updates.real_hours_percentage = realPctDecimal
    changes.push(`Productivity: ${currentRealPct.toFixed(0)}% → ${real_productivity_pct}%`)
  }

  if (Object.keys(updates).length === 0) {
    return {
      success: false,
      action: 'update_time_settings',
      params,
      error: {
        code: 'NO_CHANGES',
        message: 'No settings provided to update',
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }

  const newWorkDays = work_days ?? currentWorkDays
  const newHoursPerDay = hours_per_day ?? currentHoursPerDay
  const newRealPct = real_productivity_pct ?? currentRealPct

  const currentMinutesMonth = currentWorkDays * currentHoursPerDay * 60 * (currentRealPct / 100)
  const newMinutesMonth = newWorkDays * newHoursPerDay * 60 * (newRealPct / 100)

  changes.push('')
  changes.push(`Impact on capacity:`)
  changes.push(
    `Effective minutes/month: ${Math.round(currentMinutesMonth)} → ${Math.round(newMinutesMonth)}`
  )

  if (newMinutesMonth !== currentMinutesMonth) {
    const percentChange = (
      ((newMinutesMonth - currentMinutesMonth) / currentMinutesMonth) *
      100
    ).toFixed(1)
    changes.push(`Change: ${percentChange}%`)
    changes.push(`This will affect fixed cost per minute for all services`)
  }

  if (dryRun) {
    return {
      success: true,
      action: 'update_time_settings',
      params,
      result: {
        before: {
          work_days: currentWorkDays,
          hours_per_day: currentHoursPerDay,
          real_productivity_pct: currentRealPct,
          effective_minutes_month: Math.round(currentMinutesMonth),
        },
        after: {
          work_days: newWorkDays,
          hours_per_day: newHoursPerDay,
          real_productivity_pct: newRealPct,
          effective_minutes_month: Math.round(newMinutesMonth),
        },
        changes: ['DRY RUN - Settings would be updated:', ...changes],
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }

  // Execute the write against Convex. Convex has no Postgres defaults, so set
  // created_at/updated_at explicitly (matching the saveTimeSettingsToConvex pattern).
  const now = new Date().toISOString()

  if (currentSettings) {
    const patch = {
      ...updates,
      updated_at: now,
    }
    await patchConvexDocumentByLegacyId('settings_time', String(currentSettings.id), patch)
  } else {
    const id = crypto.randomUUID()
    const insertRow = {
      id,
      clinic_id: clinicId,
      work_days: work_days ?? 22,
      working_days_per_month: work_days ?? 22,
      hours_per_day: hours_per_day ?? 8,
      real_pct: (real_productivity_pct ?? 80) / 100,
      real_hours_percentage: (real_productivity_pct ?? 80) / 100,
      ...updates,
      created_at: now,
      updated_at: now,
    }
    await upsertConvexDocumentByLegacyId('settings_time', id, insertRow)
  }

  return {
    success: true,
    action: 'update_time_settings',
    params,
    result: {
      before: {
        work_days: currentWorkDays,
        hours_per_day: currentHoursPerDay,
        real_productivity_pct: currentRealPct,
        effective_minutes_month: Math.round(currentMinutesMonth),
      },
      after: {
        work_days: newWorkDays,
        hours_per_day: newHoursPerDay,
        real_productivity_pct: newRealPct,
        effective_minutes_month: Math.round(newMinutesMonth),
      },
      changes: ['Settings updated:', ...changes],
    },
    executed_at: new Date().toISOString(),
    executed_by: userId,
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
    const parsed = validateSchema(updateTimeSettingsSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const { work_days, hours_per_day, real_productivity_pct, clinic_id, dry_run } = parsed.data
    const dryRun = dry_run ?? false    // Verify user has access to the clinic (uses user_has_clinic_access RPC).
    const accessDenied = await assertClinicAccess(user.id, clinic_id, supabase)
    if (accessDenied) return accessDenied

    const forbidden = await forbiddenIfMissingPermissions(user.id, clinic_id, [
      'lara.execute_actions',
      'settings.edit',
    ])
    if (forbidden) return forbidden

    // 5. Build action parameters
    const params: ActionParams['update_time_settings'] = {
      work_days,
      hours_per_day,
      real_productivity_pct,
    }

    // 6. Execute action. In Convex-only write mode the Supabase admin client is
    // unreachable (aiService.execute -> supabaseAdmin.from('settings_time') throws),
    // so replicate the same settings_time upsert against Convex directly.
    const result = shouldUseConvexOnlyWritePath('settings_time')
      ? await executeUpdateTimeSettingsInConvex(params, clinic_id, user.id, dryRun)
      : await aiService.execute('update_time_settings', params, {
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
    console.error('[API] /api/actions/update-time-settings error:', error)
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
