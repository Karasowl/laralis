import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type TableConfig = {
  key: string;
  table: string;
  column: string;
};

const CLINIC_TABLES: TableConfig[] = [
  { key: 'category_types', table: 'category_types', column: 'clinic_id' },
  { key: 'categories', table: 'categories', column: 'clinic_id' },
  { key: 'marketing_campaigns', table: 'marketing_campaigns', column: 'clinic_id' },
  { key: 'marketing_campaign_status_history', table: 'marketing_campaign_status_history', column: 'clinic_id' },
  { key: 'services', table: 'services', column: 'clinic_id' },
  { key: 'service_supplies', table: 'service_supplies', column: 'clinic_id' },
  { key: 'supplies', table: 'supplies', column: 'clinic_id' },
  { key: 'assets', table: 'assets', column: 'clinic_id' },
  { key: 'patients', table: 'patients', column: 'clinic_id' },
  { key: 'treatments', table: 'treatments', column: 'clinic_id' },
  { key: 'expenses', table: 'expenses', column: 'clinic_id' },
  { key: 'tariffs', table: 'tariffs', column: 'clinic_id' },
  { key: 'fixed_costs', table: 'fixed_costs', column: 'clinic_id' },
  { key: 'settings_time', table: 'settings_time', column: 'clinic_id' },
];

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

    for (const config of CLINIC_TABLES) {
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

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      workspaceId,
      clinicId,
      workspace,
      clinic,
      tables,
    };

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
