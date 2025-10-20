import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'


type Severity = 'high' | 'medium' | 'low'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)

    const clinicId = searchParams.get('clinic_id')

    // Require session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!clinicId) {
      return NextResponse.json({ error: 'clinic_id is required' }, { status: 400 })
    }

    // Fetch supplies for low stock + price change insights
    const { data: supplies, error: suppliesError } = await supabase
      .from('supplies')
      .select('id,name,category,stock_quantity,min_stock_alert,price_per_portion_cents,last_purchase_price_cents')
      .eq('clinic_id', clinicId)

    if (suppliesError) {
      console.error('alerts: supplies error', suppliesError)
    }

    const low_stock = (supplies || [])
      .filter(s => (s.stock_quantity ?? 0) <= (s.min_stock_alert ?? 0))
      .slice(0, 5)
      .map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        stock_quantity: s.stock_quantity ?? 0,
        min_stock_alert: s.min_stock_alert ?? 0,
        clinic_id: clinicId,
        clinic_name: ''
      }))

    const price_changes = (supplies || [])
      .map(s => {
        const prev = s.price_per_portion_cents ?? 0
        const last = s.last_purchase_price_cents ?? 0
        const pct = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0
        return {
          id: s.id,
          name: s.name,
          category: s.category,
          price_per_portion_cents: prev,
          last_purchase_price_cents: last,
          price_change_percentage: pct,
        }
      })
      .filter(p => Math.abs(p.price_change_percentage) >= 15 && p.last_purchase_price_cents > 0)
      .sort((a, b) => Math.abs(b.price_change_percentage) - Math.abs(a.price_change_percentage))
      .slice(0, 3)

    // Budget alert: compare current month expenses vs fixed costs
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const { data: fixedCosts, error: fcError } = await supabase
      .from('fixed_costs')
      .select('amount_cents')
      .eq('clinic_id', clinicId)

    if (fcError) console.warn('alerts: fixed_costs error', fcError)

    const { data: expenses, error: expError } = await supabase
      .from('expenses')
      .select('amount_cents,expense_date')
      .eq('clinic_id', clinicId)
      .gte('expense_date', start.toISOString().slice(0, 10))
      .lte('expense_date', end.toISOString().slice(0, 10))

    if (expError) console.warn('alerts: expenses error', expError)

    const planned = (fixedCosts || []).reduce((sum, r: any) => sum + (r.amount_cents || 0), 0)
    const actual = (expenses || []).reduce((sum, r: any) => sum + (r.amount_cents || 0), 0)
    const variance = actual - planned
    const variancePct = planned > 0 ? Math.round((variance / planned) * 100) : 0

    const budget_alerts: Array<{ type: string; message: string; severity: Severity; details: { planned: number; actual: number; variance: number; percentage: number } }> = []
    if (planned > 0) {
      if (variance > 0) {
        budget_alerts.push({
          type: 'budget',
          message: `Este mes vas ${variancePct}% por encima del presupuesto`,
          severity: variancePct >= 15 ? 'high' : 'medium',
          details: { planned, actual, variance, percentage: variancePct }
        })
      } else if (variance < 0) {
        budget_alerts.push({
          type: 'budget',
          message: `Vas ${Math.abs(variancePct)}% por debajo del presupuesto`,
          severity: 'low',
          details: { planned, actual, variance, percentage: variancePct }
        })
      }
    }

    const by_severity = {
      high: budget_alerts.filter(a => a.severity === 'high').length + low_stock.filter(s => s.stock_quantity === 0).length,
      medium: budget_alerts.filter(a => a.severity === 'medium').length + Math.max(low_stock.length - low_stock.filter(s => s.stock_quantity === 0).length, 0),
      low: price_changes.length,
    }

    const total_alerts = by_severity.high + by_severity.medium + by_severity.low

    return NextResponse.json({
      data: {
        low_stock,
        price_changes,
        budget_alerts,
        summary: { total_alerts, by_severity }
      }
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/expenses/alerts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

