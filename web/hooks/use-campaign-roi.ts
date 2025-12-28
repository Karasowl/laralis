import { useApi } from './use-api';
import { useCurrentClinic } from './use-current-clinic';

export interface CampaignROI {
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

export interface CampaignROISummary {
  totalInvestmentCents: number;
  totalRevenueCents: number;
  totalPatientsCount: number;
  averageROI: number;
  totalCampaigns: number;
}

export interface CampaignROIResponse {
  data: CampaignROI[];
  summary: CampaignROISummary;
}

export interface UseCampaignROIOptions {
  clinicId?: string;
  includeArchived?: boolean;
  platformId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Hook para obtener métricas de ROI por campaña individual
 */
export function useCampaignROI(options: UseCampaignROIOptions = {}) {
  const { currentClinic } = useCurrentClinic();
  const clinicId = options.clinicId || currentClinic?.id;

  // Construir query params solo si hay clinicId
  const params = new URLSearchParams();
  if (clinicId) {
    params.append('clinicId', clinicId);
  }
  if (options.includeArchived) {
    params.append('includeArchived', 'true');
  }
  if (options.platformId) {
    params.append('platformId', options.platformId);
  }
  if (options.startDate) {
    params.append('startDate', options.startDate);
  }
  if (options.endDate) {
    params.append('endDate', options.endDate);
  }

  // Solo construir endpoint si hay clinicId válido
  const endpoint = clinicId
    ? `/api/marketing/campaigns/roi?${params.toString()}`
    : null;

  console.log('[useCampaignROI] Hook invoked with:', {
    clinicId,
    includeArchived: options.includeArchived,
    platformId: options.platformId,
    startDate: options.startDate,
    endDate: options.endDate,
    endpoint
  });

  const { data, loading, error, execute } = useApi<CampaignROIResponse>(endpoint, {
    autoFetch: Boolean(clinicId),
  });

  console.log('[useCampaignROI] Response:', {
    hasData: !!data,
    dataKeys: data ? Object.keys(data) : [],
    campaignsCount: data?.data?.length,
    campaigns: data?.data,
    summary: data?.summary,
    loading,
    error
  });

  // Extract campaigns array - ensure it's always an array
  const campaigns = Array.isArray(data?.data) ? data.data : [];

  console.log('[useCampaignROI] Final campaigns array:', {
    isArray: Array.isArray(campaigns),
    length: campaigns.length,
    campaigns
  });

  return {
    campaigns,
    summary: data?.summary || {
      totalInvestmentCents: 0,
      totalRevenueCents: 0,
      totalPatientsCount: 0,
      averageROI: 0,
      totalCampaigns: 0,
    },
    loading,
    error,
    refetch: execute,
  };
}
