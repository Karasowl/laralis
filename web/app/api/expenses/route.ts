import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withPermission } from '@/lib/middleware/with-permission'
import {
  expenseDbSchema,
  type ExpenseFilters,
  type ExpenseWithRelations
} from '@/lib/types/expenses'
import { readJson } from '@/lib/validation'
import { withRouteContext } from '@/lib/api/route-handler'
import { createRouteLogger } from '@/lib/api/logger'

export const dynamic = 'force-dynamic'

type CategoryLookup = {
  id: string
  name: string | null
  display_name: string | null
}

export const GET = withPermission('expenses.view', async (request, context) =>
  withRouteContext(request, async ({ requestId }) => {
    const logger = createRouteLogger(requestId)
    try {
      const { searchParams } = new URL(request.url)
      const clinicId = context.clinicId

      // Build filters
      const filters: ExpenseFilters = {
        category: searchParams.get('category') || undefined,
        subcategory: searchParams.get('subcategory') || undefined,
        vendor: searchParams.get('vendor') || undefined,
        start_date: searchParams.get('start_date') || undefined,
        end_date: searchParams.get('end_date') || undefined,
        min_amount: searchParams.get('min_amount') ? parseInt(searchParams.get('min_amount')!) : undefined,
        max_amount: searchParams.get('max_amount') ? parseInt(searchParams.get('max_amount')!) : undefined,
        is_recurring: searchParams.get('is_recurring') ? searchParams.get('is_recurring') === 'true' : undefined,
        auto_processed: searchParams.get('auto_processed') ? searchParams.get('auto_processed') === 'true' : undefined
      }

      // Build query
      let query = supabaseAdmin
        .from('expenses')
        .select(`
          *,
          supply:related_supply_id(id, name, category),
          asset:related_asset_id(id, name, category)
        `)
        .eq('clinic_id', clinicId)
        .order('expense_date', { ascending: false })

      // Apply filters
      if (filters.category) {
        query = query.eq('category', filters.category)
      }
      if (filters.subcategory) {
        query = query.eq('subcategory', filters.subcategory)
      }
      if (filters.vendor) {
        query = query.ilike('vendor', `%${filters.vendor}%`)
      }
      if (filters.start_date) {
        query = query.gte('expense_date', filters.start_date)
      }
      if (filters.end_date) {
        query = query.lte('expense_date', filters.end_date)
      }
      if (filters.min_amount) {
        query = query.gte('amount_cents', filters.min_amount)
      }
      if (filters.max_amount) {
        query = query.lte('amount_cents', filters.max_amount)
      }
      if (filters.is_recurring !== undefined) {
        query = query.eq('is_recurring', filters.is_recurring)
      }
      if (filters.auto_processed !== undefined) {
        query = query.eq('auto_processed', filters.auto_processed)
      }

      const { data, error } = await query

      if (error) {
        logger.error('expenses.list.fetch_failed', { error: error.message })
        return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
      }

      return NextResponse.json({ data: data as ExpenseWithRelations[] })

    } catch (error) {
      logger.error('expenses.list.unexpected_error', {
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
)

export const POST = withPermission('expenses.create', async (request, context) =>
  withRouteContext(request, async ({ requestId }) => {
    const logger = createRouteLogger(requestId)
    try {
      const bodyResult = await readJson(request)
      if ('error' in bodyResult) {
        return bodyResult.error
      }
      const rawBody = bodyResult.data as Record<string, unknown>
      const clinicId = context.clinicId

    // Convert amount_pesos to amount_cents BEFORE validation (same pattern as supplies)
    const { amount_pesos, ...bodyWithoutPesos } = rawBody
    let normalizedAmountCents = typeof rawBody.amount_cents === 'number' ? Math.round(rawBody.amount_cents) : undefined
    if (typeof amount_pesos === 'number') {
      normalizedAmountCents = Math.round(amount_pesos * 100)
      console.info('[Expense Creation] Converting pesos to cents:', {
        amount_pesos,
        amount_cents: normalizedAmountCents
      })
    }
      const dataToValidate = { ...bodyWithoutPesos, amount_cents: normalizedAmountCents }

    // Validate input using DB schema (with amount_cents)
      const validationResult = expenseDbSchema.safeParse(dataToValidate)
      if (!validationResult.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: validationResult.error.flatten() },
          { status: 400 }
        )
      }

      const {
        create_asset,
        asset_name,
        asset_useful_life_years,
        category_id,
        amount_cents,
        ...expenseData
      } = validationResult.data

    // Resolve category_id if only category string is provided
      let resolvedCategoryId = category_id
      let resolvedCategory = expenseData.category

      console.info('[Category Resolution] Initial values:', {
        category_id,
        category: expenseData.category
      })

      if (!resolvedCategoryId && resolvedCategory) {
      // Try to find the category by name or display_name
      // Use supabaseAdmin to bypass RLS for system categories
      console.info('[Category Resolution] Attempting to resolve category:', resolvedCategory)

      // First try exact match on display_name
        let { data: cat, error: catError } = await supabaseAdmin
          .from('categories')
          .select('id, name, display_name')
          .eq('entity_type', 'expense')
          .eq('is_system', true)
          .is('clinic_id', null)
          .is('parent_id', null)
          .ilike('display_name', resolvedCategory)
          .maybeSingle()

        console.info('[Category Resolution] Query by display_name result:', { cat, catError })

      // If not found, try by name (lowercase)
        if (!cat) {
          const result = await supabaseAdmin
            .from('categories')
            .select('id, name, display_name')
            .eq('entity_type', 'expense')
            .eq('is_system', true)
            .is('clinic_id', null)
            .is('parent_id', null)
            .ilike('name', resolvedCategory)
            .maybeSingle()

          cat = result.data
          catError = result.error
          console.info('[Category Resolution] Query by name result:', { cat, catError })
        }

        if (cat) {
          resolvedCategoryId = cat.id
          const normalizedCat = cat as CategoryLookup
          resolvedCategory = normalizedCat.display_name || normalizedCat.name || resolvedCategory
          console.info('[Category Resolution] Resolved to:', { id: resolvedCategoryId, name: resolvedCategory })
        } else {
          logger.error('expenses.create.invalid_category', { category: resolvedCategory, error: catError?.message })
          return NextResponse.json(
            { error: 'Invalid category', details: `Category "${resolvedCategory}" not found in system categories` },
            { status: 400 }
          )
        }
      } else if (resolvedCategoryId && !resolvedCategory) {
      // If category_id provided but category string missing, resolve name
        const { data: cat } = await supabaseAdmin
          .from('categories')
          .select('name, display_name')
          .eq('id', resolvedCategoryId)
          .single()
        if (cat) {
          const normalizedCat = cat as Pick<CategoryLookup, 'name' | 'display_name'>
          resolvedCategory = normalizedCat.display_name || normalizedCat.name || resolvedCategory
        }
      }

    // Use the converted amount_cents
      const amountCents = amount_cents || 0
      console.info('[Expense Creation] Final amount:', {
        amount_cents: amountCents
      })

    // Calculate next_recurrence_date for recurring expenses
      let nextRecurrenceDate: string | null = null
      if (expenseData.is_recurring && expenseData.recurrence_interval) {
        const baseDate = new Date(expenseData.expense_date)
        const recurrenceDay = expenseData.recurrence_day || baseDate.getDate()

        switch (expenseData.recurrence_interval) {
          case 'weekly':
            // Add 7 days from expense date
            baseDate.setDate(baseDate.getDate() + 7)
            break
          case 'monthly':
            // Move to next month, using recurrence_day
            baseDate.setMonth(baseDate.getMonth() + 1)
            // Handle month-end edge cases (e.g., Jan 31 -> Feb 28)
            const lastDayOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate()
            baseDate.setDate(Math.min(recurrenceDay, lastDayOfMonth))
            break
          case 'yearly':
            // Add 1 year from expense date
            baseDate.setFullYear(baseDate.getFullYear() + 1)
            break
        }
        nextRecurrenceDate = baseDate.toISOString().split('T')[0]
      }

    // Create expense record
      const { data: expense, error: expenseError } = await supabaseAdmin
        .from('expenses')
        .insert({
          ...expenseData,
          amount_cents: amountCents,
          category: resolvedCategory || expenseData.category,
          category_id: resolvedCategoryId || category_id || null,
          clinic_id: clinicId,
          next_recurrence_date: nextRecurrenceDate
        })
        .select()
        .single()

      if (expenseError) {
        logger.error('expenses.create.insert_failed', { error: expenseError.message })
        return NextResponse.json({ error: 'Failed to create expense', message: expenseError.message }, { status: 500 })
      }

    // Handle integrations
      let updatedExpense = expense

    // Integration 1: Create asset if requested (for equipment purchases)
      if (create_asset && asset_name && asset_useful_life_years) {
        const { data: asset, error: assetError } = await supabaseAdmin
          .from('assets')
          .insert({
            clinic_id: clinicId,
            name: asset_name,
            category: expenseData.subcategory || expenseData.category,
            acquisition_cost_cents: amountCents,
            useful_life_years: asset_useful_life_years,
            acquisition_date: expenseData.expense_date
          })
          .select()
          .single()

        if (!assetError && asset) {
          // Update expense to link to created asset
          const { data: linkedExpense } = await supabaseAdmin
            .from('expenses')
            .update({
              related_asset_id: asset.id,
              auto_processed: true
            })
            .eq('id', expense.id)
            .select()
            .single()

          updatedExpense = linkedExpense || expense
        }
      }

    // Integration 2: Update supply inventory if supply purchase
      if (expenseData.related_supply_id && expenseData.quantity) {
        const { data: supply } = await supabaseAdmin
          .from('supplies')
          .select('stock_quantity, portions_per_presentation')
          .eq('id', expenseData.related_supply_id)
          .single()

        if (supply) {
          // Calculate total portions from purchased quantity
          const portionsPerPresentation = supply.portions_per_presentation || 1
          const totalPortions = expenseData.quantity * portionsPerPresentation
        
        // Update supply inventory
          await supabaseAdmin
            .from('supplies')
            .update({
              stock_quantity: (supply.stock_quantity || 0) + totalPortions,
              last_purchase_price_cents: Math.round(amountCents / expenseData.quantity),
              last_purchase_date: expenseData.expense_date
            })
            .eq('id', expenseData.related_supply_id)

        // Mark expense as auto-processed
          const { data: linkedExpense } = await supabaseAdmin
            .from('expenses')
            .update({ auto_processed: true })
            .eq('id', expense.id)
            .select()
            .single()

          updatedExpense = linkedExpense || expense
        }
      }

      return NextResponse.json({ data: updatedExpense }, { status: 201 })

    } catch (error) {
      logger.error('expenses.create.unexpected_error', {
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
)
