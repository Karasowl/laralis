import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { countWorkspaceCriticalRows, deleteWorkspaceTree } from '@/lib/workspace-lifecycle'
import { readJson, validateSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const lifecycleSchema = z.object({
  action: z.enum(['resume_setup', 'archive', 'delete_incomplete']),
})

function clearWorkspaceCookies(response: NextResponse) {
  response.cookies.set('workspaceId', '', { path: '/', maxAge: 0 })
  response.cookies.set('clinicId', '', { path: '/', maxAge: 0 })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bodyResult = await readJson(request)
    if ('error' in bodyResult) return bodyResult.error

    const parsed = validateSchema(lifecycleSchema, bodyResult.data)
    if ('error' in parsed) return parsed.error

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, owner_id, onboarding_completed, status')
      .eq('id', params.id)
      .eq('owner_id', user.id)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found or unauthorized' }, { status: 404 })
    }

    const now = new Date().toISOString()

    if (parsed.data.action === 'resume_setup') {
      if (workspace.onboarding_completed) {
        return NextResponse.json({ error: 'Completed workspaces do not resume setup' }, { status: 400 })
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from('workspaces')
        .update({
          status: 'draft',
          setup_last_seen_at: now,
          delete_after: null,
          updated_at: now,
        })
        .eq('id', workspace.id)
        .eq('owner_id', user.id)
        .select()
        .single()

      if (updateError) {
        return NextResponse.json({ error: 'Failed to resume setup', details: updateError.message }, { status: 500 })
      }

      const { data: firstClinic } = await supabaseAdmin
        .from('clinics')
        .select('id')
        .eq('workspace_id', workspace.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      const response = NextResponse.json({ success: true, workspace: updated, clinic: firstClinic ?? null })
      response.cookies.set('workspaceId', workspace.id, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      })
      if (firstClinic?.id) {
        response.cookies.set('clinicId', firstClinic.id, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30,
        })
      }
      return response
    }

    if (workspace.onboarding_completed) {
      return NextResponse.json(
        { error: 'Use workspace settings to change completed workspaces' },
        { status: 400 }
      )
    }

    if (parsed.data.action === 'archive') {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('workspaces')
        .update({
          status: 'archived',
          archived_at: now,
          delete_after: null,
          updated_at: now,
        })
        .eq('id', workspace.id)
        .eq('owner_id', user.id)
        .select()
        .single()

      if (updateError) {
        return NextResponse.json({ error: 'Failed to archive workspace', details: updateError.message }, { status: 500 })
      }

      const response = NextResponse.json({ success: true, workspace: updated })
      if (cookieStore.get('workspaceId')?.value === workspace.id) {
        clearWorkspaceCookies(response)
      }
      return response
    }

    const counts = await countWorkspaceCriticalRows(workspace.id)
    if (counts.hasCriticalData) {
      return NextResponse.json(
        {
          error: 'Incomplete workspace contains patient or treatment data. Archive it instead of deleting it.',
          code: 'WORKSPACE_HAS_CRITICAL_DATA',
          counts,
        },
        { status: 409 }
      )
    }

    await deleteWorkspaceTree(workspace.id)

    const response = NextResponse.json({ success: true, deleted: true })
    if (cookieStore.get('workspaceId')?.value === workspace.id) {
      clearWorkspaceCookies(response)
    }
    return response
  } catch (error) {
    console.error('[workspace-lifecycle] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
