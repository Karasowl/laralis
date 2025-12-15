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
  Workspace,
  Organization,
  CategoryType,
  RolePermission,
  WorkspaceUser,
  WorkspaceMember,
} from './types';
import { addChecksum, validateMoneyFields } from './checksum';
import { CURRENT_SCHEMA_VERSION, EXPORT_FORMAT_VERSION } from './migrations';

/**
 * Export Error
 */
export class ExportError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
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
          clinics,
        },
        migrations: {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          appliedMigrations: [], // TODO: Get from migrations table
        },
      };

      // Add checksum
      const bundle = await addChecksum(bundleWithoutChecksum as any);

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

  /**
   * Fetch all clinics with nested data
   */
  private async fetchClinics(): Promise<ClinicDataBundle[]> {
    const { data: clinicsData, error } = await this.supabase
      .from('clinics')
      .select('*')
      .eq('workspace_id', this.workspaceId);

    if (error) {
      throw new ExportError('Failed to fetch clinics', 'FETCH_CLINICS_FAILED', { error });
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
  private async fetchClinicData(clinic: any): Promise<ClinicDataBundle> {
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
      patients,
      treatments,
      expenses,
      workspaceActivity,
      // AI Assistant Data (Migrations 50-54)
      actionLogs,
      clinicGoogleCalendar,
      chatSessions,
      // Notifications & Reminders
      emailNotifications,
      smsNotifications,
      scheduledReminders,
      pushSubscriptions,
      pushNotifications,
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
      this.fetchPatients(clinicId),
      this.fetchTreatments(clinicId),
      this.fetchExpenses(clinicId),
      this.options.includeAuditLogs ? this.fetchWorkspaceActivity(clinicId) : [],
      // AI Assistant Data
      this.fetchActionLogs(clinicId),
      this.fetchClinicGoogleCalendar(clinicId),
      this.fetchChatSessions(clinicId),
      // Notifications & Reminders
      this.fetchEmailNotifications(clinicId),
      this.fetchSmsNotifications(clinicId),
      this.fetchScheduledReminders(clinicId),
      this.fetchPushSubscriptions(clinicId),
      this.fetchPushNotifications(clinicId),
      // Prescriptions & Medications
      this.fetchMedications(clinicId),
      this.fetchPrescriptions(clinicId),
      // Quotes
      this.fetchQuotes(clinicId),
    ]);

    // Fetch dependent data that needs IDs from parent tables
    const sessionIds = chatSessions.map((s: any) => s.id);
    const chatMessages = await this.fetchChatMessages(clinicId, sessionIds);

    const messageIds = chatMessages.map((m: any) => m.id);
    const aiFeedback = await this.fetchAiFeedback(clinicId, messageIds);

    const prescriptionIds = prescriptions.map((p: any) => p.id);
    const prescriptionItems = await this.fetchPrescriptionItems(prescriptionIds);

    const quoteIds = quotes.map((q: any) => q.id);
    const quoteItems = await this.fetchQuoteItems(quoteIds);

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
      patients: patients.length,
      treatments: treatments.length,
      expenses: expenses.length,
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
      scheduled_reminders: scheduledReminders.length,
      push_subscriptions: pushSubscriptions.length,
      push_notifications: pushNotifications.length,
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
      patients,
      treatments,
      expenses,
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
      scheduledReminders,
      pushSubscriptions,
      pushNotifications,
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
    const { data } = await this.supabase
      .from('settings_time')
      .select('*')
      .eq('clinic_id', clinicId)
      .single();
    if (data) this.recordCount('settings_time', 1);
    return data || null;
  }

  private async fetchCustomCategories(clinicId: string) {
    const { data } = await this.supabase
      .from('custom_categories')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('custom_categories', data?.length || 0);
    return data || [];
  }

  private async fetchCategories(clinicId: string) {
    const { data } = await this.supabase.from('categories').select('*').eq('clinic_id', clinicId);
    this.recordCount('categories', data?.length || 0);
    return data || [];
  }

  private async fetchPatientSources(clinicId: string) {
    const { data } = await this.supabase
      .from('patient_sources')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('patient_sources', data?.length || 0);
    return data || [];
  }

  private async fetchInvitations(clinicId: string) {
    const { data } = await this.supabase.from('invitations').select('*').eq('clinic_id', clinicId);
    this.recordCount('invitations', data?.length || 0);
    return data || [];
  }

  private async fetchClinicUsers(clinicId: string) {
    const { data } = await this.supabase.from('clinic_users').select('*').eq('clinic_id', clinicId);
    this.recordCount('clinic_users', data?.length || 0);
    return data || [];
  }

  private async fetchAssets(clinicId: string) {
    const { data, error } = await this.supabase.from('assets').select('*').eq('clinic_id', clinicId);
    if (error) console.error('[Regular Export] Assets error:', error);
    this.recordCount('assets', data?.length || 0);
    return data || [];
  }

  private async fetchSupplies(clinicId: string) {
    const { data, error } = await this.supabase.from('supplies').select('*').eq('clinic_id', clinicId);
    if (error) console.error('[Regular Export] Supplies error:', error);
    this.recordCount('supplies', data?.length || 0);
    return data || [];
  }

  private async fetchFixedCosts(clinicId: string) {
    const { data, error } = await this.supabase.from('fixed_costs').select('*').eq('clinic_id', clinicId);
    if (error) console.error('[Regular Export] Fixed costs error:', error);
    this.recordCount('fixed_costs', data?.length || 0);
    return data || [];
  }

  private async fetchServices(clinicId: string) {
    const { data, error } = await this.supabase.from('services').select('*').eq('clinic_id', clinicId);
    if (error) console.error('[Regular Export] Services error:', error);
    this.recordCount('services', data?.length || 0);
    return data || [];
  }

  private async fetchServiceSupplies(clinicId: string) {
    // Service supplies need to join with services to filter by clinic
    const { data } = await this.supabase
      .from('service_supplies')
      .select('*, services!inner(clinic_id)')
      .eq('services.clinic_id', clinicId);
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
    const { data } = await this.supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('marketing_campaigns', data?.length || 0);
    return data || [];
  }

  private async fetchMarketingCampaignStatusHistory(clinicId: string) {
    // Join with campaigns to filter by clinic
    const { data } = await this.supabase
      .from('marketing_campaign_status_history')
      .select('*, marketing_campaigns!inner(clinic_id)')
      .eq('marketing_campaigns.clinic_id', clinicId);
    this.recordCount('marketing_campaign_status_history', data?.length || 0);
    return data || [];
  }

  private async fetchPatients(clinicId: string) {
    const { data, error } = await this.supabase.from('patients').select('*').eq('clinic_id', clinicId);
    if (error) console.error('[Regular Export] Patients error:', error);
    this.recordCount('patients', data?.length || 0);
    return data || [];
  }

  private async fetchTreatments(clinicId: string) {
    const { data, error } = await this.supabase.from('treatments').select('*').eq('clinic_id', clinicId);
    if (error) console.error('[Regular Export] Treatments error:', error);
    this.recordCount('treatments', data?.length || 0);
    return data || [];
  }

  private async fetchExpenses(clinicId: string) {
    const { data, error } = await this.supabase.from('expenses').select('*').eq('clinic_id', clinicId);
    if (error) console.error('[Regular Export] Expenses error:', error);
    this.recordCount('expenses', data?.length || 0);
    return data || [];
  }

  private async fetchWorkspaceActivity(clinicId: string) {
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
    const { data } = await this.supabase
      .from('action_logs')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('action_logs', data?.length || 0);
    return data || [];
  }

  private async fetchClinicGoogleCalendar(clinicId: string) {
    const { data } = await this.supabase
      .from('clinic_google_calendar')
      .select('*')
      .eq('clinic_id', clinicId)
      .single();
    if (data) this.recordCount('clinic_google_calendar', 1);
    return data || null;
  }

  private async fetchChatSessions(clinicId: string) {
    const { data } = await this.supabase
      .from('chat_sessions')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('chat_sessions', data?.length || 0);
    return data || [];
  }

  private async fetchChatMessages(clinicId: string, sessionIds: string[]) {
    if (sessionIds.length === 0) return [];
    const { data } = await this.supabase
      .from('chat_messages')
      .select('*')
      .in('session_id', sessionIds);
    this.recordCount('chat_messages', data?.length || 0);
    return data || [];
  }

  private async fetchAiFeedback(clinicId: string, messageIds: string[]) {
    if (messageIds.length === 0) return [];
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
    const { data } = await this.supabase
      .from('email_notifications')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('email_notifications', data?.length || 0);
    return data || [];
  }

  private async fetchSmsNotifications(clinicId: string) {
    const { data } = await this.supabase
      .from('sms_notifications')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('sms_notifications', data?.length || 0);
    return data || [];
  }

  private async fetchScheduledReminders(clinicId: string) {
    const { data } = await this.supabase
      .from('scheduled_reminders')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('scheduled_reminders', data?.length || 0);
    return data || [];
  }

  private async fetchPushSubscriptions(clinicId: string) {
    const { data } = await this.supabase
      .from('push_subscriptions')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('push_subscriptions', data?.length || 0);
    return data || [];
  }

  private async fetchPushNotifications(clinicId: string) {
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
    const { data } = await this.supabase
      .from('medications')
      .select('*')
      .or(`clinic_id.eq.${clinicId},clinic_id.is.null`);
    this.recordCount('medications', data?.length || 0);
    return data || [];
  }

  private async fetchPrescriptions(clinicId: string) {
    const { data } = await this.supabase
      .from('prescriptions')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('prescriptions', data?.length || 0);
    return data || [];
  }

  private async fetchPrescriptionItems(prescriptionIds: string[]) {
    if (prescriptionIds.length === 0) return [];
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
    const { data } = await this.supabase
      .from('quotes')
      .select('*')
      .eq('clinic_id', clinicId);
    this.recordCount('quotes', data?.length || 0);
    return data || [];
  }

  private async fetchQuoteItems(quoteIds: string[]) {
    if (quoteIds.length === 0) return [];
    const { data } = await this.supabase
      .from('quote_items')
      .select('*')
      .in('quote_id', quoteIds);
    this.recordCount('quote_items', data?.length || 0);
    return data || [];
  }

  /**
   * Helper to track record counts
   */
  private recordCount(table: string, count: number) {
    this.stats.recordsByTable[table] = (this.stats.recordsByTable[table] || 0) + count;
    this.stats.totalRecords += count;
  }
}
