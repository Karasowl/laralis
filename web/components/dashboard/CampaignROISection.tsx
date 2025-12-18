'use client';

import { useCampaignROI } from '@/hooks/use-campaign-roi';
import { useCurrentClinic } from '@/hooks/use-current-clinic';
import { MarketingROITable } from './MarketingROITable';
import { useTranslations } from 'next-intl';

interface CampaignROISectionProps {
  includeArchived?: boolean;
  platformId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Componente que carga y muestra las métricas de ROI por campaña individual
 */
export function CampaignROISection({
  includeArchived = false,
  platformId,
  startDate,
  endDate,
}: CampaignROISectionProps) {
  const t = useTranslations('dashboardComponents.marketingROI');
  const { currentClinic } = useCurrentClinic();

  const { campaigns, summary, loading, error } = useCampaignROI({
    clinicId: currentClinic?.id,
    includeArchived,
    platformId,
    startDate,
    endDate,
  });

  // Mapear campaigns de useCampaignROI a la estructura esperada por MarketingROITable
  const mappedCampaigns = campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    platform: campaign.platform_name,
    investmentCents: campaign.investmentCents,
    revenueCents: campaign.revenueCents,
    patientsCount: campaign.patientsCount,
    roi: campaign.roi,
    avgRevenuePerPatientCents: campaign.avgRevenuePerPatientCents,
    status: campaign.status === 'archived' ? 'completed' as const :
            campaign.status === 'inactive' ? 'paused' as const :
            'active' as const,
  }));

  if (error) {
    return (
      <div className="p-4 text-center text-red-600">
        {t('error_loading_campaigns')}
      </div>
    );
  }

  return (
    <MarketingROITable
      campaigns={mappedCampaigns}
      loading={loading}
      title={t('campaign_roi_analysis')}
      description={t('individual_campaign_performance')}
    />
  );
}
