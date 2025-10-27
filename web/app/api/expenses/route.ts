import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  expenseFormSchema,
  type CreateExpenseRequest,
  type ExpenseFilters,
  type ExpenseWithRelations
} from '@/lib/types/expenses'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    
    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get clinic_id from query params
    const clinicId = searchParams.get('clinic_id')
    if (!clinicId) {
      return NextResponse.json({ error: 'clinic_id is required' }, { status: 400 })
    }

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
    let query = supabase
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
      console.error('Error fetching expenses:', error)
      return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
    }

    return NextResponse.json({ data: data as ExpenseWithRelations[] })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Extract amount_pesos BEFORE validation (because schema transforms it)
    const originalAmountPesos = body.amount_pesos

    // Validate input
    const validationResult = expenseFormSchema.safeParse(body)
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
      amount_pesos, // This is now already in cents from the schema transform
      ...expenseData
    } = validationResult.data as any

    // Resolve category_id if only category string is provided
    let resolvedCategoryId = category_id
    let resolvedCategory = expenseData.category

    console.log('[Category Resolution] Initial values:', {
      category_id,
      category: expenseData.category
    })

    if (!resolvedCategoryId && resolvedCategory) {
      // Try to find the category by name or display_name
      console.log('[Category Resolution] Attempting to resolve category:', resolvedCategory)

      const { data: cat, error: catError } = await supabase
        .from('categories')
        .select('id, name, display_name')
        .eq('entity_type', 'expense')
        .eq('is_system', true)
        .is('clinic_id', null)
        .is('parent_id', null) // Only parent categories
        .or(`name.ilike.${resolvedCategory},display_name.ilike.${resolvedCategory}`)
        .single()

      console.log('[Category Resolution] Query result:', { cat, catError })

      if (cat) {
        resolvedCategoryId = cat.id
        resolvedCategory = (cat as any).display_name || (cat as any).name
        console.log('[Category Resolution] Resolved to:', { id: resolvedCategoryId, name: resolvedCategory })
      } else {
        console.error('[Category Resolution] Failed to find category:', resolvedCategory, catError)
        return NextResponse.json(
          { error: 'Invalid category', details: `Category "${resolvedCategory}" not found in system categories` },
          { status: 400 }
        )
      }
    } else if (resolvedCategoryId && !resolvedCategory) {
      // If category_id provided but category string missing, resolve name
      const { data: cat } = await supabase
        .from('categories')
        .select('name, display_name')
        .eq('id', resolvedCategoryId)
        .single()
      if (cat) {
        resolvedCategory = (cat as any).display_name || (cat as any).name
      }
    }

    // Use the already transformed amount (schema converts pesos to cents)
    const amountCents = amount_pesos || expenseData.amount_cents || 0

    // Create expense record
    const { data: expense, error: expenseError } = await supabaseAdmin
      .from('expenses')
      .insert({
        ...expenseData,
        amount_cents: amountCents,
        category: resolvedCategory || expenseData.category,
        category_id: resolvedCategoryId || category_id || null,
        clinic_id: body.clinic_id
      })
      .select()
      .single()

    if (expenseError) {
      console.error('Error creating expense:', JSON.stringify(expenseError, null, 2))
      console.error('Expense data being inserted:', {
        ...expenseData,
        amount_cents: amountCents,
        category: resolvedCategory || expenseData.category,
        category_id: resolvedCategoryId || category_id || null,
        clinic_id: body.clinic_id
      })
      return NextResponse.json({ error: 'Failed to create expense', message: expenseError.message }, { status: 500 })
    }

    // Handle integrations
    let updatedExpense = expense

    // Integration 1: Create asset if requested (for equipment purchases)
    if (create_asset && asset_name && asset_useful_life_years) {
      const { data: asset, error: assetError } = await supabaseAdmin
        .from('assets')
        .insert({
          clinic_id: body.clinic_id,
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
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
