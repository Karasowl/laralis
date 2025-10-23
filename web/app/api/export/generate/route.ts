/**
 * POST /api/export/generate
 *
 * Generates a complete export bundle for a workspace.
 * Only workspace owners and super_admins can export.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { WorkspaceExporter, ExportError } from '@/lib/export/exporter';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes timeout for large exports

/**
 * Export request body
 */
interface ExportRequest {
  workspaceId: string;
  options?: {
    includeAuditLogs?: boolean;
    includeHistorical?: boolean;
    compress?: boolean;
  };
}

/**
 * Verify user has permission to export workspace
 */
async function canExportWorkspace(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  workspaceId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Check if user is workspace owner
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('owner_id')
    .eq('id', workspaceId)
    .single();

  if (workspaceError || !workspace) {
    return { allowed: false, reason: 'Workspace not found' };
  }

  if (workspace.owner_id === userId) {
    return { allowed: true };
  }

  // Check if user is super_admin in workspace
  const { data: member, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  if (memberError || !member) {
    return { allowed: false, reason: 'User is not a member of this workspace' };
  }

  if (member.role === 'super_admin') {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Only workspace owners and super_admins can export data',
  };
}

/**
 * POST handler
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request body
    const body: ExportRequest = await request.json();
    const { workspaceId, options = {} } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    // Create Supabase client
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify export permission
    const permission = await canExportWorkspace(supabase, user.id, workspaceId);
    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Forbidden' }, { status: 403 });
    }

    // Create exporter and generate bundle
    const exporter = new WorkspaceExporter(supabaseAdmin, workspaceId, {
      userId: user.id,
      userEmail: user.email || 'unknown',
      includeAuditLogs: options.includeAuditLogs,
      includeHistorical: options.includeHistorical,
      compress: options.compress,
    });

    const { bundle, stats } = await exporter.export();

    // Log export activity
    await supabaseAdmin.from('workspace_activity').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      user_email: user.email,
      action: 'export',
      entity_type: 'workspace',
      entity_id: workspaceId,
      details: {
        recordCount: stats.totalRecords,
        exportDuration: stats.exportDuration,
        bundleSize: stats.bundleSize,
        tables: stats.recordsByTable,
      },
    });

    // Return bundle with stats
    return NextResponse.json(
      {
        success: true,
        bundle,
        stats: {
          totalRecords: stats.totalRecords,
          recordsByTable: stats.recordsByTable,
          exportDuration: Date.now() - startTime,
          bundleSize: stats.bundleSize,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="laralis-backup-${workspaceId}-${Date.now()}.json"`,
        },
      }
    );
  } catch (error) {
    console.error('Export error:', error);

    if (error instanceof ExportError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Export failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
