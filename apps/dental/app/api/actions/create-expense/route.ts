/**
 * API Endpoint: Create Expense Action
 *
 * Allows Lara (or user) to create expenses through voice commands.
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
  getConvexDocumentByLegacyId,
  upsertConvexDocumentByLegacyId,
} from '@/lib/convex/server'

const createExpenseSchema = z.object({
  amount_cents: z.coerce.number().int().positive(),
  category_id: z.string().uuid(),
  description: z.string().min(1),
  expense_date: z.string().min(1),
  clinic_id: z.string().uuid(),
  dry_run: z.boolean().optional(),
})

type ImportedRecord = Record<string, any>

/**
 * Convex-only replication of aiService.execute('create_expense', ...).
 *
 * In DATA_WRITE_MODE_EXPENSES=convex the Supabase backend is unreachable, so the
 * supabaseAdmin-backed action (executeCreateExpense + AIService.logAction) would
 * throw on its first .from() call. This mirrors EVERY write that path performs:
 *   - reads `categories` to resolve the category name (CATEGORY_NOT_FOUND gate),
 *   - dry_run -> returns the same preview ActionResult with NO write,
 *   - non-dry -> inserts the `expenses` row (matching executeCreateExpense's columns
 *     + auto_processed:false, plus Postgres-default columns id/created_at/updated_at
 *     which Convex does not fill automatically),
 *   - logs the action to `action_logs` exactly like AIService.execute does post-success.
 * The returned ActionResult shape mirrors executeCreateExpense so the route's
 * response payload is byte-for-byte equivalent to the Supabase path.
 */
async function createExpenseActionInConvex(
  params: ActionParams['create_expense'],
  ctx: { clinicId: string; userId: string; dryRun: boolean }
): Promise<ActionResult> {
  const { clinicId, userId, dryRun } = ctx
  const { amount_cents, category_id, description, expense_date } = params

  try {
    // Verify category exists (mirrors executeCreateExpense's `categories` read).
    const category = (await getConvexDocumentByLegacyId('categories', category_id)) as ImportedRecord | null
    if (!category) {
      return {
        success: false,
        action: 'create_expense',
        params,
        error: {
          code: 'CATEGORY_NOT_FOUND',
          message: `Category ${category_id} not found`,
          details: null,
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    const categoryName = category.display_name || category.name

    if (dryRun) {
      return {
        success: true,
        action: 'create_expense',
        params,
        result: {
          preview: {
            amount_cents,
            amount_display: `$${(amount_cents / 100).toFixed(2)}`,
            category: categoryName,
            description,
            expense_date,
          },
          changes: [
            `Would create expense: "${description}"`,
            `Amount: $${(amount_cents / 100).toFixed(2)}`,
            `Category: ${categoryName}`,
            `Date: ${expense_date}`,
          ],
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    // Execute the insert (mirrors executeCreateExpense's `expenses` insert columns +
    // Postgres-default columns Convex must receive explicitly).
    const now = new Date().toISOString()
    const expenseId = crypto.randomUUID()
    const expense: ImportedRecord = {
      id: expenseId,
      clinic_id: clinicId,
      amount_cents,
      category: categoryName,
      category_id,
      description,
      expense_date,
      auto_processed: false,
      created_at: now,
      updated_at: now,
    }
    await upsertConvexDocumentByLegacyId('expenses', expenseId, expense)

    return {
      success: true,
      action: 'create_expense',
      params,
      result: {
        created: {
          id: expense.id,
          amount_cents: expense.amount_cents,
          amount_display: `$${(expense.amount_cents / 100).toFixed(2)}`,
          category: categoryName,
          description: expense.description,
          expense_date: expense.expense_date,
        },
        changes: [
          `Created expense: "${description}"`,
          `Amount: $${(amount_cents / 100).toFixed(2)}`,
          `Category: ${categoryName}`,
          `Date: ${expense_date}`,
        ],
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  } catch (error: any) {
    console.error('[API] createExpenseActionInConvex error:', error)
    return {
      success: false,
      action: 'create_expense',
      params,
      error: {
        code: 'EXECUTION_ERROR',
        message: error?.message || 'Unknown error occurred',
        details: error,
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }
}

/**
 * Mirror AIService.logAction's `action_logs` insert (best-effort, never throws).
 * Only invoked after a successful non-dry-run action, matching AIService.execute.
 */
async function logActionInConvex(result: ActionResult, ctx: { clinicId: string; userId: string; dryRun: boolean }) {
  try {
    const now = new Date().toISOString()
    const logId = crypto.randomUUID()
    const logEntry: ImportedRecord = {
      id: logId,
      clinic_id: ctx.clinicId,
      user_id: ctx.userId,
      action_type: result.action,
      success: result.success,
      params: result.params,
      result: result.result || null,
      error_code: result.error?.code || null,
      error_message: result.error?.message || null,
      error_details: result.error?.details || null,
      dry_run: ctx.dryRun || false,
      executed_at: result.executed_at,
      created_at: now,
    }
    await upsertConvexDocumentByLegacyId('action_logs', logId, logEntry)
  } catch (error) {
    console.error('[API] logActionInConvex failed:', error)
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
    const parsed = validateSchema(createExpenseSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const { amount_cents, category_id, description, expense_date, clinic_id, dry_run } = parsed.data
    const dryRun = dry_run ?? false    // Verify user has access to the clinic (uses user_has_clinic_access RPC).
    const accessDenied = await assertClinicAccess(user.id, clinic_id, supabase)
    if (accessDenied) return accessDenied

    const forbidden = await forbiddenIfMissingPermissions(user.id, clinic_id, [
      'lara.execute_actions',
      'expenses.create',
    ])
    if (forbidden) return forbidden

    // 5. Build action parameters
    const params: ActionParams['create_expense'] = {
      amount_cents,
      category_id,
      description,
      expense_date,
    }

    // 6. Execute action.
    // Convex-only write path: replicate the action's writes (expenses insert +
    // action_logs) directly, since supabaseAdmin is unreachable in this mode.
    let result: ActionResult
    if (shouldUseConvexOnlyWritePath('expenses')) {
      const ctx = { clinicId: clinic_id, userId: user.id, dryRun }
      result = await createExpenseActionInConvex(params, ctx)
      // AIService.execute logs the action only on a non-dry-run success.
      if (!dryRun && result.success) {
        await logActionInConvex(result, ctx)
      }
    } else {
      // Execute action via AIService (Supabase path, with Convex dual-write mirror).
      result = await aiService.execute('create_expense', params, {
        clinicId: clinic_id,
        userId: user.id,
        supabase: supabaseAdmin,
        dryRun,
      })
    }

    // 7. Return result
    if (result.success) {
      return NextResponse.json({ success: true, data: result }, { status: 200 })
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
  } catch (error: any) {
    console.error('[API] /api/actions/create-expense error:', error)
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
