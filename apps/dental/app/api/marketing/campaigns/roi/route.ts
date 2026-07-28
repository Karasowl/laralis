import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import { verifyClinicAccess } from '@/lib/auth/verify-clinic-access';
import { listConvexDocumentsByClinic, listConvexTable } from '@/lib/convex/server';
import { shouldReturnConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic';

type ImportedRecord = Record<string, any>;

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row;
  return rest;
}

interface CampaignROI {
  id: string;
  name: string;
  platform_id: string;
  platform_name: string;
  investmentCents: number;
  revenueCents: number;
  patientsCount: number;
  roi: number;
  avgRevenuePerPatientCents: number;
  status: 'active' | 'inactive' | 'archived';
}

interface CampaignROIResponse {
  data: CampaignROI[];
  summary: {
    totalInvestmentCents: number;
    totalRevenueCents: number;
    totalPatientsCount: number;
    averageROI: number;
    totalCampaigns: number;
  };
}

/**
 * Convex read branch. Replicates the SAME JS filtering / FK joins / aggregation
 * the Supabase path performs below (Convex has no joins, so FKs are reassembled
 * in JS). Returns a byte-identical response shape with integer-cent parity.
 */
async function getCampaignROIFromConvex(
  clinicId: string,
  options: {
    includeArchived: boolean;
    platformId: string | null;
    startDate: string | null;
    endDate: string | null;
  }
): Promise<CampaignROIResponse> {
  const { includeArchived, platformId, startDate, endDate } = options;

  // 1. Campaigns for this clinic (mirror is_archived + platform_id filters)
  const campaignRows = await listConvexDocumentsByClinic('marketing_campaigns', clinicId, 10000) as ImportedRecord[];
  const campaigns = campaignRows
    .map(normalizeConvexRecord)
    .filter((campaign) => {
      // Mirror Supabase `.eq('is_archived', false)` (excludes NULL too).
      if (!includeArchived && campaign.is_archived !== false) return false;
      if (platformId && campaign.platform_id !== platformId) return false;
      return true;
    });

  if (campaigns.length === 0) {
    return {
      data: [],
      summary: {
        totalInvestmentCents: 0,
        totalRevenueCents: 0,
        totalPatientsCount: 0,
        averageROI: 0,
        totalCampaigns: 0,
      },
    };
  }

  const campaignIds = new Set(campaigns.map((c) => c.id));

  // Resolve platform names via the categories table (FK platform_id -> categories.id)
  const categoryRows = await listConvexTable('categories', 10000) as ImportedRecord[];
  const platformById = new Map<string, ImportedRecord>();
  for (const row of categoryRows) {
    const ids = [row.id, row.legacyId].filter(Boolean).map((id) => String(id));
    for (const id of ids) platformById.set(id, row);
  }

  // 2. Patients linked to these campaigns
  const patientRows = await listConvexDocumentsByClinic('patients', clinicId, 10000) as ImportedRecord[];
  const patients = patientRows
    .map(normalizeConvexRecord)
    .filter((patient) => patient.campaign_id && campaignIds.has(patient.campaign_id));

  // 3. Treatments for those patients (status=completed + optional date range)
  const patientIds = new Set(patients.map((p) => p.id));
  const patientById = new Map<string, ImportedRecord>();
  for (const patient of patients) patientById.set(String(patient.id), patient);

  let treatmentsData: ImportedRecord[] = [];
  if (patientIds.size > 0) {
    const treatmentRows = await listConvexDocumentsByClinic('treatments', clinicId, 10000) as ImportedRecord[];
    treatmentsData = treatmentRows
      .map(normalizeConvexRecord)
      .filter((treatment) => {
        if (treatment.status !== 'completed') return false;
        if (!patientIds.has(treatment.patient_id)) return false;
        const treatmentDate = String(treatment.treatment_date || '');
        if (startDate && treatmentDate < startDate) return false;
        if (endDate && treatmentDate > endDate) return false;
        return true;
      });
  }

  // Aggregate revenue + unique patients with treatments per campaign
  const revenueByCampaign: Record<string, number> = {};
  const patientsWithTreatmentsByCampaign: Record<string, Set<string>> = {};

  treatmentsData.forEach((treatment) => {
    const patient = patientById.get(String(treatment.patient_id));
    if (!patient || !patient.campaign_id) return;

    if (!revenueByCampaign[patient.campaign_id]) {
      revenueByCampaign[patient.campaign_id] = 0;
    }
    revenueByCampaign[patient.campaign_id] += treatment.price_cents || 0;

    if (!patientsWithTreatmentsByCampaign[patient.campaign_id]) {
      patientsWithTreatmentsByCampaign[patient.campaign_id] = new Set();
    }
    patientsWithTreatmentsByCampaign[patient.campaign_id].add(patient.id);
  });

  // 4. Expenses associated to each campaign (optional date range)
  const expenseRows = await listConvexDocumentsByClinic('expenses', clinicId, 10000) as ImportedRecord[];
  const expenses = expenseRows
    .map(normalizeConvexRecord)
    .filter((expense) => {
      if (!expense.campaign_id || !campaignIds.has(expense.campaign_id)) return false;
      const expenseDate = String(expense.expense_date || '');
      if (startDate && expenseDate < startDate) return false;
      if (endDate && expenseDate > endDate) return false;
      return true;
    });

  const investmentByCampaign: Record<string, number> = {};
  expenses.forEach((expense) => {
    if (!expense.campaign_id) return;
    if (!investmentByCampaign[expense.campaign_id]) {
      investmentByCampaign[expense.campaign_id] = 0;
    }
    investmentByCampaign[expense.campaign_id] += expense.amount_cents || 0;
  });

  // 5. ROI per campaign
  const campaignROIs: CampaignROI[] = campaigns.map((campaign) => {
    const investmentCents = investmentByCampaign[campaign.id] || 0;
    const revenueCents = revenueByCampaign[campaign.id] || 0;
    const patientsCount = patientsWithTreatmentsByCampaign[campaign.id]?.size || 0;

    let roi = 0;
    if (investmentCents > 0) {
      roi = ((revenueCents - investmentCents) / investmentCents) * 100;
    }

    const avgRevenuePerPatientCents =
      patientsCount > 0 ? Math.round(revenueCents / patientsCount) : 0;

    let status: 'active' | 'inactive' | 'archived' = 'active';
    if (campaign.is_archived) {
      status = 'archived';
    } else if (!campaign.is_active) {
      status = 'inactive';
    }

    const platform = campaign.platform_id ? platformById.get(String(campaign.platform_id)) : null;

    return {
      id: campaign.id,
      name: campaign.name,
      platform_id: campaign.platform_id,
      platform_name: platform?.display_name || platform?.name || 'Unknown',
      investmentCents,
      revenueCents,
      patientsCount,
      roi,
      avgRevenuePerPatientCents,
      status,
    };
  });

  // 6. Summary
  const summary = {
    totalInvestmentCents: campaignROIs.reduce((sum, c) => sum + c.investmentCents, 0),
    totalRevenueCents: campaignROIs.reduce((sum, c) => sum + c.revenueCents, 0),
    totalPatientsCount: campaignROIs.reduce((sum, c) => sum + c.patientsCount, 0),
    averageROI:
      campaignROIs.length > 0
        ? campaignROIs.reduce((sum, c) => sum + c.roi, 0) / campaignROIs.length
        : 0,
    totalCampaigns: campaignROIs.length,
  };

  return { data: campaignROIs, summary };
}

/**
 * GET /api/marketing/campaigns/roi
 * Calcula el ROI por cada campaña individual
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const searchParams = request.nextUrl.searchParams;

    const clinicContext = await resolveClinicContext({
      requestedClinicId: searchParams.get('clinicId'),
      cookieStore,
    });

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      );
    }

    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'campaigns.view');
    if (forbidden) return forbidden;

    // Opciones de filtrado
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const platformId = searchParams.get('platformId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Convex read branch. The Convex bridge has NO RLS, so before reading we
    // re-assert clinic access explicitly (clinicId originates from a query
    // param and auth here is createClient()+getUser(), not withPermission).
    if (shouldReturnConvexData('marketing_campaigns')) {
      if (!(await verifyClinicAccess(userId, clinicId))) {
        return NextResponse.json({ error: 'You do not have access to this clinic' }, { status: 403 });
      }
      const result = await getCampaignROIFromConvex(clinicId, {
        includeArchived,
        platformId,
        startDate,
        endDate,
      });
      return NextResponse.json(result);
    }

    console.info('[campaigns/roi] API called with:', {
      clinicId,
      includeArchived,
      platformId,
      startDate,
      endDate
    });

    // 1. Obtener todas las campañas
    let campaignsQuery = supabaseAdmin
      .from('marketing_campaigns')
      .select(`
        id,
        name,
        platform_id,
        is_active,
        is_archived,
        platform:platform_id (
          id,
          name,
          display_name
        )
      `)
      .eq('clinic_id', clinicId);

    if (!includeArchived) {
      campaignsQuery = campaignsQuery.eq('is_archived', false);
    }

    if (platformId) {
      campaignsQuery = campaignsQuery.eq('platform_id', platformId);
    }

    const { data: campaigns, error: campaignsError } = await campaignsQuery;

    console.info('[campaigns/roi] Campaigns fetched:', {
      count: campaigns?.length,
      campaigns: campaigns?.map(c => ({ id: c.id, name: c.name, is_active: c.is_active, is_archived: c.is_archived })),
      error: campaignsError
    });

    if (campaignsError) {
      console.error('[campaigns/roi] Error fetching campaigns:', campaignsError);
      return NextResponse.json(
        { error: 'Failed to fetch campaigns' },
        { status: 500 }
      );
    }

    if (!campaigns || campaigns.length === 0) {
      console.info('[campaigns/roi] No campaigns found - returning empty response');
      return NextResponse.json({
        data: [],
        summary: {
          totalInvestmentCents: 0,
          totalRevenueCents: 0,
          totalPatientsCount: 0,
          averageROI: 0,
          totalCampaigns: 0,
        },
      });
    }

    const campaignIds = campaigns.map((c) => c.id);

    // 2. Obtener pacientes por campaña
    const { data: patients, error: patientsError } = await supabaseAdmin
      .from('patients')
      .select('id, campaign_id')
      .eq('clinic_id', clinicId)
      .in('campaign_id', campaignIds);

    console.info('[campaigns/roi] Patients fetched:', {
      count: patients?.length,
      campaignIds,
      samplePatients: patients?.slice(0, 3).map(p => ({ id: p.id, campaign_id: p.campaign_id })),
      error: patientsError
    });

    if (patientsError) {
      console.error('[campaigns/roi] Error fetching patients:', patientsError);
    }

    // Agrupar pacientes por campaña
    const patientsByCampaign: Record<string, string[]> = {};
    (patients || []).forEach((patient) => {
      if (!patient.campaign_id) return;
      if (!patientsByCampaign[patient.campaign_id]) {
        patientsByCampaign[patient.campaign_id] = [];
      }
      patientsByCampaign[patient.campaign_id].push(patient.id);
    });

    // 3. Obtener ingresos por campaña (vía tratamientos de pacientes)
    const allPatientIds = (patients || []).map((p) => p.id);

    let treatmentsData: any[] = [];
    if (allPatientIds.length > 0) {
      let treatmentsQuery = supabaseAdmin
        .from('treatments')
        .select('patient_id, price_cents, treatment_date')
        .eq('clinic_id', clinicId)
        .eq('status', 'completed')
        .in('patient_id', allPatientIds);

      // Apply date filter to treatments
      if (startDate) {
        treatmentsQuery = treatmentsQuery.gte('treatment_date', startDate);
      }
      if (endDate) {
        treatmentsQuery = treatmentsQuery.lte('treatment_date', endDate);
      }

      const { data: treatments, error: treatmentsError } = await treatmentsQuery;

      if (treatmentsError) {
        console.error('Error fetching treatments:', treatmentsError);
      } else {
        treatmentsData = treatments || [];
      }
    }

    // Agrupar ingresos por campaña Y contar pacientes únicos con tratamientos en el período
    const revenueByCampaign: Record<string, number> = {};
    const patientsWithTreatmentsByCampaign: Record<string, Set<string>> = {};

    treatmentsData.forEach((treatment) => {
      const patient = (patients || []).find((p) => p.id === treatment.patient_id);
      if (!patient || !patient.campaign_id) return;

      // Revenue
      if (!revenueByCampaign[patient.campaign_id]) {
        revenueByCampaign[patient.campaign_id] = 0;
      }
      revenueByCampaign[patient.campaign_id] += treatment.price_cents || 0;

      // Unique patients with treatments in period
      if (!patientsWithTreatmentsByCampaign[patient.campaign_id]) {
        patientsWithTreatmentsByCampaign[patient.campaign_id] = new Set();
      }
      patientsWithTreatmentsByCampaign[patient.campaign_id].add(patient.id);
    });

    // 4. Obtener gastos asociados a cada campaña
    let expensesQuery = supabaseAdmin
      .from('expenses')
      .select('campaign_id, amount_cents, expense_date')
      .eq('clinic_id', clinicId)
      .in('campaign_id', campaignIds);

    // Apply date filter to expenses
    if (startDate) {
      expensesQuery = expensesQuery.gte('expense_date', startDate);
    }
    if (endDate) {
      expensesQuery = expensesQuery.lte('expense_date', endDate);
    }

    const { data: expenses, error: expensesError } = await expensesQuery;

    console.info('[campaigns/roi] Expenses query result:', {
      count: expenses?.length,
      totalCents: expenses?.reduce((sum, e) => sum + (e.amount_cents || 0), 0),
      dateRange: { startDate, endDate },
      sample: expenses?.slice(0, 3).map(e => ({ campaign_id: e.campaign_id, date: e.expense_date, cents: e.amount_cents }))
    });

    if (expensesError) {
      console.error('Error fetching expenses:', expensesError);
    }

    // Agrupar gastos por campaña
    const investmentByCampaign: Record<string, number> = {};
    (expenses || []).forEach((expense) => {
      if (!expense.campaign_id) return;
      if (!investmentByCampaign[expense.campaign_id]) {
        investmentByCampaign[expense.campaign_id] = 0;
      }
      investmentByCampaign[expense.campaign_id] += expense.amount_cents || 0;
    });

    // 5. Calcular ROI por campaña
    const campaignROIs: CampaignROI[] = campaigns.map((campaign) => {
      const investmentCents = investmentByCampaign[campaign.id] || 0;
      const revenueCents = revenueByCampaign[campaign.id] || 0;
      // Use patients with treatments in period (filtered), not all patients
      const patientsCount = patientsWithTreatmentsByCampaign[campaign.id]?.size || 0;

      let roi = 0;
      if (investmentCents > 0) {
        roi = ((revenueCents - investmentCents) / investmentCents) * 100;
      }

      const avgRevenuePerPatientCents =
        patientsCount > 0 ? Math.round(revenueCents / patientsCount) : 0;

      // Determinar status
      let status: 'active' | 'inactive' | 'archived' = 'active';
      if (campaign.is_archived) {
        status = 'archived';
      } else if (!campaign.is_active) {
        status = 'inactive';
      }

      return {
        id: campaign.id,
        name: campaign.name,
        platform_id: campaign.platform_id,
        platform_name:
          (campaign.platform as any)?.display_name ||
          (campaign.platform as any)?.name ||
          'Unknown',
        investmentCents,
        revenueCents,
        patientsCount,
        roi,
        avgRevenuePerPatientCents,
        status,
      };
    });

    // 6. Calcular resumen
    const summary = {
      totalInvestmentCents: campaignROIs.reduce(
        (sum, c) => sum + c.investmentCents,
        0
      ),
      totalRevenueCents: campaignROIs.reduce((sum, c) => sum + c.revenueCents, 0),
      totalPatientsCount: campaignROIs.reduce((sum, c) => sum + c.patientsCount, 0),
      averageROI:
        campaignROIs.length > 0
          ? campaignROIs.reduce((sum, c) => sum + c.roi, 0) / campaignROIs.length
          : 0,
      totalCampaigns: campaignROIs.length,
    };

    console.info('[campaigns/roi] Final response:', {
      campaignsCount: campaignROIs.length,
      campaigns: campaignROIs.map(c => ({
        name: c.name,
        investmentCents: c.investmentCents,
        revenueCents: c.revenueCents,
        patientsCount: c.patientsCount,
        roi: c.roi
      })),
      summary
    });

    return NextResponse.json({
      data: campaignROIs,
      summary,
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/marketing/campaigns/roi:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
