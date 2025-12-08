/**
 * Export Bundle Importer
 *
 * Imports validated export bundles into Supabase with transactional semantics.
 * Implements manual rollback since Supabase doesn't support native transactions.
 */

import { createClient } from '@supabase/supabase-js';
import type { ExportBundle, ImportOptions, ImportResult, ImportProgress } from './types';
import { migrateBundle } from './migrator';
import { validateBundle } from './validator';

/**
 * Import Error
 */
export class ImportError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

/**
 * ID Mapping for foreign key resolution
 */
interface IdMapping {
  [oldId: string]: string;
}

/**
 * Workspace Bundle Importer
 *
 * Handles importing of complete workspace bundles with rollback support.
 */
export class WorkspaceBundleImporter {
  private supabase: ReturnType<typeof createClient>;
  private bundle: ExportBundle;
  private options: ImportOptions;
  private progress: ImportProgress;
  private insertedIds: {
    workspaceId?: string;
    clinicIds: string[];
    [key: string]: any;
  };
  private idMappings: {
    workspace?: IdMapping;
    clinics: IdMapping;
    [key: string]: IdMapping | undefined;
  };

  constructor(
    supabase: ReturnType<typeof createClient>,
    bundle: ExportBundle,
    options: ImportOptions
  ) {
    this.supabase = supabase;
    this.bundle = bundle;
    this.options = options;
    this.insertedIds = { clinicIds: [] };
    this.idMappings = { clinics: {} };
    this.progress = {
      status: 'validating',
      currentStep: 'Initializing',
      progress: 0,
      recordsProcessed: 0,
      totalRecords: 0,
      errors: [],
      startedAt: new Date().toISOString(),
    };
  }

  /**
   * Import bundle with rollback on error
   */
  async import(): Promise<ImportResult> {
    const startTime = Date.now();

    try {
      // Step 1: Migrate bundle if needed
      this.updateProgress('validating', 'Migrating bundle to current version', 5);
      const migratedBundle = migrateBundle(this.bundle);
      this.bundle = migratedBundle;

      // Step 2: Validate bundle
      if (!this.options.skipValidation) {
        this.updateProgress('validating', 'Validating bundle', 10);
        const validation = await validateBundle(this.bundle);

        if (!validation.valid) {
          throw new ImportError(
            'Bundle validation failed',
            'VALIDATION_FAILED',
            { errors: validation.errors }
          );
        }

        this.progress.totalRecords = validation.stats.recordsToImport;
      }

      // Step 3: Dry run check
      if (this.options.dryRun) {
        return {
          success: true,
          recordsImported: {},
          errors: [],
          warnings: [],
          duration: (Date.now() - startTime) / 1000,
        };
      }

      // Step 4: Import data
      this.updateProgress('importing', 'Starting import', 15);
      await this.importData();

      // Step 5: Complete
      this.updateProgress('completed', 'Import completed successfully', 100);

      return {
        success: true,
        workspaceId: this.insertedIds.workspaceId,
        clinicIds: this.insertedIds.clinicIds,
        recordsImported: this.progress.recordsProcessed
          ? { total: this.progress.recordsProcessed }
          : {},
        errors: [],
        warnings: [],
        duration: (Date.now() - startTime) / 1000,
      };
    } catch (error) {
      console.error('Import error:', error);

      // Rollback
      this.updateProgress('failed', 'Import failed, rolling back', 0);
      await this.rollback();
      this.updateProgress('rolled_back', 'Changes rolled back', 0);

      return {
        success: false,
        recordsImported: {},
        errors: [
          {
            type: 'INVALID_SCHEMA',
            message: error instanceof Error ? error.message : String(error),
          },
        ],
        warnings: [],
        duration: (Date.now() - startTime) / 1000,
      };
    }
  }

  /**
   * Import all data in correct order
   */
  private async importData() {
    // Level 1: Workspace (create new)
    await this.importWorkspace();
    this.incrementProgress(5);

    // Level 2: Global data (if any)
    await this.importGlobalData();
    this.incrementProgress(5);

    // Level 3: Clinics
    await this.importClinics();
    this.incrementProgress(10);

    // Level 4+: Clinic data
    for (let i = 0; i < this.bundle.data.clinics.length; i++) {
      const clinic = this.bundle.data.clinics[i];
      const progressPerClinic = 60 / this.bundle.data.clinics.length;

      await this.importClinicData(clinic, i);
      this.incrementProgress(progressPerClinic);
    }
  }

  /**
   * Import workspace (always create new)
   */
  private async importWorkspace() {
    this.updateProgress('importing', 'Importing workspace', this.progress.progress);

    const workspace = this.bundle.data.workspace;

    // Create new workspace with new ID
    const { data, error } = await this.supabase
      .from('workspaces')
      .insert({
        name: workspace.name + ' (Imported)',
        slug: workspace.slug + '-import-' + Date.now(),
        description: workspace.description,
        owner_id: this.options.userId, // Set the importing user as owner
        logo_url: workspace.logo_url,
        settings: workspace.settings,
        max_clinics: workspace.max_clinics,
        max_users: workspace.max_users,
        is_active: workspace.is_active,
        onboarding_completed: workspace.onboarding_completed,
        subscription_status: workspace.subscription_status,
      })
      .select()
      .single();

    if (error || !data) {
      throw new ImportError('Failed to create workspace', 'IMPORT_WORKSPACE_FAILED', { error });
    }

    this.insertedIds.workspaceId = data.id;
    this.idMappings.workspace = { [workspace.id]: data.id };
    this.progress.recordsProcessed++;
  }

  /**
   * Import global data (category types, role permissions, etc.)
   */
  private async importGlobalData() {
    // Note: We skip importing global data like category_types and role_permissions
    // because they should already exist in the target system.
    // If needed, we could import them here with conflict resolution.
  }

  /**
   * Import clinics
   */
  private async importClinics() {
    this.updateProgress('importing', 'Importing clinics', this.progress.progress);

    const newWorkspaceId = this.insertedIds.workspaceId!;

    for (const clinicBundle of this.bundle.data.clinics) {
      const clinic = clinicBundle.clinic;

      const { data, error } = await this.supabase
        .from('clinics')
        .insert({
          workspace_id: newWorkspaceId,
          name: clinic.name,
          address: clinic.address,
          phone: clinic.phone,
          email: clinic.email,
          is_active: clinic.is_active,
        })
        .select()
        .single();

      if (error || !data) {
        throw new ImportError('Failed to create clinic', 'IMPORT_CLINIC_FAILED', {
          error,
          clinicName: clinic.name,
        });
      }

      this.insertedIds.clinicIds.push(data.id);
      this.idMappings.clinics[clinic.id] = data.id;
      this.progress.recordsProcessed++;
    }
  }

  /**
   * Import all data for a single clinic
   */
  private async importClinicData(clinicBundle: any, clinicIndex: number) {
    const oldClinicId = clinicBundle.clinic.id;
    const newClinicId = this.idMappings.clinics[oldClinicId];

    this.updateProgress(
      'importing',
      `Importing data for clinic ${clinicIndex + 1}`,
      this.progress.progress
    );

    // Import in FK order
    await this.importSettingsTime(clinicBundle, newClinicId);
    await this.importPatientSources(clinicBundle, newClinicId);
    await this.importCustomCategories(clinicBundle, newClinicId);
    await this.importAssets(clinicBundle, newClinicId);
    await this.importSupplies(clinicBundle, newClinicId);
    await this.importFixedCosts(clinicBundle, newClinicId);
    await this.importServices(clinicBundle, newClinicId);
    await this.importServiceSupplies(clinicBundle, newClinicId);
    await this.importMarketingCampaigns(clinicBundle, newClinicId);
    await this.importPatients(clinicBundle, newClinicId);
    await this.importTreatments(clinicBundle, newClinicId);
    await this.importExpenses(clinicBundle, newClinicId);

    // AI Assistant Data (Migrations 50-54)
    await this.importActionLogs(clinicBundle, newClinicId);
    await this.importClinicGoogleCalendar(clinicBundle, newClinicId);
    await this.importChatSessions(clinicBundle, newClinicId);
    await this.importChatMessages(clinicBundle);
    await this.importAiFeedback(clinicBundle);
  }

  // Import methods for each table
  // These methods insert data and track mappings

  private async importSettingsTime(clinicBundle: any, newClinicId: string) {
    if (!clinicBundle.settingsTime) return;

    const { error } = await this.supabase.from('settings_time').insert({
      clinic_id: newClinicId,
      work_days: clinicBundle.settingsTime.work_days,
      hours_per_day: clinicBundle.settingsTime.hours_per_day,
      real_pct: clinicBundle.settingsTime.real_pct,
      working_days_config: clinicBundle.settingsTime.working_days_config,
    });

    if (error) {
      throw new ImportError('Failed to import settings_time', 'IMPORT_FAILED', { error });
    }
    this.progress.recordsProcessed++;
  }

  private async importPatientSources(clinicBundle: any, newClinicId: string) {
    if (!clinicBundle.patientSources || clinicBundle.patientSources.length === 0) return;

    const records = clinicBundle.patientSources.map((source: any) => ({
      clinic_id: newClinicId,
      name: source.name,
      description: source.description,
      is_active: source.is_active,
      is_system: source.is_system,
      color: source.color,
      icon: source.icon,
    }));

    // Use upsert to handle auto-created patient_sources from clinic trigger
    const { error } = await this.supabase
      .from('patient_sources')
      .upsert(records, {
        onConflict: 'clinic_id,name',
        ignoreDuplicates: false, // Update existing records with backup data
      });

    if (error) {
      throw new ImportError('Failed to import patient_sources', 'IMPORT_FAILED', { error });
    }
    this.progress.recordsProcessed += records.length;
  }

  private async importCustomCategories(clinicBundle: any, newClinicId: string) {
    if (!clinicBundle.customCategories || clinicBundle.customCategories.length === 0) return;

    const records = clinicBundle.customCategories.map((category: any) => ({
      clinic_id: newClinicId,
      category_type_id: category.category_type_id,
      name: category.name,
      display_name: category.display_name,
      description: category.description,
      color: category.color,
      icon: category.icon,
      sort_order: category.sort_order,
      is_active: category.is_active,
      is_system: category.is_system,
    }));

    // Use upsert to handle auto-created categories from clinic trigger
    const { data, error } = await this.supabase
      .from('custom_categories')
      .upsert(records, {
        onConflict: 'clinic_id,category_type_id,name',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      throw new ImportError('Failed to import custom_categories', 'IMPORT_FAILED', { error });
    }

    // Map old IDs to new IDs
    if (data) {
      this.idMappings.customCategories = this.idMappings.customCategories || {};
      clinicBundle.customCategories.forEach((category: any, index: number) => {
        this.idMappings.customCategories![category.id] = data[index].id;
      });
    }

    this.progress.recordsProcessed += records.length;
  }

  private async importAssets(clinicBundle: any, newClinicId: string) {
    if (!clinicBundle.assets || clinicBundle.assets.length === 0) return;

    const records = clinicBundle.assets.map((asset: any) => ({
      clinic_id: newClinicId,
      name: asset.name,
      category: asset.category,
      purchase_date: asset.purchase_date,
      purchase_price_cents: asset.purchase_price_cents,
      depreciation_years: asset.depreciation_years,
      is_active: asset.is_active,
    }));

    const { error } = await this.supabase.from('assets').insert(records);

    if (error) {
      throw new ImportError('Failed to import assets', 'IMPORT_FAILED', { error });
    }
    this.progress.recordsProcessed += records.length;
  }

  private async importSupplies(clinicBundle: any, newClinicId: string) {
    if (!clinicBundle.supplies || clinicBundle.supplies.length === 0) return;

    const records = clinicBundle.supplies.map((supply: any) => ({
      clinic_id: newClinicId,
      name: supply.name,
      category: supply.category,
      presentation: supply.presentation,
      price_cents: supply.price_cents,
      portions: supply.portions,
      cost_per_portion_cents: supply.cost_per_portion_cents,
      stock_quantity: supply.stock_quantity,
    }));

    const { data, error } = await this.supabase.from('supplies').insert(records).select();

    if (error) {
      throw new ImportError('Failed to import supplies', 'IMPORT_FAILED', { error });
    }

    // Map old IDs to new IDs
    if (data) {
      this.idMappings.supplies = this.idMappings.supplies || {};
      clinicBundle.supplies.forEach((supply: any, index: number) => {
        this.idMappings.supplies![supply.id] = data[index].id;
      });
    }

    this.progress.recordsProcessed += records.length;
  }

  private async importFixedCosts(clinicBundle: any, newClinicId: string) {
    if (!clinicBundle.fixedCosts || clinicBundle.fixedCosts.length === 0) return;

    const records = clinicBundle.fixedCosts.map((cost: any) => ({
      clinic_id: newClinicId,
      category: cost.category,
      concept: cost.concept,
      amount_cents: cost.amount_cents,
      is_active: cost.is_active,
    }));

    const { error } = await this.supabase.from('fixed_costs').insert(records);

    if (error) {
      throw new ImportError('Failed to import fixed_costs', 'IMPORT_FAILED', { error });
    }
    this.progress.recordsProcessed += records.length;
  }

  private async importServices(clinicBundle: any, newClinicId: string) {
    if (!clinicBundle.services || clinicBundle.services.length === 0) return;

    const records = clinicBundle.services.map((service: any) => ({
      clinic_id: newClinicId,
      name: service.name,
      description: service.description,
      category: service.category,
      est_minutes: service.est_minutes,
      fixed_cost_per_minute_cents: service.fixed_cost_per_minute_cents,
      variable_cost_cents: service.variable_cost_cents,
      margin_pct: service.margin_pct,
      price_cents: service.price_cents,
      is_active: service.is_active,
    }));

    const { data, error } = await this.supabase.from('services').insert(records).select();

    if (error) {
      throw new ImportError('Failed to import services', 'IMPORT_FAILED', { error });
    }

    // Map IDs
    if (data) {
      this.idMappings.services = this.idMappings.services || {};
      clinicBundle.services.forEach((service: any, index: number) => {
        this.idMappings.services![service.id] = data[index].id;
      });
    }

    this.progress.recordsProcessed += records.length;
  }

  private async importServiceSupplies(clinicBundle: any, newClinicId: string) {
    if (!clinicBundle.serviceSupplies || clinicBundle.serviceSupplies.length === 0) return;

    const records = clinicBundle.serviceSupplies.map((ss: any) => {
      const newServiceId = this.idMappings.services?.[ss.service_id];
      const newSupplyId = this.idMappings.supplies?.[ss.supply_id];

      if (!newServiceId || !newSupplyId) {
        console.warn(`[importer] Skipping service_supply: service ${ss.service_id} or supply ${ss.supply_id} not found in mappings`);
        return null;
      }

      return {
        service_id: newServiceId,
        supply_id: newSupplyId,
        qty: ss.qty,
        unit_cost_cents: ss.unit_cost_cents,
      };
    }).filter(Boolean); // Remove nulls

    if (records.length === 0) return;

    const { error } = await this.supabase.from('service_supplies').insert(records);

    if (error) {
      throw new ImportError('Failed to import service_supplies', 'IMPORT_FAILED', { error });
    }

    this.progress.recordsProcessed += records.length;
  }

  private async importMarketingCampaigns(clinicBundle: any, newClinicId: string) {
    if (!clinicBundle.marketingCampaigns || clinicBundle.marketingCampaigns.length === 0) return;

    const records = clinicBundle.marketingCampaigns.map((campaign: any) => {
      const newPlatformId = this.idMappings.customCategories?.[campaign.platform_id];

      if (!newPlatformId) {
        console.warn(`[importer] Skipping marketing campaign: platform ${campaign.platform_id} not found in mappings`);
        return null;
      }

      return {
        clinic_id: newClinicId,
        platform_id: newPlatformId,
        name: campaign.name,
        code: campaign.code,
        is_active: campaign.is_active,
        is_archived: campaign.is_archived,
        archived_at: campaign.archived_at,
        reactivated_at: campaign.reactivated_at,
      };
    }).filter(Boolean); // Remove nulls

    if (records.length === 0) return;

    const { error } = await this.supabase.from('marketing_campaigns').insert(records);

    if (error) {
      throw new ImportError('Failed to import marketing_campaigns', 'IMPORT_FAILED', { error });
    }

    this.progress.recordsProcessed += records.length;
  }

  private async importPatients(clinicBundle: any, newClinicId: string) {
    if (!clinicBundle.patients || clinicBundle.patients.length === 0) return;

    const records = clinicBundle.patients.map((patient: any) => ({
      clinic_id: newClinicId,
      first_name: patient.first_name,
      last_name: patient.last_name,
      email: patient.email,
      phone: patient.phone,
      birth_date: patient.birth_date,
      gender: patient.gender,
      is_active: patient.is_active,
    }));

    const { data, error } = await this.supabase.from('patients').insert(records).select();

    if (error) {
      throw new ImportError('Failed to import patients', 'IMPORT_FAILED', { error });
    }

    // Map IDs
    if (data) {
      this.idMappings.patients = this.idMappings.patients || {};
      clinicBundle.patients.forEach((patient: any, index: number) => {
        this.idMappings.patients![patient.id] = data[index].id;
      });
    }

    this.progress.recordsProcessed += records.length;
  }

  private async importTreatments(clinicBundle: any, newClinicId: string) {
    if (!clinicBundle.treatments || clinicBundle.treatments.length === 0) return;

    const records = clinicBundle.treatments.map((treatment: any) => {
      const newPatientId = this.idMappings.patients?.[treatment.patient_id];
      const newServiceId = this.idMappings.services?.[treatment.service_id];

      if (!newPatientId || !newServiceId) {
        console.warn(`[importer] Skipping treatment: patient ${treatment.patient_id} or service ${treatment.service_id} not found in mappings`);
        return null;
      }

      return {
        clinic_id: newClinicId,
        patient_id: newPatientId,
        service_id: newServiceId,
        treatment_date: treatment.treatment_date,
        treatment_time: treatment.treatment_time,
        status: treatment.status,
        tooth_number: treatment.tooth_number,
        notes: treatment.notes,
        minutes: treatment.minutes,
        fixed_cost_per_minute_cents: treatment.fixed_cost_per_minute_cents,
        variable_cost_cents: treatment.variable_cost_cents,
        margin_pct: treatment.margin_pct,
        price_cents: treatment.price_cents,
        tariff_version: treatment.tariff_version,
        // Refund fields (Migration 55) - optional for backward compatibility
        is_refunded: treatment.is_refunded ?? false,
        refunded_at: treatment.refunded_at || null,
        refund_reason: treatment.refund_reason || null,
        // Google Calendar sync (Migration 54)
        google_event_id: treatment.google_event_id || null,
      };
    }).filter(Boolean); // Remove nulls

    if (records.length === 0) return;

    const { error } = await this.supabase.from('treatments').insert(records);

    if (error) {
      throw new ImportError('Failed to import treatments', 'IMPORT_FAILED', { error });
    }

    this.progress.recordsProcessed += records.length;
  }

  private async importExpenses(clinicBundle: any, newClinicId: string) {
    if (!clinicBundle.expenses || clinicBundle.expenses.length === 0) return;

    // Find "Otros" (Others) system category as fallback for unmapped categories
    const { data: otrosCategory } = await this.supabase
      .from('categories')
      .select('id')
      .eq('entity_type', 'expense')
      .eq('is_system', true)
      .eq('name', 'otros')
      .is('clinic_id', null)
      .is('parent_id', null)
      .single();

    const fallbackCategoryId = otrosCategory?.id;

    if (!fallbackCategoryId) {
      throw new ImportError(
        'Cannot import expenses: system category "otros" not found',
        'MISSING_SYSTEM_CATEGORY'
      );
    }

    let reclassifiedCount = 0;
    const records = clinicBundle.expenses.map((expense: any) => {
      // Try to map category_id to new ID
      let newCategoryId = expense.category_id
        ? this.idMappings.customCategories?.[expense.category_id]
        : null;

      // If expense has category_id but we can't map it, assign to "Otros"
      if (expense.category_id && !newCategoryId) {
        console.warn(
          `[importer] Expense category ${expense.category_id} not found, assigning to "Otros" category`
        );
        newCategoryId = fallbackCategoryId;
        reclassifiedCount++;
      }

      // If expense has no category_id at all, also assign to "Otros"
      if (!newCategoryId) {
        newCategoryId = fallbackCategoryId;
        reclassifiedCount++;
      }

      // Import expense with mapped category_id (or "Otros" as fallback)
      return {
        clinic_id: newClinicId,
        expense_date: expense.expense_date,
        category_id: newCategoryId, // Always has a valid category
        category: expense.category,
        subcategory: expense.subcategory,
        description: expense.description,
        amount_cents: expense.amount_cents,
        vendor: expense.vendor,
        invoice_number: expense.invoice_number,
        is_recurring: expense.is_recurring,
        is_paid: expense.is_paid,
        payment_date: expense.payment_date,
        payment_method: expense.payment_method,
        notes: expense.notes,
      };
    });

    if (records.length === 0) return;

    const { error } = await this.supabase.from('expenses').insert(records);

    if (error) {
      throw new ImportError('Failed to import expenses', 'IMPORT_FAILED', { error });
    }

    this.progress.recordsProcessed += records.length;

    // Add warning if some expenses were reclassified
    if (reclassifiedCount > 0) {
      this.progress.errors.push({
        type: 'CONSTRAINT_VIOLATION',
        field: 'category_id',
        message: `${reclassifiedCount} expense(s) reclassified to "Otros" (original category not found in backup)`,
      });
    }
  }

  // AI Assistant Data Import Methods (Migrations 50-54)

  private async importActionLogs(clinicBundle: any, newClinicId: string) {
    if (!clinicBundle.actionLogs || clinicBundle.actionLogs.length === 0) return;

    const records = clinicBundle.actionLogs.map((log: any) => ({
      clinic_id: newClinicId,
      user_id: log.user_id, // Keep original user_id (may be null or different user)
      session_id: log.session_id,
      action_type: log.action_type,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      input_data: log.input_data,
      output_data: log.output_data,
      status: log.status,
      error_message: log.error_message,
      execution_time_ms: log.execution_time_ms,
      created_at: log.created_at,
      completed_at: log.completed_at,
    }));

    const { error } = await this.supabase.from('action_logs').insert(records);

    if (error) {
      // Non-fatal: action_logs are optional historical data
      console.warn('[importer] Failed to import action_logs:', error);
      this.progress.errors.push({
        type: 'CONSTRAINT_VIOLATION',
        field: 'action_logs',
        message: `Failed to import ${records.length} action log(s): ${error.message}`,
      });
      return;
    }
    this.progress.recordsProcessed += records.length;
  }

  private async importClinicGoogleCalendar(clinicBundle: any, newClinicId: string) {
    if (!clinicBundle.clinicGoogleCalendar) return;

    const cal = clinicBundle.clinicGoogleCalendar;
    const { error } = await this.supabase.from('clinic_google_calendar').insert({
      clinic_id: newClinicId,
      calendar_id: cal.calendar_id,
      calendar_name: cal.calendar_name,
      access_token: cal.access_token,
      refresh_token: cal.refresh_token,
      token_expires_at: cal.token_expires_at,
      sync_enabled: cal.sync_enabled,
      last_sync_at: cal.last_sync_at,
      sync_error: cal.sync_error,
    });

    if (error) {
      // Non-fatal: Google Calendar integration is optional
      console.warn('[importer] Failed to import clinic_google_calendar:', error);
      this.progress.errors.push({
        type: 'CONSTRAINT_VIOLATION',
        field: 'clinic_google_calendar',
        message: `Failed to import Google Calendar config: ${error.message}`,
      });
      return;
    }
    this.progress.recordsProcessed++;
  }

  private async importChatSessions(clinicBundle: any, newClinicId: string) {
    if (!clinicBundle.chatSessions || clinicBundle.chatSessions.length === 0) return;

    const records = clinicBundle.chatSessions.map((session: any) => ({
      clinic_id: newClinicId,
      user_id: session.user_id,
      mode: session.mode,
      entity_type: session.entity_type,
      title: session.title,
      metadata: session.metadata,
      started_at: session.started_at,
      ended_at: session.ended_at,
    }));

    const { data, error } = await this.supabase
      .from('chat_sessions')
      .insert(records)
      .select();

    if (error) {
      // Non-fatal: chat history is optional
      console.warn('[importer] Failed to import chat_sessions:', error);
      this.progress.errors.push({
        type: 'CONSTRAINT_VIOLATION',
        field: 'chat_sessions',
        message: `Failed to import ${records.length} chat session(s): ${error.message}`,
      });
      return;
    }

    // Map old session IDs to new IDs for chat_messages FK
    if (data) {
      this.idMappings.chatSessions = this.idMappings.chatSessions || {};
      clinicBundle.chatSessions.forEach((session: any, index: number) => {
        this.idMappings.chatSessions![session.id] = data[index].id;
      });
    }

    this.progress.recordsProcessed += records.length;
  }

  private async importChatMessages(clinicBundle: any) {
    if (!clinicBundle.chatMessages || clinicBundle.chatMessages.length === 0) return;

    const records = clinicBundle.chatMessages.map((msg: any) => {
      const newSessionId = this.idMappings.chatSessions?.[msg.session_id];

      if (!newSessionId) {
        console.warn(`[importer] Skipping chat_message: session ${msg.session_id} not found in mappings`);
        return null;
      }

      return {
        session_id: newSessionId,
        role: msg.role,
        content: msg.content,
        audio_url: msg.audio_url,
        tokens_used: msg.tokens_used,
        model_used: msg.model_used,
        latency_ms: msg.latency_ms,
        created_at: msg.created_at,
      };
    }).filter(Boolean);

    if (records.length === 0) return;

    const { data, error } = await this.supabase
      .from('chat_messages')
      .insert(records)
      .select();

    if (error) {
      console.warn('[importer] Failed to import chat_messages:', error);
      this.progress.errors.push({
        type: 'CONSTRAINT_VIOLATION',
        field: 'chat_messages',
        message: `Failed to import ${records.length} chat message(s): ${error.message}`,
      });
      return;
    }

    // Map old message IDs to new IDs for ai_feedback FK
    if (data) {
      this.idMappings.chatMessages = this.idMappings.chatMessages || {};
      // Only map the messages that were successfully inserted
      const originalMessages = clinicBundle.chatMessages.filter((msg: any) =>
        this.idMappings.chatSessions?.[msg.session_id]
      );
      originalMessages.forEach((msg: any, index: number) => {
        if (data[index]) {
          this.idMappings.chatMessages![msg.id] = data[index].id;
        }
      });
    }

    this.progress.recordsProcessed += records.length;
  }

  private async importAiFeedback(clinicBundle: any) {
    if (!clinicBundle.aiFeedback || clinicBundle.aiFeedback.length === 0) return;

    const records = clinicBundle.aiFeedback.map((feedback: any) => {
      const newMessageId = this.idMappings.chatMessages?.[feedback.message_id];

      if (!newMessageId) {
        console.warn(`[importer] Skipping ai_feedback: message ${feedback.message_id} not found in mappings`);
        return null;
      }

      return {
        message_id: newMessageId,
        user_id: feedback.user_id,
        rating: feedback.rating,
        feedback_type: feedback.feedback_type,
        feedback_text: feedback.feedback_text,
        created_at: feedback.created_at,
      };
    }).filter(Boolean);

    if (records.length === 0) return;

    const { error } = await this.supabase.from('ai_feedback').insert(records);

    if (error) {
      console.warn('[importer] Failed to import ai_feedback:', error);
      this.progress.errors.push({
        type: 'CONSTRAINT_VIOLATION',
        field: 'ai_feedback',
        message: `Failed to import ${records.length} AI feedback record(s): ${error.message}`,
      });
      return;
    }

    this.progress.recordsProcessed += records.length;
  }

  /**
   * Rollback all inserted data
   */
  private async rollback() {
    try {
      // Delete in reverse order
      if (this.insertedIds.clinicIds.length > 0) {
        await this.supabase.from('clinics').delete().in('id', this.insertedIds.clinicIds);
      }

      if (this.insertedIds.workspaceId) {
        await this.supabase.from('workspaces').delete().eq('id', this.insertedIds.workspaceId);
      }
    } catch (error) {
      console.error('Rollback error:', error);
    }
  }

  /**
   * Update progress
   */
  private updateProgress(status: ImportProgress['status'], step: string, progress: number) {
    this.progress.status = status;
    this.progress.currentStep = step;
    this.progress.progress = Math.min(progress, 100);

    if (status === 'completed') {
      this.progress.completedAt = new Date().toISOString();
    }
  }

  /**
   * Increment progress
   */
  private incrementProgress(amount: number) {
    this.progress.progress = Math.min(this.progress.progress + amount, 100);
  }

  /**
   * Get current progress
   */
  getProgress(): ImportProgress {
    return { ...this.progress };
  }
}
