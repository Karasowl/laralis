import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type ClinicTableConfig = {
  key: string;
  table: string;
  column: string;
};

export const CLINIC_DATA_TABLES: ClinicTableConfig[] = [
  { key: 'category_types', table: 'category_types', column: 'clinic_id' },
  { key: 'categories', table: 'categories', column: 'clinic_id' },
  { key: 'marketing_campaigns', table: 'marketing_campaigns', column: 'clinic_id' },
  { key: 'marketing_platforms', table: 'marketing_platforms', column: 'clinic_id' },
  { key: 'expense_categories', table: 'expense_categories', column: 'clinic_id' },
  { key: 'services', table: 'services', column: 'clinic_id' },
  { key: 'supplies', table: 'supplies', column: 'clinic_id' },
  // service_supplies se elimina automáticamente via CASCADE al eliminar services/supplies
  { key: 'assets', table: 'assets', column: 'clinic_id' },
  { key: 'patients', table: 'patients', column: 'clinic_id' },
  { key: 'expenses', table: 'expenses', column: 'clinic_id' },
  { key: 'tariffs', table: 'tariffs', column: 'clinic_id' },
  { key: 'fixed_costs', table: 'fixed_costs', column: 'clinic_id' },
  { key: 'treatments', table: 'treatments', column: 'clinic_id' },
  { key: 'settings_time', table: 'settings_time', column: 'clinic_id' },
];

export const CLINIC_DELETE_SEQUENCE: ClinicTableConfig[] = [
  // service_supplies se elimina automáticamente via CASCADE cuando se eliminan services/supplies
  { key: 'treatments', table: 'treatments', column: 'clinic_id' },
  { key: 'tariffs', table: 'tariffs', column: 'clinic_id' },
  { key: 'expenses', table: 'expenses', column: 'clinic_id' },
  { key: 'patients', table: 'patients', column: 'clinic_id' },
  { key: 'services', table: 'services', column: 'clinic_id' },
  { key: 'supplies', table: 'supplies', column: 'clinic_id' },
  { key: 'assets', table: 'assets', column: 'clinic_id' },
  { key: 'fixed_costs', table: 'fixed_costs', column: 'clinic_id' },
  { key: 'settings_time', table: 'settings_time', column: 'clinic_id' },
  { key: 'marketing_campaigns', table: 'marketing_campaigns', column: 'clinic_id' },
  { key: 'marketing_platforms', table: 'marketing_platforms', column: 'clinic_id' },
  { key: 'expense_categories', table: 'expense_categories', column: 'clinic_id' },
  { key: 'categories', table: 'categories', column: 'clinic_id' },
  { key: 'category_types', table: 'category_types', column: 'clinic_id' },
];

export const CLINIC_INSERT_SEQUENCE: ClinicTableConfig[] = [
  { key: 'category_types', table: 'category_types', column: 'clinic_id' },
  { key: 'categories', table: 'categories', column: 'clinic_id' },
  { key: 'marketing_platforms', table: 'marketing_platforms', column: 'clinic_id' },
  { key: 'marketing_campaigns', table: 'marketing_campaigns', column: 'clinic_id' },
  { key: 'expense_categories', table: 'expense_categories', column: 'clinic_id' },
  { key: 'services', table: 'services', column: 'clinic_id' },
  { key: 'supplies', table: 'supplies', column: 'clinic_id' },
  // service_supplies no tiene clinic_id, se maneja via relaciones con services/supplies
  { key: 'assets', table: 'assets', column: 'clinic_id' },
  { key: 'patients', table: 'patients', column: 'clinic_id' },
  { key: 'expenses', table: 'expenses', column: 'clinic_id' },
  { key: 'tariffs', table: 'tariffs', column: 'clinic_id' },
  { key: 'fixed_costs', table: 'fixed_costs', column: 'clinic_id' },
  { key: 'treatments', table: 'treatments', column: 'clinic_id' },
  { key: 'settings_time', table: 'settings_time', column: 'clinic_id' },
];

export const MARKETING_STATUS_KEY = 'marketing_campaign_status_history';

export const CLINIC_SUMMARY_KEYS = [
  ...CLINIC_INSERT_SEQUENCE.map((item) => item.key),
  MARKETING_STATUS_KEY,
] as const;

export async function fetchCampaignStatusHistory(campaignIds: string[]) {
  if (!campaignIds.length) {
    return [];
  }
  const { data, error } = await supabaseAdmin
    .from('marketing_campaign_status_history')
    .select('*')
    .in('campaign_id', campaignIds);

  if (error) {
    console.error('[clinic-data] failed fetching campaign status history', error.message);
    throw error;
  }

  return data ?? [];
}

export async function deleteClinicData(clinicId: string) {
  const { data: campaigns, error: campaignError } = await supabaseAdmin
    .from('marketing_campaigns')
    .select('id')
    .eq('clinic_id', clinicId);

  if (campaignError && campaignError.code !== 'PGRST116') {
    throw campaignError;
  }

  const campaignIds = (campaigns ?? [])
    .map((row: any) => row?.id)
    .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);

  if (campaignIds.length) {
    const { error: historyError } = await supabaseAdmin
      .from('marketing_campaign_status_history')
      .delete()
      .in('campaign_id', campaignIds);

    if (historyError && historyError.code !== 'PGRST116') {
      throw historyError;
    }
  }

  for (const { table, column } of CLINIC_DELETE_SEQUENCE) {
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq(column, clinicId);

    if (error && error.code !== 'PGRST116') {
      throw error;
    }
  }
}
