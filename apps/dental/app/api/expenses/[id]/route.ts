import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { expenseDbSchema } from '@/lib/types/expenses'
import { withPermission } from '@/lib/middleware/with-permission'
import { readJson } from '@/lib/validation'
import { withRouteContext } from '@/lib/api/route-handler'
import { createRouteLogger } from '@/lib/api/logger'
import { getConvexDocumentByLegacyId, listConvexTable, patchConvexDocumentByLegacyId, deleteConvexDocumentByLegacyId } from '@/lib/convex/server';
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath, shouldWriteConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic'

type CategoryLookup = {
  id: string
  name: string | null
  display_name: string | null
}

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, ...rest } = row
  return rest
}

function calculateNextRecurrenceDate(expenseData: Record<string, any>, currentExpense?: Record<string, any>) {
  const isRecurring = expenseData.is_recurring ?? currentExpense?.is_recurring
  const recurrenceInterval = expenseData.recurrence_interval ?? currentExpense?.recurrence_interval
  const expenseDate = expenseData.expense_date ?? currentExpense?.expense_date
  const recurrenceDay = expenseData.recurrence_day ?? currentExpense?.recurrence_day

  if (!isRecurring || !recurrenceInterval || !expenseDate) return null

  const baseDate = new Date(expenseDate)
  const dayToUse = recurrenceDay || baseDate.getDate()

  switch (recurrenceInterval) {
    case 'weekly':
      baseDate.setDate(baseDate.getDate() + 7)
      break
    case 'monthly': {
      baseDate.setMonth(baseDate.getMonth() + 1)
      const lastDayOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate()
      baseDate.setDate(Math.min(dayToUse, lastDayOfMonth))
      break
    }
    case 'yearly':
      baseDate.setFullYear(baseDate.getFullYear() + 1)
      break
    default:
      return null
  }

  return baseDate.toISOString().split('T')[0]
}

async function resolveConvexExpenseCategory(categoryId: string | null | undefined, category: string | null | undefined) {
  const categories = await listConvexTable('categories', 2000) as ImportedRecord[]

  if (categoryId && !category) {
    const found = categories.find((row) => row.id === categoryId || row.legacyId === categoryId)
    return {
      category_id: categoryId,
      category: found?.display_name || found?.name || category || null,
    }
  }

  if (!categoryId && category) {
    const normalizedCategory = category.trim().toLowerCase()
    const found = categories.find((row) => {
      return (
        row.entity_type === 'expense' &&
        row.is_system === true &&
        !row.clinic_id &&
        !row.parent_id &&
        [row.display_name, row.name].filter(Boolean).some((value) => String(value).trim().toLowerCase() === normalizedCategory)
      )
    })

    if (!found) return null

    return {
      category_id: found.id || found.legacyId,
      category: found.display_name || found.name || category,
    }
  }

  return {
    category_id: categoryId || null,
    category: category || null,
  }
}

async function getExpenseFromConvex(expenseId: string, clinicId: string): Promise<ImportedRecord | null> {
  const row = await getConvexDocumentByLegacyId('expenses', expenseId) as ImportedRecord | null
  if (!row || row.clinic_id !== clinicId) return null

  const [supply, asset] = await Promise.all([
    row.related_supply_id ? getConvexDocumentByLegacyId('supplies', row.related_supply_id) as Promise<ImportedRecord | null> : Promise.resolve(null),
    row.related_asset_id ? getConvexDocumentByLegacyId('assets', row.related_asset_id) as Promise<ImportedRecord | null> : Promise.resolve(null),
  ])

  return {
    ...normalizeConvexRecord(row),
    supply: normalizeConvexRecord(supply),
    asset: normalizeConvexRecord(asset),
  }
}

const missingColumnFromSupabaseError = (error: { message?: string } | null | undefined) => {
  const match = error?.message?.match(/Could not find the '([^']+)' column/)
  return match?.[1] || null
}

const updateSupplyInventory = async (supplyId: string, payload: Record<string, unknown>) => {
  let attemptedPayload = { ...payload }
  let result = await supabaseAdmin
    .from('supplies')
    .update(attemptedPayload)
    .eq('id', supplyId)

  for (let attempts = 0; result.error && attempts < 5; attempts += 1) {
    const missingColumn = missingColumnFromSupabaseError(result.error)
    if (!missingColumn || !(missingColumn in attemptedPayload)) break

    const { [missingColumn]: _removed, ...nextPayload } = attemptedPayload
    attemptedPayload = nextPayload
    result = await supabaseAdmin
      .from('supplies')
      .update(attemptedPayload)
      .eq('id', supplyId)
  }

  return result
}

const portionsPerPresentation = (supply: Record<string, unknown>) => {
  const raw = supply.portions_per_presentation ?? supply.portions ?? 1
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : 1
}

export const GET = withPermission('expenses.view', async (request, context) =>
  withRouteContext(request, async ({ requestId }) => {
    const logger = createRouteLogger(requestId)
    try {
      const expenseId = request.nextUrl.pathname.split('/').pop()
      if (!expenseId) {
        return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 })
      }

      if (shouldReturnConvexData('expenses')) {
        const data = await getExpenseFromConvex(expenseId, context.clinicId)
        if (!data) {
          return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
        }
        return NextResponse.json({ data })
      }

      const { data, error } = await supabaseAdmin
        .from('expenses')
        .select(`
          *,
          supply:related_supply_id(id, name, category),
          asset:related_asset_id(id, name, category)
        `)
        .eq('id', expenseId)
        .eq('clinic_id', context.clinicId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
        }
        logger.error('expenses.detail.fetch_failed', { error: error.message, expenseId })
        return NextResponse.json({ error: 'Failed to fetch expense' }, { status: 500 })
      }

      return NextResponse.json({ data })
    } catch (error) {
      logger.error('expenses.detail.unexpected_error', {
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
)

export const PUT = withPermission('expenses.edit', async (request, context) =>
  withRouteContext(request, async ({ requestId }) => {
    const logger = createRouteLogger(requestId)
    try {
      const expenseId = request.nextUrl.pathname.split('/').pop()
      if (!expenseId) {
        return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 })
      }

      const bodyResult = await readJson(request)
      if ('error' in bodyResult) {
        return bodyResult.error
      }
      const rawBody = bodyResult.data as Record<string, unknown>

    if (shouldUseConvexOnlyWritePath('expenses')) {
      const currentExpense = await getExpenseFromConvex(expenseId, context.clinicId)
      if (!currentExpense) {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
      }

      const { amount_pesos, ...bodyWithoutPesos } = rawBody
      let amountCents = typeof rawBody.amount_cents === 'number' ? Math.round(rawBody.amount_cents) : undefined
      if (typeof amount_pesos === 'number') {
        amountCents = Math.round(amount_pesos * 100)
      }

      const validationResult = expenseDbSchema.partial().safeParse({ ...bodyWithoutPesos, amount_cents: amountCents })
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
        ...restUpdateData
      } = validationResult.data
      const updateData = restUpdateData as ImportedRecord
      void create_asset
      void asset_name
      void asset_useful_life_years

      const categoryResolution = await resolveConvexExpenseCategory(updateData.category_id, updateData.category)
      if (!categoryResolution && updateData.category) {
        return NextResponse.json(
          { error: 'Invalid category', details: `Category "${updateData.category}" not found in system categories` },
          { status: 400 }
        )
      }
      if (categoryResolution?.category_id) updateData.category_id = categoryResolution.category_id
      if (categoryResolution?.category) updateData.category = categoryResolution.category

      updateData.next_recurrence_date = updateData.is_recurring === false
        ? null
        : calculateNextRecurrenceDate(updateData, currentExpense) ?? currentExpense.next_recurrence_date ?? null
      updateData.updated_at = new Date().toISOString()

      if (updateData.related_supply_id || updateData.quantity) {
        const oldSupplyId = currentExpense.related_supply_id
        const newSupplyId = updateData.related_supply_id || currentExpense.related_supply_id
        const oldQuantity = currentExpense.quantity || 0
        const newQuantity = updateData.quantity || currentExpense.quantity || 0

        if (oldSupplyId !== newSupplyId || oldQuantity !== newQuantity) {
          if (oldSupplyId && oldQuantity > 0) {
            const oldSupply = await getConvexDocumentByLegacyId('supplies', oldSupplyId) as ImportedRecord | null
            if (oldSupply) {
              const oldPortions = oldQuantity * portionsPerPresentation(oldSupply)
              await patchConvexDocumentByLegacyId('supplies', oldSupplyId, {
                stock_quantity: Math.max(0, (Number(oldSupply.stock_quantity) || 0) - oldPortions),
                updated_at: new Date().toISOString(),
              })
            }
          }

          if (newSupplyId && newQuantity > 0) {
            const newSupply = await getConvexDocumentByLegacyId('supplies', newSupplyId) as ImportedRecord | null
            if (newSupply) {
              const newPortions = newQuantity * portionsPerPresentation(newSupply)
              const pricePerUnit = Math.round(Number(updateData.amount_cents || currentExpense.amount_cents || 0) / newQuantity)
              await patchConvexDocumentByLegacyId('supplies', newSupplyId, {
                stock_quantity: (Number(newSupply.stock_quantity) || 0) + newPortions,
                last_purchase_price_cents: pricePerUnit,
                last_purchase_date: updateData.expense_date || currentExpense.expense_date,
                updated_at: new Date().toISOString(),
              })
            }
          }
        }
      }

      await patchConvexDocumentByLegacyId('expenses', expenseId, updateData)
      const updatedExpense = await getExpenseFromConvex(expenseId, context.clinicId)
      return NextResponse.json({ data: updatedExpense })
    }

    // Convert amount_pesos to amount_cents BEFORE validation (same pattern as supplies)
    const { amount_pesos, ...bodyWithoutPesos } = rawBody
    let amountCents = typeof rawBody.amount_cents === 'number' ? Math.round(rawBody.amount_cents) : undefined
    if (typeof amount_pesos === 'number') {
      amountCents = Math.round(amount_pesos * 100)
      console.info('[Expense Update] Converting pesos to cents:', {
        amount_pesos,
        amount_cents: amountCents
      })
    }
    const dataToValidate = { ...bodyWithoutPesos, amount_cents: amountCents }

    // Validate input using DB schema (partial update)
    const validationResult = expenseDbSchema.partial().safeParse(dataToValidate)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    // Check if expense exists and get current data
    const { data: currentExpense, error: fetchError } = await supabaseAdmin
      .from('expenses')
      .select('*')
      .eq('id', expenseId)
      .eq('clinic_id', context.clinicId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
      }
      logger.error('expenses.update.fetch_current_failed', { error: fetchError.message, expenseId })
      return NextResponse.json({ error: 'Failed to fetch expense' }, { status: 500 })
    }

    // Extract UI-only fields that don't exist in the database table
    const {
      create_asset,
      asset_name,
      asset_useful_life_years,
      ...updateData
    } = validationResult.data
    // UI-only fields are intentionally ignored in updates
    void create_asset
    void asset_name
    void asset_useful_life_years

    // Resolve category if needed (similar to POST endpoint)
    let resolvedCategoryId = updateData.category_id
    let resolvedCategory = updateData.category

    if (!resolvedCategoryId && resolvedCategory) {
      // Try to find the category by name or display_name using supabaseAdmin
      let { data: cat } = await supabaseAdmin
        .from('categories')
        .select('id, name, display_name')
        .eq('entity_type', 'expense')
        .eq('is_system', true)
        .is('clinic_id', null)
        .is('parent_id', null)
        .ilike('display_name', resolvedCategory)
        .maybeSingle()

      // If not found, try by name
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
      }

      if (cat) {
        resolvedCategoryId = cat.id
        const normalizedCat = cat as CategoryLookup
        resolvedCategory = normalizedCat.display_name || normalizedCat.name || resolvedCategory
      }
    } else if (resolvedCategoryId && !resolvedCategory) {
      // If category_id provided but category string not provided, resolve category name
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

    // Update the data with resolved values
    if (resolvedCategoryId) updateData.category_id = resolvedCategoryId
    if (resolvedCategory) updateData.category = resolvedCategory

    // amount_cents was already converted before validation (no need to transform)

    // Calculate next_recurrence_date for recurring expenses
    const isRecurring = updateData.is_recurring ?? currentExpense.is_recurring
    const recurrenceInterval = updateData.recurrence_interval ?? currentExpense.recurrence_interval
    const expenseDate = updateData.expense_date ?? currentExpense.expense_date
    const recurrenceDay = updateData.recurrence_day ?? currentExpense.recurrence_day

    let nextRecurrenceDate: string | null = currentExpense.next_recurrence_date
    if (isRecurring && recurrenceInterval) {
      // Recalculate next_recurrence_date if recurrence settings changed
      if (updateData.is_recurring !== undefined ||
          updateData.recurrence_interval !== undefined ||
          updateData.recurrence_day !== undefined ||
          updateData.expense_date !== undefined) {
        const baseDate = new Date(expenseDate)
        const dayToUse = recurrenceDay || baseDate.getDate()

        switch (recurrenceInterval) {
          case 'weekly':
            baseDate.setDate(baseDate.getDate() + 7)
            break
          case 'monthly':
            baseDate.setMonth(baseDate.getMonth() + 1)
            const lastDayOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate()
            baseDate.setDate(Math.min(dayToUse, lastDayOfMonth))
            break
          case 'yearly':
            baseDate.setFullYear(baseDate.getFullYear() + 1)
            break
        }
        nextRecurrenceDate = baseDate.toISOString().split('T')[0]
      }
    } else if (!isRecurring) {
      // Clear next_recurrence_date if expense is no longer recurring
      nextRecurrenceDate = null
    }

    // Update expense using supabaseAdmin
    const { data: updatedExpense, error: updateError } = await supabaseAdmin
      .from('expenses')
      .update({
        ...updateData,
        next_recurrence_date: nextRecurrenceDate,
        updated_at: new Date().toISOString()
      })
      .eq('id', expenseId)
      .eq('clinic_id', context.clinicId)
      .select(`
        *,
        supply:related_supply_id(id, name, category),
        asset:related_asset_id(id, name, category)
      `)
      .single()

    if (updateError) {
      logger.error('expenses.update.update_failed', { error: updateError.message, expenseId })
      return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 })
    }

    // Handle inventory updates if supply-related fields changed
    if (updateData.related_supply_id || updateData.quantity) {
      const oldSupplyId = currentExpense.related_supply_id
      const newSupplyId = updateData.related_supply_id || currentExpense.related_supply_id
      const oldQuantity = currentExpense.quantity || 0
      const newQuantity = updateData.quantity || currentExpense.quantity || 0

      // If supply changed or quantity changed, update inventory
      if (oldSupplyId !== newSupplyId || oldQuantity !== newQuantity) {
        
        // Revert old supply inventory if it existed
        if (oldSupplyId && oldQuantity > 0) {
          const { data: oldSupply } = await supabaseAdmin
            .from('supplies')
            .select('*')
            .eq('id', oldSupplyId)
            .single()

          if (oldSupply) {
            const oldPortions = oldQuantity * portionsPerPresentation(oldSupply)
            await updateSupplyInventory(oldSupplyId, {
                stock_quantity: Math.max(0, (oldSupply.stock_quantity || 0) - oldPortions)
              })
          }
        }

        // Add to new supply inventory
        if (newSupplyId && newQuantity > 0) {
          const { data: newSupply } = await supabaseAdmin
            .from('supplies')
            .select('*')
            .eq('id', newSupplyId)
            .single()

          if (newSupply) {
            const newPortions = newQuantity * portionsPerPresentation(newSupply)
            const pricePerUnit = Math.round((updateData.amount_cents || currentExpense.amount_cents) / newQuantity)

            await updateSupplyInventory(newSupplyId, {
                stock_quantity: (newSupply.stock_quantity || 0) + newPortions,
                last_purchase_price_cents: pricePerUnit,
                last_purchase_date: updateData.expense_date || currentExpense.expense_date
              })
          }
        }
      }
    }

    if (updatedExpense && shouldWriteConvexData('expenses')) {
      try {
        await patchConvexDocumentByLegacyId('expenses', expenseId, updatedExpense as Record<string, unknown>)
      } catch (convexError) {
        console.error('[expenses PUT] Convex dual-write failed:', convexError)
      }
    }

    return NextResponse.json({ data: updatedExpense })

    } catch (error) {
      logger.error('expenses.update.unexpected_error', {
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
)

export const DELETE = withPermission('expenses.delete', async (request, context) =>
  withRouteContext(request, async ({ requestId }) => {
    const logger = createRouteLogger(requestId)
    try {
      const expenseId = request.nextUrl.pathname.split('/').pop()
      if (!expenseId) {
        return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 })
      }

    if (shouldUseConvexOnlyWritePath('expenses')) {
      const expense = await getExpenseFromConvex(expenseId, context.clinicId)
      if (!expense) {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
      }

      if (expense.related_supply_id && expense.quantity && expense.auto_processed) {
        const supply = await getConvexDocumentByLegacyId('supplies', expense.related_supply_id) as ImportedRecord | null
        if (supply) {
          const portions = expense.quantity * portionsPerPresentation(supply)
          await patchConvexDocumentByLegacyId('supplies', expense.related_supply_id, {
            stock_quantity: Math.max(0, (Number(supply.stock_quantity) || 0) - portions),
            updated_at: new Date().toISOString(),
          })
        }
      }

      await deleteConvexDocumentByLegacyId('expenses', expenseId)
      return NextResponse.json({ message: 'Expense deleted successfully' })
    }

    // Get expense data before deletion for inventory cleanup
    const { data: expense, error: fetchError } = await supabaseAdmin
      .from('expenses')
      .select('*')
      .eq('id', expenseId)
      .eq('clinic_id', context.clinicId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
      }
      logger.error('expenses.delete.fetch_current_failed', { error: fetchError.message, expenseId })
      return NextResponse.json({ error: 'Failed to fetch expense' }, { status: 500 })
    }

    // Revert inventory changes if this was a supply purchase
    if (expense.related_supply_id && expense.quantity && expense.auto_processed) {
      const { data: supply } = await supabaseAdmin
        .from('supplies')
        .select('*')
        .eq('id', expense.related_supply_id)
        .single()

      if (supply) {
        const portions = expense.quantity * portionsPerPresentation(supply)
        await updateSupplyInventory(expense.related_supply_id, {
            stock_quantity: Math.max(0, (supply.stock_quantity || 0) - portions)
          })
      }
    }

    // Delete the expense using supabaseAdmin
    const { error: deleteError } = await supabaseAdmin
      .from('expenses')
      .delete()
      .eq('id', expenseId)
      .eq('clinic_id', context.clinicId)

    if (deleteError) {
      logger.error('expenses.delete.delete_failed', { error: deleteError.message, expenseId })
      return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 })
    }

    if (shouldWriteConvexData('expenses')) {
      try {
        await deleteConvexDocumentByLegacyId('expenses', expenseId)
      } catch (convexError) {
        console.error('[expenses DELETE] Convex dual-write failed:', convexError)
      }
    }

    return NextResponse.json({ message: 'Expense deleted successfully' })

    } catch (error) {
      logger.error('expenses.delete.unexpected_error', {
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
)
