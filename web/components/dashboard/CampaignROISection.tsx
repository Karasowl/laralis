'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MarketingROITable } from './MarketingROITable';

interface CampaignROISectionProps {
  /**
   * Clinic id to query. Pass it explicitly from the parent — do NOT rely on
   * useCurrentClinic here: in production /api/clinics may fail with
   * "Invalid payload" inside useCurrentClinic, leaving clinicId undefined
   * and silently preventing this section from ever fetching its data.
   */
  clinicId?: string;
  includeArchived?: boolean;
  platformId?: string;
  startDate?: string;
  endDate?: string;
}

interface ApiCampaign {
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

/**
 * Loads and renders the per-campaign ROI table for the dashboard.
 *
 * Fetches /api/marketing/campaigns/roi inline (no shared hook) because the
 * previous useCampaignROI / useApi-based implementation never fired its
 * useEffect in production despite multiple rewrite attempts (chunk-cache
 * confirmed via React fiber inspection — old code kept being served).
 * Inlining the fetch here guarantees a fresh module hash on next build.
 */
export function CampaignROISection({
  clinicId,
  includeArchived = false,
  platformId,
  startDate,
  endDate,
}: CampaignROISectionProps) {
  const t = useTranslations('dashboardComponents.marketingROI');

  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clinicId) return;

    const params = new URLSearchParams();
    params.set('clinicId', clinicId);
    if (includeArchived) params.set('includeArchived', 'true');
    if (platformId) params.set('platformId', platformId);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    const url = `/api/marketing/campaigns/roi?${params.toString()}`;
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetch(url, { credentials: 'include' })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error((json && (json.error || json.message)) || `HTTP ${res.status}`);
        }
        if (!cancelled) {
          setCampaigns(Array.isArray(json?.data) ? json.data : []);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setCampaigns([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clinicId, includeArchived, platformId, startDate, endDate]);

  if (error) {
    return (
      <div className="p-4 text-center text-red-600">
        {t('error_loading_campaigns')}
      </div>
    );
  }

  const mappedCampaigns = campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    platform: campaign.platform_name,
    investmentCents: campaign.investmentCents,
    revenueCents: campaign.revenueCents,
    patientsCount: campaign.patientsCount,
    roi: campaign.roi,
    avgRevenuePerPatientCents: campaign.avgRevenuePerPatientCents,
    status:
      campaign.status === 'archived'
        ? ('completed' as const)
        : campaign.status === 'inactive'
        ? ('paused' as const)
        : ('active' as const),
  }));

  return (
    <MarketingROITable
      campaigns={mappedCampaigns}
      loading={loading}
      title={t('campaign_roi_analysis')}
      description={t('individual_campaign_performance')}
    />
  );
}
