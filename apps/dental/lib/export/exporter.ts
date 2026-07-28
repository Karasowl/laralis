/**
 * Export Bundle Generator
 *
 * Queries the database and generates a complete export bundle for a workspace.
 * Respects foreign key order and RLS policies.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ExportBundle,
  ExportOptions,
  ClinicDataBundle,
  Clinic,
  Workspace,
  Organization,
  CategoryType,
  RolePermission,
  WorkspaceUser,
  WorkspaceMember,
} from './types';
import { addChecksum, validateMoneyFields } from './checksum';
import { CURRENT_SCHEMA_VERSION, EXPORT_FORMAT_VERSION } from './migrations';
import {
  getConvexDocumentByLegacyId,
  listConvexDocumentsByClinic,
  listConvexDocumentsByWorkspace,
  listConvexTable,
  decodeConvexValue,
} from '@/lib/convex/server';
import { shouldReturnConvexData } from '@/lib/data-backend';

// Convex bookkeeping fields stripped from exported rows so the bundle mirrors the
// shape Supabase would produce (the importer re-encodes on restore).
const CONVEX_META_FIELDS = [
  '_id',
  '_creationTime',
  'legacyId',
  'legacyTable',
  'convex_created_at',
  'convex_updated_at',
  'convex_snapshot_source',
];

function stripConvexRow(row: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (CONVEX_META_FIELDS.includes(k)) continue;
    clean[k] = v;
  }
  return decodeConvexValue(clean) as Record<string, unknown>;
}

type ExportRow = Record<string, unknown> & {
  id?: string;
};

type DynamicQueryResult<T> = PromiseLike<{
  data: T | null;
  error: unknown;
}>;

type DynamicRowsQuery = DynamicQueryResult<ExportRow[]> & {
  eq(column: string, value: string): DynamicRowsQuery;
  in(column: string, values: string[]): DynamicRowsQuery;
};

type DynamicSupabaseClient = {
  from(table: string): {
    select(columns: string): DynamicRowsQuery;
  };
};

function rowIds(rows: Array<{ id?: unknown }>): string[] {
  return rows
    .map((row) => row.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/**
 * Export Error
 */
export class ExportError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ExportError';
  }
}

/**
 * Exporter Options with defaults
 */
interface ExporterOptions extends ExportOptions {
  userId: string;
  userEmail: string;
}

/**
 * Export Statistics
 */
export interface ExportStats {
  totalRecords: number;
  recordsByTable: Record<string, number>;
  exportDuration: number; // milliseconds
  bundleSize: number; // bytes (estimated)
}

/**
 * Workspace Data Exporter
 *
 * Handles the complete export of a workspace including all clinics and data.
 */
export class WorkspaceExporter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabase: SupabaseClient<any, any, any>;
  private workspaceId: string;
  private options: ExporterOptions;
  private stats: ExportStats;
  // In convex-only mode the Supabase client is unreachable (.from() throws). Read every
  // table from Convex instead. Default mode stays supabase (flag resolves to false).
  private convexRead: boolean = shouldReturnConvexData('export');

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any, any, any>,
    workspaceId: string,
    options: ExporterOptions
  ) {
    this.supabase = supabase;
    this.workspaceId = workspaceId;
    this.options = options;
    this.stats = {
      totalRecords: 0,
      recordsByTable: {},
      exportDuration: 0,
      bundleSize: 0,
    };
  }

  /**
   * Export complete workspace to bundle
   */
  async export(): Promise<{ bundle: ExportBundle; stats: ExportStats }> {
    const startTime = Date.now();

    try {
      // Level 1: Global data
      const workspace = await this.fetchWorkspace();
      const organizations = await this.fetchOrganizations();
      const categoryTypes = await this.fetchCategoryTypes();
      const rolePermissions = await this.fetchRolePermissions();

      // Level 2: Workspace users
      const workspaceUsers = await this.fetchWorkspaceUsers();
      const workspaceMembers = await this.fetchWorkspaceMembers();
      const customRoleTemplates = await this.fetchCustomRoleTemplates();

      // Level 3+: Clinics with all nested data
      const clinics = await this.fetchClinics();

      // Build bundle without checksum
      const bundleWithoutChecksum = {
        metadata: {
          version: EXPORT_FORMAT_VERSION,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          exportDate: new Date().toISOString(),
          appVersion: '1.0.0', // TODO: Get from package.json
          exportedBy: {
            userId: this.options.userId,
            email: this.options.userEmail,
          },
          workspaceId: this.workspaceId,
          workspaceName: workspace.name,
          clinicCount: clinics.length,
          recordCounts: this.stats.recordsByTable,
          checksum: '', // Will be added by addChecksum
        },
        data: {
          workspace,
          organizations,
          categoryTypes,
          rolePermissions,
          workspaceUsers,
          workspaceMembers,
          customRoleTemplates,
          clinics,
        },
        migrations: {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          appliedMigrations: [], // TODO: Get from migrations table
        },
      };

      // Add checksum
      const bundle = await addChecksum(bundleWithoutChecksum);

      // Validate money fields
      const moneyErrors = validateMoneyFields(bundle);
      if (moneyErrors.length > 0) {
        throw new ExportError(
          'Money validation failed: ' + moneyErrors.join(', '),
          'MONEY_VALIDATION_FAILED',
          { errors: moneyErrors }
        );
      }

      // Calculate stats
      this.stats.exportDuration = Date.now() - startTime;
      this.stats.bundleSize = JSON.stringify(bundle).length;

      return { bundle, stats: this.stats };
    } catch (error) {
      if (error instanceof ExportError) {
        throw error;
      }
      throw new ExportError(
        `Export failed: ${error instanceof Error ? error.message : String(error)}`,
        'EXPORT_FAILED',
        { error, workspaceId: this.workspaceId }
      );
    }
  }

  /**
   * Fetch workspace
   */
  private async fetchWorkspace(): Promise<Workspace> {
    if (this.convexRead) {
      const doc = (await getConvexDocumentByLegacyId('workspaces', this.workspaceId)) as Record<
        string,
        unknown
      > | null;
      if (!doc) {
        throw new ExportError('Workspace not found', 'WORKSPACE_NOT_FOUND', {
          workspaceId: this.workspaceId,
        });
      }
      this.recordCount('workspaces', 1);
      return stripConvexRow(doc) as unknown as Workspace;
    }

    const { data, error } = await this.supabase
      .from('workspaces')
      .select('*')
      .eq('id', this.workspaceId)
      .single();

    if (error) {
      throw new ExportError('Failed to fetch workspace', 'FETCH_WORKSPACE_FAILED', { error });
    }

    if (!data) {
      throw new ExportError('Workspace not found', 'WORKSPACE_NOT_FOUND', {
        workspaceId: this.workspaceId,
      });
    }

    this.recordCount('workspaces', 1);
    return data as Workspace;
  }

  /**
   * Fetch organizations (legacy)
   */
  private async fetchOrganizations(): Promise<Organization[]> {
    if (this.convexRead) {
      const rows = (await listConvexTable('organizations')) as Record<string, unknown>[];
      const cleaned = rows.map((r) => stripConvexRow(r));
      this.recordCount('organizations', cleaned.length);
      return cleaned as unknown as Organization[];
    }

    const { data, error } = await this.supabase.from('organizations').select('*');

    if (error) {
      throw new ExportError('Failed to fetch organizations', 'FETCH_ORGANIZATIONS_FAILED', {
        error,
      });
    }

    this.recordCount('organizations', data?.length || 0);
    return (data as Organization[]) || [];
  }

  /**
   * Fetch category types
   */
  private async fetchCategoryTypes(): Promise<CategoryType[]> {
    if (this.convexRead) {
      const rows = (await listConvexTable('category_types')) as Record<string, unknown>[];
      const cleaned = rows.map((r) => stripConvexRow(r));
      this.recordCount('category_types', cleaned.length);
      return cleaned as unknown as CategoryType[];
    }

    const { data, error } = await this.supabase.from('category_types').select('*');

    if (error) {
      throw new ExportError('Failed to fetch category types', 'FETCH_CATEGORY_TYPES_FAILED', {
        error,
      });
    }

    this.recordCount('category_types', data?.length || 0);
    return (data as CategoryType[]) || [];
  }

  /**
   * Fetch role permissions
   */
  private async fetchRolePermissions(): Promise<RolePermission[]> {
    if (this.convexRead) {
      const rows = (await listConvexTable('role_permissions')) as Record<string, unknown>[];
      const cleaned = rows.map((r) => stripConvexRow(r));
      this.recordCount('role_permissions', cleaned.length);
      return cleaned as unknown as RolePermission[];
    }

    const { data, error } = await this.supabase.from('role_permissions').select('*');

    if (error) {
      throw new ExportError(
        'Failed to fetch role permissions',
        'FETCH_ROLE_PERMISSIONS_FAILED',
        { error }
      );
    }

    this.recordCount('role_permissions', data?.length || 0);
    return (data as RolePermission[]) || [];
  }

  /**
   * Fetch workspace users
   */
  private async fetchWorkspaceUsers(): Promise<WorkspaceUser[]> {
    if (this.convexRead) {
      const rows = (await listConvexDocumentsByWorkspace(
        'workspace_users',
        this.workspaceId
      )) as Record<string, unknown>[];
      const cleaned = rows.map((r) => stripConvexRow(r));
      this.recordCount('workspace_users', cleaned.length);
      return cleaned as unknown as WorkspaceUser[];
    }

    const { data, error } = await this.supabase
      .from('workspace_users')
      .select('*')
      .eq('workspace_id', this.workspaceId);

    if (error) {
      throw new ExportError('Failed to fetch workspace users', 'FETCH_WORKSPACE_USERS_FAILED', {
        error,
      });
    }

    this.recordCount('workspace_users', data?.length || 0);
    return (data as WorkspaceUser[]) || [];
  }

  /**
   * Fetch workspace members
   */
  private async fetchWorkspaceMembers(): Promise<WorkspaceMember[]> {
    if (this.convexRead) {
      const rows = (await listConvexDocumentsByWorkspace(
        'workspace_members',
        this.workspaceId
      )) as Record<string, unknown>[];
      const cleaned = rows.map((r) => stripConvexRow(r));
      this.recordCount('workspace_members', cleaned.length);
      return cleaned as unknown as WorkspaceMember[];
    }

    const { data, error } = await this.supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', this.workspaceId);

    if (error) {
      throw new ExportError(
        'Failed to fetch workspace members',
        'FETCH_WORKSPACE_MEMBERS_FAILED',
        { error }
      );
    }

    this.recordCount('workspace_members', data?.length || 0);
    return (data as WorkspaceMember[]) || [];
  }

  private async fetchCustomRoleTemplates() {
    return this.fetchRowsByWorkspace('custom_role_templates', this.workspaceId);
  }

  /**
   * Fetch all clinics with nested data
   */
  private async fetchClinics(): Promise<ClinicDataBundle[]> {
    let clinicsData: Clinic[] | null;

    if (this.convexRead) {
      const rows = (await listConvexDocumentsByWorkspace(
        'clinics',
        this.workspaceId
      )) as Record<string, unknown>[];
      clinicsData = rows.map((r) => stripConvexRow(r)) as unknown as Clinic[];
    } else {
      const { data, error } = await this.supabase
        .from('clinics')
        .select('*')
        .eq('workspace_id', this.workspaceId);

      if (error) {
        throw new ExportError('Failed to fetch clinics', 'FETCH_CLINICS_FAILED', { error });
      }
      clinicsData = data as Clinic[] | null;
    }

    this.recordCount('clinics', clinicsData?.length || 0);

    if (!clinicsData || clinicsData.length === 0) {
      return [];
    }

    // Fetch data for each clinic
    const clinicBundles: ClinicDataBundle[] = [];

    for (const clinic of clinicsData) {
      const clinicBundle = await this.fetchClinicData(clinic);
      clinicBundles.push(clinicBundle);
    }

    return clinicBundles;
  }

  /**
   * Fetch all data for a single clinic
   */
  private async fetchClinicData(clinic: Clinic): Promise<ClinicDataBundle> {
    const clinicId = clinic.id;
    console.log(`[Regular Export] Fetching data for clinic: ${clinic.name} (${clinicId})`);

    // Fetch all clinic data in parallel for performance
    const [
      settingsTime,
      customCategories,
      categories,
      patientSources,
      invitations,
      clinicUsers,
      assets,
      supplies,
      fixedCosts,
      services,
      serviceSupplies,
      marketingCampaigns,
      marketingCampaignStatusHistory,
      marketingCampaignChannels,
      leads,
      inboxConversations,
      patients,
      treatments,
      expenses,
      publicBookingServices,
      publicBookings,
      bookingBlockedSlots,
      workspaceActivity,
      // AI Assistant Data (Migrations 50-54)
      actionLogs,
      clinicGoogleCalendar,
      chatSessions,
      // Notifications & Reminders
      emailNotifications,
      smsNotifications,
      whatsappTemplates,
      whatsappNotifications,
      scheduledReminders,
      pushSubscriptions,
      pushNotifications,
      notificationRetryQueue,
      // Prescriptions & Medications
      medications,
      prescriptions,
      // Quotes
      quotes,
    ] = await Promise.all([
      this.fetchSettingsTime(clinicId),
      this.fetchCustomCategories(clinicId),
      this.fetchCategories(clinicId),
      this.fetchPatientSources(clinicId),
      this.fetchInvitations(clinicId),
      this.fetchClinicUsers(clinicId),
      this.fetchAssets(clinicId),
      this.fetchSupplies(clinicId),
      this.fetchFixedCosts(clinicId),
      this.fetchServices(clinicId),
      this.fetchServiceSupplies(clinicId),
      this.fetchMarketingCampaigns(clinicId),
      this.fetchMarketingCampaignStatusHistory(clinicId),
      this.fetchRowsByClinic('marketing_campaign_channels', clinicId),
      this.fetchRowsByClinic('leads', clinicId),
      this.fetchRowsByClinic('inbox_conversations', clinicId),
      this.fetchPatients(clinicId),
      this.fetchTreatments(clinicId),
      this.fetchExpenses(clinicId),
      this.fetchRowsByClinic('public_booking_services', clinicId),
      this.fetchRowsByClinic('public_bookings', clinicId),
      this.fetchRowsByClinic('booking_blocked_slots', clinicId),
      this.options.includeAuditLogs ? this.fetchWorkspaceActivity(clinicId) : [],
      // AI Assistant Data
      this.fetchActionLogs(clinicId),
      this.fetchClinicGoogleCalendar(clinicId),
      this.fetchChatSessions(clinicId),
      // Notifications & Reminders
      this.fetchEmailNotifications(clinicId),
      this.fetchSmsNotifications(clinicId),
      this.fetchRowsByClinic('whatsapp_templates', clinicId),
      this.fetchRowsByClinic('whatsapp_notifications', clinicId),
      this.fetchScheduledReminders(clinicId),
      this.fetchPushSubscriptions(clinicId),
      this.fetchPushNotifications(clinicId),
      this.fetchRowsByClinic('notification_retry_queue', clinicId),
      // Prescriptions & Medications
      this.fetchMedications(clinicId),
      this.fetchPrescriptions(clinicId),
      // Quotes
      this.fetchQuotes(clinicId),
    ]);

    // Fetch dependent data that needs IDs from parent tables
    const sessionIds = rowIds(chatSessions);
    const chatMessages = await this.fetchChatMessages(clinicId, sessionIds);

    const messageIds = rowIds(chatMessages);
    const aiFeedback = await this.fetchAiFeedback(clinicId, messageIds);

    const prescriptionIds = rowIds(prescriptions);
    const prescriptionItems = await this.fetchPrescriptionItems(prescriptionIds);

    const quoteIds = rowIds(quotes);
    const quoteItems = await this.fetchQuoteItems(quoteIds);

    const inboxConversationIds = rowIds(inboxConversations);
    const inboxMessages = await this.fetchRowsByIds(
      'inbox_messages',
      'conversation_id',
      inboxConversationIds
    );

    // Calculate record counts for this clinic
    const recordCounts: Record<string, number> = {
      settings_time: settingsTime ? 1 : 0,
      custom_categories: customCategories.length,
      categories: categories.length,
      patient_sources: patientSources.length,
      invitations: invitations.length,
      clinic_users: clinicUsers.length,
      assets: assets.length,
      supplies: supplies.length,
      fixed_costs: fixedCosts.length,
      services: services.length,
      service_supplies: serviceSupplies.length,
      marketing_campaigns: marketingCampaigns.length,
      marketing_campaign_status_history: marketingCampaignStatusHistory.length,
      marketing_campaign_channels: marketingCampaignChannels.length,
      leads: leads.length,
      inbox_conversations: inboxConversations.length,
      inbox_messages: inboxMessages.length,
      patients: patients.length,
      treatments: treatments.length,
      expenses: expenses.length,
      public_booking_services: publicBookingServices.length,
      public_bookings: publicBookings.length,
      booking_blocked_slots: bookingBlockedSlots.length,
      workspace_activity: workspaceActivity?.length || 0,
      // AI Assistant Data
      action_logs: actionLogs.length,
      clinic_google_calendar: clinicGoogleCalendar ? 1 : 0,
      chat_sessions: chatSessions.length,
      chat_messages: chatMessages.length,
      ai_feedback: aiFeedback.length,
      // Notifications & Reminders
      email_notifications: emailNotifications.length,
      sms_notifications: smsNotifications.length,
      whatsapp_templates: whatsappTemplates.length,
      whatsapp_notifications: whatsappNotifications.length,
      scheduled_reminders: scheduledReminders.length,
      push_subscriptions: pushSubscriptions.length,
      push_notifications: pushNotifications.length,
      notification_retry_queue: notificationRetryQueue.length,
      // Prescriptions & Medications
      medications: medications.length,
      prescriptions: prescriptions.length,
      prescription_items: prescriptionItems.length,
      // Quotes
      quotes: quotes.length,
      quote_items: quoteItems.length,
    };

    console.log(`[Regular Export] Clinic ${clinic.name} counts:`, {
      patients: patients.length,
      treatments: treatments.length,
      services: services.length,
      expenses: expenses.length,
      prescriptions: prescriptions.length,
      quotes: quotes.length,
    });

    return {
      clinic,
      settingsTime,
      customCategories,
      categories,
      patientSources,
      invitations,
      clinicUsers,
      assets,
      supplies,
      fixedCosts,
      services,
      serviceSupplies,
      marketingCampaigns,
      marketingCampaignStatusHistory,
      marketingCampaignChannels,
      leads,
      inboxConversations,
      inboxMessages,
      patients,
      treatments,
      expenses,
      publicBookingServices,
      publicBookings,
      bookingBlockedSlots,
      workspaceActivity,
      // AI Assistant Data
      actionLogs,
      clinicGoogleCalendar,
      chatSessions,
      chatMessages,
      aiFeedback,
      // Notifications & Reminders
      emailNotifications,
      smsNotifications,
      whatsappTemplates,
      whatsappNotifications,
      scheduledReminders,
      pushSubscriptions,
      pushNotifications,
      notificationRetryQueue,
      // Prescriptions & Medications
      medications,
      prescriptions,
      prescriptionItems,
      // Quotes
      quotes,
      quoteItems,
      recordCounts,
    };
  }

  // Helper methods for fetching individual tables
  // These methods follow the same pattern and respect RLS

  private async fetchSettingsTime(clinicId: string) {
    if (this.convexRead) {
      const rows = (await listConvexDocumentsByClinic('settings_time', clinicId)) as Record<
        string,
        unknown
      >[];
      const data = rows.length > 0 ? stripConvexRow(rows[0]) : null;
      if (data) this.recordCount('settings_time', 1);
      return data || null;
    }
    const { data } = await this.supabase
      .from('settings_time')
      .select('*')
      .eq('clinic_id', clinicId)
      .single();
    if (data) this.recordCount('settings_time', 1);
    return data || null;
  }

  private async fetchCustomCategories(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('custom_categories', clinicId);
    const { data } = await this.supabase
      .from('custom_categories')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('custom_categories', data?.length || 0);
    return data || [];
  }

  private async fetchCategories(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('categories', clinicId);
    const { data } = await this.supabase.from('categories').select('*').eq('clinic_id', clinicId);
    this.recordCount('categories', data?.length || 0);
    return data || [];
  }

  private async fetchPatientSources(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('patient_sources', clinicId);
    const { data } = await this.supabase
      .from('patient_sources')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('patient_sources', data?.length || 0);
    return data || [];
  }

  private async fetchInvitations(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('invitations', clinicId);
    const { data } = await this.supabase.from('invitations').select('*').eq('clinic_id', clinicId);
    this.recordCount('invitations', data?.length || 0);
    return data || [];
  }

  private async fetchClinicUsers(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('clinic_users', clinicId);
    const { data } = await this.supabase.from('clinic_users').select('*').eq('clinic_id', clinicId);
    this.recordCount('clinic_users', data?.length || 0);
    return data || [];
  }

  private async fetchAssets(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('assets', clinicId);
    const { data, error } = await this.supabase.from('assets').select('*').eq('clinic_id', clinicId);
    if (error) console.error('[Regular Export] Assets error:', error);
    this.recordCount('assets', data?.length || 0);
    return data || [];
  }

  private async fetchSupplies(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('supplies', clinicId);
    const { data, error } = await this.supabase.from('supplies').select('*').eq('clinic_id', clinicId);
    if (error) console.error('[Regular Export] Supplies error:', error);
    this.recordCount('supplies', data?.length || 0);
    return data || [];
  }

  private async fetchFixedCosts(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('fixed_costs', clinicId);
    const { data, error } = await this.supabase.from('fixed_costs').select('*').eq('clinic_id', clinicId);
    if (error) console.error('[Regular Export] Fixed costs error:', error);
    this.recordCount('fixed_costs', data?.length || 0);
    return data || [];
  }

  private async fetchServices(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('services', clinicId);
    const { data, error } = await this.supabase.from('services').select('*').eq('clinic_id', clinicId);
    if (error) console.error('[Regular Export] Services error:', error);
    this.recordCount('services', data?.length || 0);
    return data || [];
  }

  private async fetchServiceSupplies(clinicId: string) {
    if (this.convexRead) {
      // Indirect: resolve this clinic's service ids, then filter service_supplies by service_id.
      const serviceRows = (await listConvexDocumentsByClinic('services', clinicId)) as Record<
        string,
        unknown
      >[];
      const serviceIds = new Set(rowIds(serviceRows));
      if (serviceIds.size === 0) {
        this.recordCount('service_supplies', 0);
        return [];
      }
      const rows = ((await listConvexTable('service_supplies')) as Record<string, unknown>[]).filter(
        (r) => typeof r.service_id === 'string' && serviceIds.has(r.service_id)
      );
      const cleaned = rows.map((r) => stripConvexRow(r));
      this.recordCount('service_supplies', cleaned.length);
      return cleaned;
    }

    const { data: services, error: servicesError } = await this.supabase
      .from('services')
      .select('id')
      .eq('clinic_id', clinicId);

    if (servicesError) {
      console.error('[Regular Export] Service supplies service lookup error:', servicesError);
      return [];
    }

    const serviceIds = rowIds(services || []);
    if (serviceIds.length === 0) {
      this.recordCount('service_supplies', 0);
      return [];
    }

    const { data, error } = await this.supabase
      .from('service_supplies')
      .select('*')
      .in('service_id', serviceIds);
    if (error) console.error('[Regular Export] Service supplies error:', error);
    this.recordCount('service_supplies', data?.length || 0);
    return data || [];
  }

  // DEPRECATED (2025-11-17): Tariffs removed - discounts now in services table
  // Migration 47 moved discount fields to services table
  // private async fetchTariffs(clinicId: string) {
  //   const { data } = await this.supabase.from('tariffs').select('*').eq('clinic_id', clinicId);
  //   this.recordCount('tariffs', data?.length || 0);
  //   return data || [];
  // }

  private async fetchMarketingCampaigns(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('marketing_campaigns', clinicId);
    const { data } = await this.supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('marketing_campaigns', data?.length || 0);
    return data || [];
  }

  private async fetchMarketingCampaignStatusHistory(clinicId: string) {
    if (this.convexRead) {
      // Indirect: resolve this clinic's campaign ids, then filter status history by campaign_id.
      const campaignRows = (await listConvexDocumentsByClinic(
        'marketing_campaigns',
        clinicId
      )) as Record<string, unknown>[];
      const campaignIds = new Set(rowIds(campaignRows));
      if (campaignIds.size === 0) {
        this.recordCount('marketing_campaign_status_history', 0);
        return [];
      }
      const rows = (
        (await listConvexTable('marketing_campaign_status_history')) as Record<string, unknown>[]
      ).filter((r) => typeof r.campaign_id === 'string' && campaignIds.has(r.campaign_id));
      const cleaned = rows.map((r) => stripConvexRow(r));
      this.recordCount('marketing_campaign_status_history', cleaned.length);
      return cleaned;
    }

    // Join with campaigns to filter by clinic
    const { data } = await this.supabase
      .from('marketing_campaign_status_history')
      .select('*, marketing_campaigns!inner(clinic_id)')
      .eq('marketing_campaigns.clinic_id', clinicId);
    this.recordCount('marketing_campaign_status_history', data?.length || 0);
    return data || [];
  }

  private async fetchPatients(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('patients', clinicId);
    const { data, error } = await this.supabase.from('patients').select('*').eq('clinic_id', clinicId);
    if (error) console.error('[Regular Export] Patients error:', error);
    this.recordCount('patients', data?.length || 0);
    return data || [];
  }

  private async fetchTreatments(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('treatments', clinicId);
    const { data, error } = await this.supabase.from('treatments').select('*').eq('clinic_id', clinicId);
    if (error) console.error('[Regular Export] Treatments error:', error);
    this.recordCount('treatments', data?.length || 0);
    return data || [];
  }

  private async fetchExpenses(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('expenses', clinicId);
    const { data, error } = await this.supabase.from('expenses').select('*').eq('clinic_id', clinicId);
    if (error) console.error('[Regular Export] Expenses error:', error);
    this.recordCount('expenses', data?.length || 0);
    return data || [];
  }

  private async fetchWorkspaceActivity(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('workspace_activity', clinicId);
    const { data } = await this.supabase
      .from('workspace_activity')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('workspace_activity', data?.length || 0);
    return data || [];
  }

  // =========================================================================
  // AI ASSISTANT TABLES (Migrations 50-54)
  // =========================================================================

  private async fetchActionLogs(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('action_logs', clinicId);
    const { data } = await this.supabase
      .from('action_logs')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('action_logs', data?.length || 0);
    return data || [];
  }

  private async fetchClinicGoogleCalendar(clinicId: string) {
    if (this.convexRead) {
      const rows = (await listConvexDocumentsByClinic('clinic_google_calendar', clinicId)) as Record<
        string,
        unknown
      >[];
      const data = rows.length > 0 ? stripConvexRow(rows[0]) : null;
      if (data) this.recordCount('clinic_google_calendar', 1);
      return data || null;
    }
    const { data } = await this.supabase
      .from('clinic_google_calendar')
      .select('*')
      .eq('clinic_id', clinicId)
      .single();
    if (data) this.recordCount('clinic_google_calendar', 1);
    return data || null;
  }

  private async fetchChatSessions(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('chat_sessions', clinicId);
    const { data } = await this.supabase
      .from('chat_sessions')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('chat_sessions', data?.length || 0);
    return data || [];
  }

  private async fetchChatMessages(clinicId: string, sessionIds: string[]) {
    if (sessionIds.length === 0) return [];
    if (this.convexRead) {
      return this.fetchConvexRowsByIds('chat_messages', 'session_id', sessionIds);
    }
    const { data } = await this.supabase
      .from('chat_messages')
      .select('*')
      .in('session_id', sessionIds);
    this.recordCount('chat_messages', data?.length || 0);
    return data || [];
  }

  private async fetchAiFeedback(clinicId: string, messageIds: string[]) {
    if (messageIds.length === 0) return [];
    if (this.convexRead) {
      return this.fetchConvexRowsByIds('ai_feedback', 'message_id', messageIds);
    }
    const { data } = await this.supabase
      .from('ai_feedback')
      .select('*')
      .in('message_id', messageIds);
    this.recordCount('ai_feedback', data?.length || 0);
    return data || [];
  }

  // =========================================================================
  // NOTIFICATIONS & REMINDERS TABLES
  // =========================================================================

  private async fetchEmailNotifications(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('email_notifications', clinicId);
    const { data } = await this.supabase
      .from('email_notifications')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('email_notifications', data?.length || 0);
    return data || [];
  }

  private async fetchSmsNotifications(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('sms_notifications', clinicId);
    const { data } = await this.supabase
      .from('sms_notifications')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('sms_notifications', data?.length || 0);
    return data || [];
  }

  private async fetchScheduledReminders(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('scheduled_reminders', clinicId);
    const { data } = await this.supabase
      .from('scheduled_reminders')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('scheduled_reminders', data?.length || 0);
    return data || [];
  }

  private async fetchPushSubscriptions(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('push_subscriptions', clinicId);
    const { data } = await this.supabase
      .from('push_subscriptions')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('push_subscriptions', data?.length || 0);
    return data || [];
  }

  private async fetchPushNotifications(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('push_notifications', clinicId);
    const { data } = await this.supabase
      .from('push_notifications')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('push_notifications', data?.length || 0);
    return data || [];
  }

  // =========================================================================
  // PRESCRIPTIONS & MEDICATIONS TABLES
  // =========================================================================

  private async fetchMedications(clinicId: string) {
    if (this.convexRead) {
      // Hybrid: global medications (clinic_id NULL) + this clinic's rows.
      const rows = ((await listConvexTable('medications')) as Record<string, unknown>[]).filter(
        (r) => r.clinic_id == null || String(r.clinic_id) === String(clinicId)
      );
      const cleaned = rows.map((r) => stripConvexRow(r));
      this.recordCount('medications', cleaned.length);
      return cleaned;
    }
    const { data } = await this.supabase
      .from('medications')
      .select('*')
      .or(`clinic_id.eq.${clinicId},clinic_id.is.null`);
    this.recordCount('medications', data?.length || 0);
    return data || [];
  }

  private async fetchPrescriptions(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('prescriptions', clinicId);
    const { data } = await this.supabase
      .from('prescriptions')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('prescriptions', data?.length || 0);
    return data || [];
  }

  private async fetchPrescriptionItems(prescriptionIds: string[]) {
    if (prescriptionIds.length === 0) return [];
    if (this.convexRead) {
      return this.fetchConvexRowsByIds('prescription_items', 'prescription_id', prescriptionIds);
    }
    const { data } = await this.supabase
      .from('prescription_items')
      .select('*')
      .in('prescription_id', prescriptionIds);
    this.recordCount('prescription_items', data?.length || 0);
    return data || [];
  }

  // =========================================================================
  // QUOTES (PRESUPUESTOS) TABLES
  // =========================================================================

  private async fetchQuotes(clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic('quotes', clinicId);
    const { data } = await this.supabase
      .from('quotes')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('quotes', data?.length || 0);
    return data || [];
  }

  private async fetchQuoteItems(quoteIds: string[]) {
    if (quoteIds.length === 0) return [];
    if (this.convexRead) {
      return this.fetchConvexRowsByIds('quote_items', 'quote_id', quoteIds);
    }
    const { data } = await this.supabase
      .from('quote_items')
      .select('*')
      .in('quote_id', quoteIds);
    this.recordCount('quote_items', data?.length || 0);
    return data || [];
  }

  private async fetchRowsByClinic(table: string, clinicId: string) {
    if (this.convexRead) return this.fetchConvexRowsByClinic(table, clinicId);

    const supabase = this.supabase as unknown as DynamicSupabaseClient;
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('clinic_id', clinicId);

    if (error) {
      console.error(`[Regular Export] ${table} error:`, error);
      return [];
    }

    this.recordCount(table, data?.length || 0);
    return data || [];
  }

  private async fetchRowsByWorkspace(table: string, workspaceId: string) {
    if (this.convexRead) {
      const rows = (await listConvexDocumentsByWorkspace(table, workspaceId)) as Record<
        string,
        unknown
      >[];
      const cleaned = rows.map((r) => stripConvexRow(r));
      this.recordCount(table, cleaned.length);
      return cleaned;
    }

    const supabase = this.supabase as unknown as DynamicSupabaseClient;
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error(`[Regular Export] ${table} error:`, error);
      return [];
    }

    this.recordCount(table, data?.length || 0);
    return data || [];
  }

  private async fetchRowsByIds(table: string, column: string, ids: string[]) {
    const filteredIds = Array.from(new Set(ids.filter(Boolean)));
    if (filteredIds.length === 0) return [];

    if (this.convexRead) return this.fetchConvexRowsByIds(table, column, filteredIds);

    const supabase = this.supabase as unknown as DynamicSupabaseClient;
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .in(column, filteredIds);

    if (error) {
      console.error(`[Regular Export] ${table} error:`, error);
      return [];
    }

    this.recordCount(table, data?.length || 0);
    return data || [];
  }

  // =========================================================================
  // CONVEX-ONLY READ HELPERS
  // Mirror the Supabase shape: list from Convex, strip bookkeeping fields, decode.
  // =========================================================================

  /** Direct clinic-scoped read: convex parity for `.eq('clinic_id', clinicId)`. */
  private async fetchConvexRowsByClinic(table: string, clinicId: string) {
    const rows = (await listConvexDocumentsByClinic(table, clinicId)) as Record<string, unknown>[];
    const cleaned = rows.map((r) => stripConvexRow(r));
    this.recordCount(table, cleaned.length);
    return cleaned;
  }

  /** By-FK read: convex parity for `.in(column, ids)` (resolve via full-table scan + filter). */
  private async fetchConvexRowsByIds(table: string, column: string, ids: string[]) {
    const idSet = new Set(ids.map(String));
    const rows = ((await listConvexTable(table)) as Record<string, unknown>[]).filter(
      (r) => r[column] != null && idSet.has(String(r[column]))
    );
    const cleaned = rows.map((r) => stripConvexRow(r));
    this.recordCount(table, cleaned.length);
    return cleaned;
  }

  /**
   * Helper to track record counts
   */
  private recordCount(table: string, count: number) {
    this.stats.recordsByTable[table] = (this.stats.recordsByTable[table] || 0) + count;
    this.stats.totalRecords += count;
  }
}
