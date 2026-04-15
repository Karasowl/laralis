'use client';

import { useCallback, useEffect, useState } from 'react';
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

const EMPTY_SUMMARY: CampaignROISummary = {
  totalInvestmentCents: 0,
  totalRevenueCents: 0,
  totalPatientsCount: 0,
  averageROI: 0,
  totalCampaigns: 0,
};

/**
 * Hook to fetch per-campaign ROI metrics.
 *
 * Bypasses the shared `useApi` abstraction because the auto-fetch effect there
 * was not firing for this specific endpoint (race between clinicId resolution
 * and effect deps left the hook with `loading=false, data=null` forever).
 * This explicit useEffect avoids that whole class of issues.
 */
export function useCampaignROI(options: UseCampaignROIOptions = {}) {
  const { currentClinic } = useCurrentClinic();
  const clinicId = options.clinicId || currentClinic?.id;
  const { includeArchived, platformId, startDate, endDate } = options;

  const [data, setData] = useState<CampaignROIResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!clinicId) return;

    const params = new URLSearchParams();
    params.append('clinicId', clinicId);
    if (includeArchived) params.append('includeArchived', 'true');
    if (platformId) params.append('platformId', platformId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const url = `/api/marketing/campaigns/roi?${params.toString()}`;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (json && (json.error || json.message)) || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [clinicId, includeArchived, platformId, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const campaigns = Array.isArray(data?.data) ? data!.data : [];

  return {
    campaigns,
    summary: data?.summary ?? EMPTY_SUMMARY,
    loading,
    error,
    refetch: fetchData,
  };
}
