import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Proxy for update/delete using a dynamic route, to match client calls like
// fetch('/api/marketing/platforms/:id', { method: 'PUT' | 'DELETE' })

export async function PUT(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const body = await _req.json().catch(() => ({}))
    const patch: any = {}
    if (body.display_name !== undefined) patch.display_name = body.display_name
    if (body.is_active !== undefined) patch.is_active = body.is_active

    const { data, error } = await supabaseAdmin
      .from('categories')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update marketing platform', message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id

    // Ahora permitimos eliminar TODAS las plataformas, incluyendo las del sistema
    const { error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete marketing platform', message: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

