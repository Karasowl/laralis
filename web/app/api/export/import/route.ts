/**
 * POST /api/export/import
 *
 * Imports a validated export bundle into a new or existing workspace.
 * Only workspace owners and super_admins can import.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { WorkspaceBundleImporter } from '@/lib/export/importer';
import type { ImportOptions } from '@/lib/export/types';
import { z } from 'zod';
import { readJson, validateSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes timeout for large imports

/**
 * Maximum bundle size: 100MB
 */
const MAX_BUNDLE_SIZE = 100 * 1024 * 1024;

const importOptionsSchema = z.object({
  mode: z.enum(['create', 'merge']).optional(),
  targetWorkspaceId: z.string().uuid().optional(),
  skipValidation: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  overwrite: z.boolean().optional(),
});

const exportBundleSchema = z
  .object({
    metadata: z.object({}).passthrough(),
    data: z.object({}).passthrough(),
  })
  .passthrough();

const importRequestSchema = z.object({
  bundle: exportBundleSchema,
  options: importOptionsSchema.optional(),
});

/**
 * POST handler
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check content length
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_BUNDLE_SIZE) {
      return NextResponse.json(
        { error: `Bundle too large. Maximum size is ${MAX_BUNDLE_SIZE / (1024 * 1024)}MB` },
        { status: 413 }
      );
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

    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const parsed = validateSchema(importRequestSchema, bodyResult.data);
    if ('error' in parsed) {
      return parsed.error;
    }
    const { bundle, options = {} } = parsed.data;

    // Set default import options
    const importOptions: ImportOptions = {
      mode: options.mode || 'create',
      targetWorkspaceId: options.targetWorkspaceId,
      skipValidation: options.skipValidation || false,
      dryRun: options.dryRun || false,
      overwrite: options.overwrite || false,
      userId: user.id,
      userEmail: user.email || '',
    };

    // Create importer
    const importer = new WorkspaceBundleImporter(supabaseAdmin, bundle, importOptions);

    // Execute import
    const result = await importer.import();

    // Log import activity if successful
    if (result.success && result.workspaceId) {
      await supabaseAdmin.from('workspace_activity').insert({
        workspace_id: result.workspaceId,
        user_id: user.id,
        user_email: user.email,
        action: 'import',
        entity_type: 'workspace',
        entity_id: result.workspaceId,
        details: {
          originalWorkspaceId: bundle.metadata.workspaceId,
          originalWorkspaceName: bundle.metadata.workspaceName,
          recordsImported: result.recordsImported,
          clinicsCreated: result.clinicIds?.length || 0,
          duration: result.duration,
        },
      });
    }

    // Return result
    return NextResponse.json({
      success: result.success,
      workspaceId: result.workspaceId,
      clinicIds: result.clinicIds,
      recordsImported: result.recordsImported,
      errors: result.errors,
      warnings: result.warnings,
      duration: result.duration,
    });
  } catch (error) {
    console.error('Import error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Import failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
