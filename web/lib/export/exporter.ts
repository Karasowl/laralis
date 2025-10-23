/**
 * Export Bundle Generator
 *
 * Queries the database and generates a complete export bundle for a workspace.
 * Respects foreign key order and RLS policies.
 */

import { createClient } from '@supabase/supabase-js';
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
  private supabase: ReturnType<typeof createClient>;
  private workspaceId: string;
  private options: ExporterOptions;
  private stats: ExportStats;

  constructor(
    supabase: ReturnType<typeof createClient>,
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
      tariffs,
      marketingCampaigns,
      marketingCampaignStatusHistory,
      patients,
      treatments,
      expenses,
      workspaceActivity,
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
      this.fetchTariffs(clinicId),
      this.fetchMarketingCampaigns(clinicId),
      this.fetchMarketingCampaignStatusHistory(clinicId),
      this.fetchPatients(clinicId),
      this.fetchTreatments(clinicId),
      this.fetchExpenses(clinicId),
      this.options.includeAuditLogs ? this.fetchWorkspaceActivity(clinicId) : [],
    ]);

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
      tariffs: tariffs.length,
      marketing_campaigns: marketingCampaigns.length,
      marketing_campaign_status_history: marketingCampaignStatusHistory.length,
      patients: patients.length,
      treatments: treatments.length,
      expenses: expenses.length,
      workspace_activity: workspaceActivity?.length || 0,
    };

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
      tariffs,
      marketingCampaigns,
      marketingCampaignStatusHistory,
      patients,
      treatments,
      expenses,
      workspaceActivity,
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
    const { data } = await this.supabase.from('assets').select('*').eq('clinic_id', clinicId);
    this.recordCount('assets', data?.length || 0);
    return data || [];
  }

  private async fetchSupplies(clinicId: string) {
    const { data } = await this.supabase.from('supplies').select('*').eq('clinic_id', clinicId);
    this.recordCount('supplies', data?.length || 0);
    return data || [];
  }

  private async fetchFixedCosts(clinicId: string) {
    const { data } = await this.supabase.from('fixed_costs').select('*').eq('clinic_id', clinicId);
    this.recordCount('fixed_costs', data?.length || 0);
    return data || [];
  }

  private async fetchServices(clinicId: string) {
    const { data } = await this.supabase.from('services').select('*').eq('clinic_id', clinicId);
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

  private async fetchTariffs(clinicId: string) {
    const { data } = await this.supabase.from('tariffs').select('*').eq('clinic_id', clinicId);
    this.recordCount('tariffs', data?.length || 0);
    return data || [];
  }

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
    const { data } = await this.supabase.from('patients').select('*').eq('clinic_id', clinicId);
    this.recordCount('patients', data?.length || 0);
    return data || [];
  }

  private async fetchTreatments(clinicId: string) {
    const { data } = await this.supabase.from('treatments').select('*').eq('clinic_id', clinicId);
    this.recordCount('treatments', data?.length || 0);
    return data || [];
  }

  private async fetchExpenses(clinicId: string) {
    const { data } = await this.supabase.from('expenses').select('*').eq('clinic_id', clinicId);
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

  /**
   * Helper to track record counts
   */
  private recordCount(table: string, count: number) {
    this.stats.recordsByTable[table] = (this.stats.recordsByTable[table] || 0) + count;
    this.stats.totalRecords += count;
  }
}
