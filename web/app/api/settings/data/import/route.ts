import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const sendError = (message: string, status: number, code?: string) =>
  NextResponse.json(
    code ? { error: message, errorCode: code } : { error: message },
    { status },
  );


const CHUNK_SIZE = 500;

const chunkArray = <T>(items: T[], size: number): T[][] => {
  if (items.length === 0) return [];
  if (items.length <= size) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

type TableConfig = {
  key: string;
  table: string;
  column: string;
};

const DELETE_ORDER: TableConfig[] = [
  { key: 'service_supplies', table: 'service_supplies', column: 'clinic_id' },
  { key: 'treatments', table: 'treatments', column: 'clinic_id' },
  { key: 'tariffs', table: 'tariffs', column: 'clinic_id' },
  { key: 'expenses', table: 'expenses', column: 'clinic_id' },
  { key: 'patients', table: 'patients', column: 'clinic_id' },
  { key: 'services', table: 'services', column: 'clinic_id' },
  { key: 'supplies', table: 'supplies', column: 'clinic_id' },
  { key: 'assets', table: 'assets', column: 'clinic_id' },
  { key: 'fixed_costs', table: 'fixed_costs', column: 'clinic_id' },
  { key: 'marketing_campaigns', table: 'marketing_campaigns', column: 'clinic_id' },
  { key: 'settings_time', table: 'settings_time', column: 'clinic_id' },
  { key: 'categories', table: 'categories', column: 'clinic_id' },
  { key: 'category_types', table: 'category_types', column: 'clinic_id' },
];

const INSERT_ORDER: TableConfig[] = [
  { key: 'category_types', table: 'category_types', column: 'clinic_id' },
  { key: 'categories', table: 'categories', column: 'clinic_id' },
  { key: 'marketing_campaigns', table: 'marketing_campaigns', column: 'clinic_id' },
  { key: 'services', table: 'services', column: 'clinic_id' },
  { key: 'supplies', table: 'supplies', column: 'clinic_id' },
  { key: 'service_supplies', table: 'service_supplies', column: 'clinic_id' },
  { key: 'assets', table: 'assets', column: 'clinic_id' },
  { key: 'patients', table: 'patients', column: 'clinic_id' },
  { key: 'expenses', table: 'expenses', column: 'clinic_id' },
  { key: 'tariffs', table: 'tariffs', column: 'clinic_id' },
  { key: 'fixed_costs', table: 'fixed_costs', column: 'clinic_id' },
  { key: 'treatments', table: 'treatments', column: 'clinic_id' },
  { key: 'settings_time', table: 'settings_time', column: 'clinic_id' },
];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return sendError('No file provided', 400, 'invalidFormat');
    }

    if (file.size === 0) {
      return sendError('File is empty', 400, 'invalidFormat');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return sendError('File is too large', 413, 'sizeExceeded');
    }

    let payload: any;
    try {
      const text = await file.text();
      payload = JSON.parse(text);
    } catch {
      return sendError('Invalid JSON file', 400, 'invalidFormat');
    }

    if (!payload || typeof payload !== 'object') {
      return sendError('Invalid export format', 400, 'invalidFormat');
    }

    if (payload.version !== 1) {
      return sendError('Unsupported export version', 400, 'invalidFormat');
    }

    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({
      requestedClinicId: null,
      cookieStore,
    });

    if ('error' in clinicContext) {
      return sendError(clinicContext.error.message, clinicContext.error.status);
    }

    const { clinicId } = clinicContext;

    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .select('id, workspace_id')
      .eq('id', clinicId)
      .single();

    if (clinicError || !clinic) {
      return sendError('Clinic not found', 404);
    }

    if (payload.clinicId && payload.clinicId !== clinicId) {
      return sendError('The export belongs to a different clinic.', 409, 'clinicMismatch');
    }

    if (payload.workspaceId && payload.workspaceId !== clinic.workspace_id) {
      return sendError('The export belongs to a different workspace.', 409, 'clinicMismatch');
    }

    // Update workspace metadata if provided
    if (payload.workspace && payload.workspace.id === clinic.workspace_id) {
      const workspaceUpdate: Record<string, unknown> = {};
      const allowedWorkspaceFields = ['name', 'slug', 'description', 'onboarding_completed', 'onboarding_step'];
      for (const key of allowedWorkspaceFields) {
        if (payload.workspace[key] !== undefined) {
          workspaceUpdate[key] = payload.workspace[key];
        }
      }

      if (Object.keys(workspaceUpdate).length > 0) {
        const { error } = await supabaseAdmin
          .from('workspaces')
          .update(workspaceUpdate)
          .eq('id', clinic.workspace_id);

        if (error) {
          console.warn('[data-import] Workspace update failed:', error.message);
        }
      }
    }

    // Update clinic metadata if provided
    if (payload.clinic && payload.clinic.id === clinicId) {
      const clinicUpdate: Record<string, unknown> = {};
      const allowedClinicFields = ['name', 'address', 'phone', 'email', 'is_active', 'timezone', 'slug'];
      for (const key of allowedClinicFields) {
        if (payload.clinic[key] !== undefined) {
          clinicUpdate[key] = payload.clinic[key];
        }
      }

      if (Object.keys(clinicUpdate).length > 0) {
        const { error } = await supabaseAdmin
          .from('clinics')
          .update(clinicUpdate)
          .eq('id', clinicId);

        if (error) {
          console.warn('[data-import] Clinic update failed:', error.message);
        }
      }
    }

    const tables: Record<string, unknown[]> = payload.tables || {};

    const backupData: Record<string, unknown[]> = {};
    for (const config of INSERT_ORDER) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from(config.table)
        .select('*')
        .eq(config.column, clinicId);

      if (existingError) {
        console.error(`[data-import] Failed to backup ${config.table}:`, existingError.message);
        return sendError(existingError.message || `Failed to read ${config.table}`, 500);
      }

      backupData[config.key] = existing ?? [];
    }

    const summary: Record<string, number> = {};

    try {
      for (const config of DELETE_ORDER) {
        const { error } = await supabaseAdmin
          .from(config.table)
          .delete()
          .eq(config.column, clinicId);

        if (error) {
          console.error(`[data-import] Failed deleting from ${config.table}:`, error.message);
          throw new Error(error.message || `Failed deleting existing records from ${config.table}`);
        }
      }

      for (const config of INSERT_ORDER) {
        const rows = Array.isArray(tables[config.key]) ? tables[config.key] : [];
        if (!rows.length) {
          summary[config.key] = 0;
          continue;
        }

        const sanitizedRows = rows.map((row: Record<string, unknown>) => {
          const copy: Record<string, unknown> = { ...row, [config.column]: clinicId };
          if ('workspace_id' in copy) {
            copy.workspace_id = clinic.workspace_id;
          }
          return copy;
        });

        for (const chunk of chunkArray(sanitizedRows, CHUNK_SIZE)) {
          if (chunk.length === 0) continue;
          const { error } = await supabaseAdmin
            .from(config.table)
            .insert(chunk, { returning: 'minimal' });

          if (error) {
            console.error(`[data-import] Failed inserting into ${config.table}:`, error.message);
            throw new Error(error.message || `Failed inserting records into ${config.table}`);
          }
        }

        summary[config.key] = sanitizedRows.length;
      }

      return NextResponse.json({
        success: true,
        summary,
      });
    } catch (error) {
      console.error('[data-import] import failed, restoring previous data:', error);

      for (const config of INSERT_ORDER) {
        const originalRows = backupData[config.key] || [];

        const { error: deleteError } = await supabaseAdmin
          .from(config.table)
          .delete()
          .eq(config.column, clinicId);

        if (deleteError) {
          console.error(`[data-import] restore delete ${config.table} failed:`, deleteError.message);
        }

        if (originalRows.length) {
          const sanitizedOriginal = originalRows.map((row: Record<string, unknown>) => {
            const copy: Record<string, unknown> = { ...row, [config.column]: clinicId };
            if ('workspace_id' in copy) {
              copy.workspace_id = clinic.workspace_id;
            }
            return copy;
          });

          for (const chunk of chunkArray(sanitizedOriginal, CHUNK_SIZE)) {
            if (chunk.length === 0) continue;
            const { error: insertError } = await supabaseAdmin
              .from(config.table)
              .insert(chunk, { returning: 'minimal' });

            if (insertError) {
              console.error(`[data-import] restore insert ${config.table} failed:`, insertError.message);
            }
          }
        }
      }

      const message =
        error instanceof Error ? error.message || 'Import failed' : 'Import failed';

      return sendError(message, 500);
    }
  } catch (error) {
    console.error('[data-import] unexpected error:', error);
    return sendError('Import failed', 500);
  }
}
