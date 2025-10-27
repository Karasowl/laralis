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
}

/**
 * Hook para obtener métricas de ROI por campaña individual
 */
export function useCampaignROI(options: UseCampaignROIOptions = {}) {
  const { currentClinic } = useCurrentClinic();
  const clinicId = options.clinicId || currentClinic?.id;

  // Construir query params
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

  const endpoint = `/api/marketing/campaigns/roi?${params.toString()}`;

  const { data, loading, error, execute } = useApi<CampaignROIResponse>(endpoint);

  return {
    campaigns: data?.data || [],
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
