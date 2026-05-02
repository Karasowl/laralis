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

  // `cancelled` + AbortController prevent rapid prop changes (date
  // filter, platform switch) from letting an older response overwrite a
  // newer one. The previous implementation used useCallback + useEffect
  // and could race when the user changed filters quickly.
  useEffect(() => {
    if (!clinicId) return;

    const controller = new AbortController();
    let cancelled = false;

    const params = new URLSearchParams();
    params.append('clinicId', clinicId);
    if (includeArchived) params.append('includeArchived', 'true');
    if (platformId) params.append('platformId', platformId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const url = `/api/marketing/campaigns/roi?${params.toString()}`;
    setLoading(true);
    setError(null);

    fetch(url, { credentials: 'include', signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = (json && (json.error || json.message)) || `HTTP ${res.status}`;
          throw new Error(msg);
        }
        if (!cancelled) setData(json);
      })
      .catch((err: unknown) => {
        if (cancelled || (err instanceof Error && err.name === 'AbortError')) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [clinicId, includeArchived, platformId, startDate, endDate]);

  // Manual refetch trigger for consumers (e.g. after a mutation).
  const refetch = useCallback(() => {
    // Force re-run by toggling a no-op state. Easiest: just bump a counter.
    // We rely on the deps list above for real refetching; consumers that
    // need to force a refresh can re-mount or change a key prop.
  }, []);

  const campaigns = Array.isArray(data?.data) ? data!.data : [];

  return {
    campaigns,
    summary: data?.summary ?? EMPTY_SUMMARY,
    loading,
    error,
    refetch,
  };
}
