import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { advanceNextDue } from './lib/recurringDates'

/**
 * Convex port of the Postgres RPC `process_recurring_expenses`
 * (supabase/migrations/58_recurring_expenses.sql).
 *
 * Generates ONE expense per due recurring template per invocation and advances
 * the template's next_recurrence_date by exactly ONE period (no catch-up loop),
 * matching the SQL behavior 1:1. Only reached on the Convex-only write path
 * (DATA_WRITE_MODE_EXPENSES=convex); in 'dual' the Supabase RPC + runtime mirror
 * already generate the rows, so the cron route must NOT also call this.
 */

type Doc = Record<string, any>

function assertSecret(secret: string) {
  const expected = process.env.CONVEX_AUTH_BRIDGE_SECRET
  if (!expected || secret !== expected) {
    throw new Error('Unauthorized recurring-expenses request')
  }
}

export const processDue = mutation({
  args: {
    secret: v.string(),
    // null/undefined => all clinics (p_clinic_id IS NULL)
    clinicId: v.optional(v.union(v.string(), v.null())),
    // ISO yyyy-mm-dd; caller passes the cron date for determinism. Default: today (UTC).
    today: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret)

    const today = (args.today ?? new Date().toISOString()).slice(0, 10)
    const pClinicId = args.clinicId ?? null

    // Schemaless: collect the whole table and filter in JS (no Convex indexes).
    const all = (await ctx.db.query('expenses' as any).collect()) as Array<Doc & { _id: any }>

    // Exact replica of the SQL WHERE: due templates only.
    const due = all.filter(
      (e) =>
        e.is_recurring === true &&
        e.next_recurrence_date != null &&
        String(e.next_recurrence_date).slice(0, 10) <= today &&
        e.parent_expense_id == null &&
        (pClinicId == null || String(e.clinic_id) === String(pClinicId))
    )

    // ORDER BY next_recurrence_date (string compare == chronological for zero-padded dates).
    due.sort((a, b) =>
      String(a.next_recurrence_date)
        .slice(0, 10)
        .localeCompare(String(b.next_recurrence_date).slice(0, 10))
    )

    const now = new Date().toISOString()
    const expenseIds: string[] = []
    let count = 0

    for (const tpl of due) {
      const childLegacyId = crypto.randomUUID()
      const periodDate = String(tpl.next_recurrence_date).slice(0, 10)

      // Child = generated copy. is_recurring=false, next_recurrence_date=null so it is
      // never itself re-processed. amount_cents copied verbatim (integer cents, no math).
      const childRow: Doc = {
        id: childLegacyId,
        legacyId: childLegacyId,
        legacyTable: 'expenses',
        clinic_id: tpl.clinic_id,
        expense_date: periodDate, // = template.next_recurrence_date (the period), NOT today
        category_id: tpl.category_id ?? null,
        category: tpl.category ?? null,
        subcategory: tpl.subcategory ?? null,
        description: tpl.description ?? null,
        amount_cents: tpl.amount_cents,
        vendor: tpl.vendor ?? null,
        invoice_number: tpl.invoice_number ?? null,
        is_recurring: false,
        is_variable: tpl.is_variable ?? false,
        expense_category: tpl.expense_category ?? null,
        campaign_id: tpl.campaign_id ?? null,
        related_supply_id: tpl.related_supply_id ?? null,
        quantity: tpl.quantity ?? null,
        notes: `${tpl.notes ?? ''} [Auto-generated from recurring expense]`,
        parent_expense_id: tpl.id ?? tpl.legacyId,
        // DB-default columns set explicitly to keep the Supabase row shape 1:1.
        is_paid: true,
        payment_method: null,
        related_asset_id: null,
        related_fixed_cost_id: null,
        auto_processed: false,
        recurrence_interval: null,
        recurrence_day: null,
        next_recurrence_date: null,
        created_at: now,
        updated_at: now,
        convex_created_at: now,
        convex_updated_at: now,
      }

      await ctx.db.insert('expenses' as any, childRow)
      expenseIds.push(childLegacyId)
      count++

      // Advance the template exactly ONE period (replicates the SQL CASE).
      const nextDue = advanceNextDue(
        periodDate,
        tpl.recurrence_interval,
        tpl.recurrence_day ?? null,
        String(tpl.expense_date ?? periodDate).slice(0, 10)
      )
      await ctx.db.patch(tpl._id, {
        next_recurrence_date: nextDue,
        updated_at: now,
        convex_updated_at: now,
      } as any)
    }

    return { generated_count: count, clinic_id: pClinicId, expense_ids: expenseIds }
  },
})
