import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { expenseDbSchema, type UpdateExpenseRequest } from '@/lib/types/expenses'
import { withPermission } from '@/lib/middleware/with-permission'

export const dynamic = 'force-dynamic'


export const GET = withPermission('expenses.view', async (request, context) => {
  try {
    const expenseId = request.nextUrl.pathname.split('/').pop()
    if (!expenseId) {
      return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 })
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
      console.error('Error fetching expense:', error)
      return NextResponse.json({ error: 'Failed to fetch expense' }, { status: 500 })
    }

    return NextResponse.json({ data })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const PUT = withPermission('expenses.edit', async (request, context) => {
  try {
    const expenseId = request.nextUrl.pathname.split('/').pop()
    if (!expenseId) {
      return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 })
    }

    const body = await request.json()

    // Convert price_pesos to price_cents BEFORE validation (same pattern as supplies)
    let dataToValidate = { ...body }
    if ('amount_pesos' in body) {
      dataToValidate.amount_cents = Math.round(body.amount_pesos * 100)
      console.log('[Expense Update] Converting pesos to cents:', {
        amount_pesos: body.amount_pesos,
        amount_cents: dataToValidate.amount_cents
      })
      delete dataToValidate.amount_pesos
    }

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
      console.error('Error fetching expense:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch expense' }, { status: 500 })
    }

    // Extract UI-only fields that don't exist in the database table
    const {
      create_asset,
      asset_name,
      asset_useful_life_years,
      ...updateData
    } = validationResult.data as any

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
        resolvedCategory = (cat as any).display_name || (cat as any).name
      }
    } else if (resolvedCategoryId && !resolvedCategory) {
      // If category_id provided but category string not provided, resolve category name
      const { data: cat } = await supabaseAdmin
        .from('categories')
        .select('name, display_name')
        .eq('id', resolvedCategoryId)
        .single()
      if (cat) {
        resolvedCategory = (cat as any).display_name || (cat as any).name
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
      console.error('Error updating expense:', updateError)
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
            .select('stock_quantity, portions_per_presentation')
            .eq('id', oldSupplyId)
            .single()

          if (oldSupply) {
            const oldPortions = oldQuantity * (oldSupply.portions_per_presentation || 1)
            await supabaseAdmin
              .from('supplies')
              .update({
                stock_quantity: Math.max(0, (oldSupply.stock_quantity || 0) - oldPortions)
              })
              .eq('id', oldSupplyId)
          }
        }

        // Add to new supply inventory
        if (newSupplyId && newQuantity > 0) {
          const { data: newSupply } = await supabaseAdmin
            .from('supplies')
            .select('stock_quantity, portions_per_presentation')
            .eq('id', newSupplyId)
            .single()

          if (newSupply) {
            const newPortions = newQuantity * (newSupply.portions_per_presentation || 1)
            const pricePerUnit = Math.round((updateData.amount_cents || currentExpense.amount_cents) / newQuantity)

            await supabaseAdmin
              .from('supplies')
              .update({
                stock_quantity: (newSupply.stock_quantity || 0) + newPortions,
                last_purchase_price_cents: pricePerUnit,
                last_purchase_date: updateData.expense_date || currentExpense.expense_date
              })
              .eq('id', newSupplyId)
          }
        }
      }
    }

    return NextResponse.json({ data: updatedExpense })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const DELETE = withPermission('expenses.delete', async (request, context) => {
  try {
    const expenseId = request.nextUrl.pathname.split('/').pop()
    if (!expenseId) {
      return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 })
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
      console.error('Error fetching expense:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch expense' }, { status: 500 })
    }

    // Revert inventory changes if this was a supply purchase
    if (expense.related_supply_id && expense.quantity && expense.auto_processed) {
      const { data: supply } = await supabaseAdmin
        .from('supplies')
        .select('stock_quantity, portions_per_presentation')
        .eq('id', expense.related_supply_id)
        .single()

      if (supply) {
        const portions = expense.quantity * (supply.portions_per_presentation || 1)
        await supabaseAdmin
          .from('supplies')
          .update({
            stock_quantity: Math.max(0, (supply.stock_quantity || 0) - portions)
          })
          .eq('id', expense.related_supply_id)
      }
    }

    // Delete the expense using supabaseAdmin
    const { error: deleteError } = await supabaseAdmin
      .from('expenses')
      .delete()
      .eq('id', expenseId)
      .eq('clinic_id', context.clinicId)

    if (deleteError) {
      console.error('Error deleting expense:', deleteError)
      return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Expense deleted successfully' })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
