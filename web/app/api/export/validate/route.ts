/**
 * POST /api/export/validate
 *
 * Validates an export bundle before import.
 * Checks integrity, compatibility, and data validity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { validateBundle } from '@/lib/export/validator';
import { previewMigration } from '@/lib/export/migrator';
import type { ExportBundle } from '@/lib/export/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minute for validation

/**
 * Maximum bundle size: 100MB
 */
const MAX_BUNDLE_SIZE = 100 * 1024 * 1024;

/**
 * POST handler
 */
export async function POST(request: NextRequest) {
  try {
    // Check content length
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_BUNDLE_SIZE) {
      return NextResponse.json(
        { error: `Bundle too large. Maximum size is ${MAX_BUNDLE_SIZE / (1024 * 1024)}MB` },
        { status: 413 }
      );
    }

    // Create Supabase client for auth
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

    // Parse bundle from request body
    let bundle: ExportBundle;
    try {
      bundle = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON format', details: error instanceof Error ? error.message : String(error) },
        { status: 400 }
      );
    }

    // Basic structure check
    if (!bundle || !bundle.metadata || !bundle.data) {
      return NextResponse.json(
        { error: 'Invalid bundle structure. Missing metadata or data.' },
        { status: 400 }
      );
    }

    // Preview migrations
    const migrationPreview = previewMigration(bundle);

    // Validate bundle
    const validationResult = await validateBundle(bundle);

    // Return validation result with migration info
    return NextResponse.json({
      valid: validationResult.valid,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      stats: validationResult.stats,
      migrationPreview: {
        needsMigration: migrationPreview.needsMigration,
        migrationsToApply: migrationPreview.migrationsToApply,
        migrationsSummary: migrationPreview.migrationsSummary,
        currentVersion: migrationPreview.currentVersion,
        targetVersion: migrationPreview.targetVersion,
      },
      bundleInfo: {
        workspaceName: bundle.metadata.workspaceName,
        exportDate: bundle.metadata.exportDate,
        clinicCount: bundle.metadata.clinicCount,
        recordCounts: bundle.metadata.recordCounts,
      },
    });
  } catch (error) {
    console.error('Validation error:', error);

    return NextResponse.json(
      {
        error: 'Validation failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
