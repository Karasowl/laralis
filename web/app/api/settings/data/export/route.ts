import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {

export const dynamic = 'force-dynamic'

  CLINIC_DATA_TABLES,
  MARKETING_STATUS_KEY,
  fetchCampaignStatusHistory,
} from '@/lib/clinic-tables';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();

    const clinicContext = await resolveClinicContext({
      requestedClinicId: request.nextUrl.searchParams.get('clinicId'),
      cookieStore,
    });

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status },
      );
    }

    const { clinicId } = clinicContext;

    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .select('*')
      .eq('id', clinicId)
      .single();

    if (clinicError || !clinic) {
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 },
      );
    }

    const workspaceId = clinic.workspace_id;

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    const tables: Record<string, unknown[]> = {};

    for (const config of CLINIC_DATA_TABLES) {
      const { data, error } = await supabaseAdmin
        .from(config.table)
        .select('*')
        .eq(config.column, clinicId);

      if (error) {
        console.error(`[data-export] failed fetching ${config.table}:`, error.message);
        return NextResponse.json(
          { error: `Failed to fetch ${config.table}` },
          { status: 500 },
        );
      }

      tables[config.key] = data ?? [];
    }

    const payload: Record<string, unknown> = {
      version: 1,
      exportedAt: new Date().toISOString(),
      workspaceId,
      clinicId,
      workspace,
      clinic,
      tables,
    };

    const campaigns = Array.isArray(tables.marketing_campaigns) ? tables.marketing_campaigns : [];
    if (campaigns.length > 0) {
      const campaignIds = campaigns
        .map((campaign: any) => campaign?.id)
        .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);

      if (campaignIds.length > 0) {
        tables[MARKETING_STATUS_KEY] = await fetchCampaignStatusHistory(campaignIds);
      } else {
        tables[MARKETING_STATUS_KEY] = [];
      }
    } else {
      tables[MARKETING_STATUS_KEY] = [];
    }

    const json = JSON.stringify(payload, null, 2);
    const mode = request.nextUrl.searchParams.get('mode') === 'backup' ? 'backup' : 'export';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `laralis-${mode}-${timestamp}.json`;

    return new Response(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[data-export] unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to build export' },
      { status: 500 },
    );
  }
}
