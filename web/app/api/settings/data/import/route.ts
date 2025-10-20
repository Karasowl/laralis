import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {

export const dynamic = 'force-dynamic'

  CLINIC_DELETE_SEQUENCE,
  CLINIC_INSERT_SEQUENCE,
  CLINIC_SUMMARY_KEYS,
  MARKETING_STATUS_KEY,
  fetchCampaignStatusHistory,
} from '@/lib/clinic-tables';

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
    for (const config of CLINIC_INSERT_SEQUENCE) {
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

    const backupCampaignIds = (backupData.marketing_campaigns ?? [])
      .map((campaign: any) => campaign?.id)
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
    backupData[MARKETING_STATUS_KEY] = backupCampaignIds.length
      ? await fetchCampaignStatusHistory(backupCampaignIds)
      : [];

    const summary: Record<string, number> = {};
    for (const key of CLINIC_SUMMARY_KEYS) {
      summary[key] = 0;
    }

    try {
      if (backupCampaignIds.length) {
        const { error: historyDeleteError } = await supabaseAdmin
          .from('marketing_campaign_status_history')
          .delete()
          .in('campaign_id', backupCampaignIds);

        if (historyDeleteError) {
          console.error('[data-import] Failed deleting marketing status history:', historyDeleteError.message);
          throw new Error(historyDeleteError.message || 'Failed deleting campaign status history');
        }
      }

      for (const config of CLINIC_DELETE_SEQUENCE) {
        const { error } = await supabaseAdmin
          .from(config.table)
          .delete()
          .eq(config.column, clinicId);

        if (error) {
          console.error(`[data-import] Failed deleting from ${config.table}:`, error.message);
          throw new Error(error.message || `Failed deleting existing records from ${config.table}`);
        }
      }

      for (const config of CLINIC_INSERT_SEQUENCE) {
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

      const marketingStatusRows = Array.isArray(tables[MARKETING_STATUS_KEY])
        ? tables[MARKETING_STATUS_KEY]
        : [];

      summary[MARKETING_STATUS_KEY] = marketingStatusRows.length;

      if (marketingStatusRows.length) {
        for (const chunk of chunkArray(marketingStatusRows, CHUNK_SIZE)) {
          if (chunk.length === 0) continue;
          const { error: historyInsertError } = await supabaseAdmin
            .from('marketing_campaign_status_history')
            .insert(chunk, { returning: 'minimal' });

          if (historyInsertError) {
            console.error('[data-import] Failed inserting campaign status history:', historyInsertError.message);
            throw new Error(historyInsertError.message || 'Failed inserting campaign status history');
          }
        }
      }

      return NextResponse.json({
        success: true,
        summary,
      });
    } catch (error) {
      console.error('[data-import] import failed, restoring previous data:', error);

      if (backupCampaignIds.length) {
        await supabaseAdmin
          .from('marketing_campaign_status_history')
          .delete()
          .in('campaign_id', backupCampaignIds)
          .catch((restoreError) => {
            console.error('[data-import] restore delete history failed:', restoreError?.message);
          });
      }

      for (const config of CLINIC_INSERT_SEQUENCE) {
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

      const backupStatusHistory = backupData[MARKETING_STATUS_KEY] || [];
      if (backupStatusHistory.length) {
        for (const chunk of chunkArray(backupStatusHistory, CHUNK_SIZE)) {
          if (chunk.length === 0) continue;
          const { error: statusRestoreError } = await supabaseAdmin
            .from('marketing_campaign_status_history')
            .insert(chunk, { returning: 'minimal' });

          if (statusRestoreError) {
            console.error('[data-import] restore history insert failed:', statusRestoreError.message);
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
