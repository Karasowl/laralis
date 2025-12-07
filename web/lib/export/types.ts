/**
 * Export/Import System Types
 *
 * This file defines the TypeScript interfaces for the complete export/import system.
 * All monetary values are stored as bigint in cents.
 * Schema Version: v1 (Migration 41)
 */

// ============================================================================
// DATABASE TABLE TYPES
// ============================================================================

/**
 * Workspace - Root organizational entity
 */
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  logo_url: string | null;
  settings: Record<string, any>;
  max_clinics: number;
  max_users: number;
  is_active: boolean;
  onboarding_completed: boolean;
  onboarding_step: number;
  subscription_status: string;
  subscription_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Organization - Legacy organizational entity
 */
export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

/**
 * Clinic - Individual dental office
 */
export interface Clinic {
  id: string;
  workspace_id: string;
  org_id: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

/**
 * Workspace User - Links users to workspaces
 */
export interface WorkspaceUser {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  permissions: Record<string, any>;
  is_active: boolean;
  joined_at: string;
  invited_by: string | null;
  invitation_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Workspace Member - Enhanced workspace membership
 */
export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: 'owner' | 'super_admin' | 'admin' | 'editor' | 'viewer';
  permissions: Record<string, any>;
  allowed_clinics: string[] | null;
  clinic_ids: string[];
  invitation_status: 'pending' | 'accepted' | 'rejected';
  invited_at: string;
  accepted_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Clinic User - Links users to specific clinics
 */
export interface ClinicUser {
  id: string;
  clinic_id: string;
  user_id: string;
  role: 'admin' | 'doctor' | 'assistant' | 'receptionist' | 'viewer';
  permissions: Record<string, any>;
  is_active: boolean;
  can_access_all_patients: boolean;
  assigned_chair: string | null;
  schedule: Record<string, any>;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Invitation - Pending workspace/clinic invitations
 */
export interface Invitation {
  id: string;
  workspace_id: string;
  clinic_id: string | null;
  email: string;
  role: string;
  permissions: Record<string, any>;
  token: string;
  expires_at: string;
  invited_by: string;
  accepted_at: string | null;
  rejected_at: string | null;
  created_at: string;
}

/**
 * Role Permission - Role-based permission definitions
 */
export interface RolePermission {
  id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  resource_name: string;
  action_name: string;
  allowed: boolean;
  created_at: string;
}

/**
 * Category Type - Meta-category definitions
 */
export interface CategoryType {
  id: string;
  name: string;
  display_name: string;
  code: string | null;
  description: string | null;
  icon: string | null;
  color: string | null;
  clinic_id: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Custom Category - Clinic-specific category instances
 */
export interface CustomCategory {
  id: string;
  clinic_id: string;
  category_type_id: string;
  name: string;
  display_name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Category - Generic category table
 */
export interface Category {
  id: string;
  clinic_id: string | null;
  category_type_id: string | null;
  entity_type: string;
  name: string;
  display_name: string;
  code: string | null;
  description: string | null;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
  metadata: Record<string, any>;
  display_order: number;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Settings Time - Clinic time configuration
 */
export interface SettingsTime {
  id: string;
  clinic_id: string;
  work_days: number;
  hours_per_day: number;
  real_pct: number;
  working_days_config: {
    manual: {
      monday: boolean;
      tuesday: boolean;
      wednesday: boolean;
      thursday: boolean;
      friday: boolean;
      saturday: boolean;
      sunday: boolean;
    };
    detected: any;
    useHistorical: boolean;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Patient Source - Patient acquisition source definitions
 */
export interface PatientSource {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_system: boolean;
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Asset - Capital assets and equipment
 */
export interface Asset {
  id: string;
  clinic_id: string;
  name: string;
  category: string | null;
  purchase_date: string;
  purchase_price_cents: bigint;
  depreciation_years: number;
  depreciation_months: number;
  monthly_depreciation_cents: bigint | null;
  disposal_date: string | null;
  disposal_value_cents: bigint | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Supply - Dental supplies and materials inventory
 */
export interface Supply {
  id: string;
  clinic_id: string;
  name: string;
  category: 'insumo' | 'bioseguridad' | 'consumibles' | 'materiales' | 'medicamentos' | 'equipos' | 'otros';
  presentation: string;
  price_cents: bigint;
  portions: number;
  cost_per_portion_cents: number;
  stock_quantity: number;
  min_stock_alert: number;
  last_purchase_price_cents: number | null;
  last_purchase_date: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fixed Cost - Recurring fixed cost definitions
 */
export interface FixedCost {
  id: string;
  clinic_id: string;
  category: string;
  concept: string;
  amount_cents: bigint;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Service - Service/procedure catalog
 */
export interface Service {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  category: string | null;
  est_minutes: number;
  fixed_cost_per_minute_cents: bigint;
  variable_cost_cents: bigint;
  margin_pct: number;
  price_cents: bigint;
  is_active: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Service Supply - Service recipes linking services to supplies
 */
export interface ServiceSupply {
  id: string;
  service_id: string;
  supply_id: string;
  qty: number;
  unit_cost_cents: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Tariff - Historical service pricing versions
 */
export interface Tariff {
  id: string;
  clinic_id: string;
  service_id: string;
  version: number;
  valid_from: string;
  valid_until: string | null;
  fixed_cost_per_minute_cents: bigint;
  variable_cost_cents: bigint;
  margin_pct: number;
  price_cents: bigint;
  rounded_price_cents: bigint;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Marketing Campaign - Marketing campaign tracking
 */
export interface MarketingCampaign {
  id: string;
  clinic_id: string;
  platform_id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  is_archived: boolean;
  archived_at: string | null;
  reactivated_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Marketing Campaign Status History - Campaign status change log
 */
export interface MarketingCampaignStatusHistory {
  id: string;
  campaign_id: string;
  status: string;
  changed_at: string;
}

/**
 * Patient - Patient master records
 */
export interface Patient {
  id: string;
  clinic_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  medical_history: string | null;
  allergies: string | null;
  medications: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  notes: string | null;
  first_visit_date: string | null;
  acquisition_date: string | null;
  source_id: string | null;
  referred_by_patient_id: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  platform_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Treatment - Individual treatment/appointment records
 */
export interface Treatment {
  id: string;
  clinic_id: string;
  patient_id: string;
  service_id: string;
  treatment_date: string;
  treatment_time: string | null;
  status: string;
  tooth_number: string | null;
  notes: string | null;
  minutes: number;
  fixed_cost_per_minute_cents: bigint;
  variable_cost_cents: bigint;
  margin_pct: number;
  price_cents: bigint;
  tariff_version: number | null;
  discount_pct: number;
  discount_reason: string | null;
  is_paid: boolean;
  payment_method: string | null;
  payment_date: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Expense - Expense tracking
 */
export interface Expense {
  id: string;
  clinic_id: string;
  expense_date: string;
  category_id: string;
  category: string;
  subcategory: string | null;
  description: string | null;
  amount_cents: bigint;
  vendor: string | null;
  invoice_number: string | null;
  is_recurring: boolean;
  is_paid: boolean;
  payment_method: string | null;
  related_asset_id: string | null;
  related_supply_id: string | null;
  quantity: number | null;
  auto_processed: boolean;
  campaign_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Workspace Activity - Audit log for workspace activities
 */
export interface WorkspaceActivity {
  id: string;
  workspace_id: string;
  clinic_id: string | null;
  user_id: string | null;
  user_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

// ============================================================================
// AI ASSISTANT TABLES (Migrations 50-54)
// ============================================================================

/**
 * Action Log - AI assistant action audit trail (Migration 50)
 */
export interface ActionLog {
  id: string;
  clinic_id: string;
  user_id: string | null;
  session_id: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  input_data: Record<string, any>;
  output_data: Record<string, any>;
  status: 'pending' | 'success' | 'failed' | 'rolled_back';
  error_message: string | null;
  execution_time_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

/**
 * Clinic Google Calendar - OAuth integration config (Migration 52)
 */
export interface ClinicGoogleCalendar {
  id: string;
  clinic_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  calendar_id: string | null;
  sync_enabled: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Chat Session - AI conversation sessions (Migration 54)
 */
export interface ChatSession {
  id: string;
  clinic_id: string;
  user_id: string;
  title: string | null;
  mode: 'entry' | 'query';
  is_active: boolean;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Chat Message - AI conversation messages (Migration 54)
 */
export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  audio_url: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

/**
 * AI Feedback - User feedback on AI responses (Migration 54)
 */
export interface AIFeedback {
  id: string;
  message_id: string;
  user_id: string;
  rating: number | null;
  feedback_type: 'positive' | 'negative' | 'neutral';
  comment: string | null;
  created_at: string;
}

// ============================================================================
// EXPORT BUNDLE TYPES
// ============================================================================

/**
 * Clinic Data Bundle - All data for a single clinic
 */
export interface ClinicDataBundle {
  // Clinic core
  clinic: Clinic;

  // Configuration (Level 4)
  settingsTime: SettingsTime | null;
  customCategories: CustomCategory[];
  categories: Category[];
  patientSources: PatientSource[];
  invitations: Invitation[];
  clinicUsers: ClinicUser[];

  // Inventory & Financial Setup (Level 5)
  assets: Asset[];
  supplies: Supply[];
  fixedCosts: FixedCost[];

  // Services (Level 6)
  services: Service[];
  serviceSupplies: ServiceSupply[];
  // DEPRECATED (2025-11-17): Optional for backwards compatibility
  // Discounts now stored in services table (migration 47)
  tariffs?: Tariff[];

  // Marketing (Level 7)
  marketingCampaigns: MarketingCampaign[];
  marketingCampaignStatusHistory: MarketingCampaignStatusHistory[];

  // Clinical (Level 8-9)
  patients: Patient[];
  treatments: Treatment[];

  // Expenses (Level 10)
  expenses: Expense[];

  // Optional: Audit logs
  workspaceActivity?: WorkspaceActivity[];

  // AI Assistant Data (Migrations 50-54)
  actionLogs?: ActionLog[];
  clinicGoogleCalendar?: ClinicGoogleCalendar | null;
  chatSessions?: ChatSession[];
  chatMessages?: ChatMessage[];
  aiFeedback?: AIFeedback[];

  // Record counts for validation
  recordCounts: Record<string, number>;
}

/**
 * Export Metadata - Bundle metadata and versioning info
 */
export interface ExportMetadata {
  /** Export format version (semver) */
  version: string;

  /** Schema version number (migration number) */
  schemaVersion: number;

  /** Export creation timestamp (ISO) */
  exportDate: string;

  /** Application version at export time */
  appVersion: string;

  /** User who created the export */
  exportedBy: {
    userId: string;
    email: string;
  };

  /** Workspace identification */
  workspaceId: string;
  workspaceName: string;

  /** Stats */
  clinicCount: number;
  recordCounts: Record<string, number>;

  /** Data integrity checksum (SHA-256) */
  checksum: string;
}

/**
 * Migration Info - Applied migrations at export time
 */
export interface MigrationInfo {
  schemaVersion: number;
  appliedMigrations: string[];
}

/**
 * Export Bundle - Complete export package
 */
export interface ExportBundle {
  metadata: ExportMetadata;

  data: {
    // Level 1: Global
    workspace: Workspace;
    organizations: Organization[];
    categoryTypes: CategoryType[];
    rolePermissions: RolePermission[];

    // Level 2: Workspace Users
    workspaceUsers: WorkspaceUser[];
    workspaceMembers: WorkspaceMember[];

    // Level 3+: Clinics with all nested data
    clinics: ClinicDataBundle[];
  };

  migrations: MigrationInfo;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation Error
 */
export interface ValidationError {
  type: 'CHECKSUM_MISMATCH' | 'INVALID_SCHEMA' | 'MISSING_FIELD' | 'FK_VIOLATION' | 'INVALID_TYPE' | 'CONSTRAINT_VIOLATION';
  table?: string;
  field?: string;
  message: string;
  recordId?: string;
  expected?: any;
  actual?: any;
}

/**
 * Validation Warning
 */
export interface ValidationWarning {
  type: 'VERSION_UPGRADE' | 'DATA_LOSS' | 'DEPRECATED_FIELD' | 'MIGRATION_REQUIRED';
  message: string;
  affectedRecords?: number;
  suggestion?: string;
}

/**
 * Validation Result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: {
    recordsToImport: number;
    estimatedDuration: number; // seconds
    diskSpaceRequired: number; // MB
  };
}

// ============================================================================
// EXPORT/IMPORT OPTIONS
// ============================================================================

/**
 * Export Options
 */
export interface ExportOptions {
  /** Include audit logs */
  includeAuditLogs?: boolean;

  /** Include only active records */
  activeOnly?: boolean;

  /** Date range filter */
  dateRange?: {
    from: string;
    to: string;
  };

  /** Include historical data (treatments, expenses) */
  includeHistorical?: boolean;

  /** Compress output with gzip */
  compress?: boolean;
}

/**
 * Import Options
 */
export interface ImportOptions {
  /** Create new workspace or merge into existing */
  mode: 'create' | 'merge';

  /** Target workspace ID (for merge mode) */
  targetWorkspaceId?: string;

  /** Skip validation */
  skipValidation?: boolean;

  /** Dry run (validate only, don't import) */
  dryRun?: boolean;

  /** Overwrite existing records with same ID */
  overwrite?: boolean;

  /** User ID performing the import */
  userId?: string;

  /** User email performing the import */
  userEmail?: string;
}

/**
 * Import Progress
 */
export interface ImportProgress {
  status: 'validating' | 'importing' | 'completed' | 'failed' | 'rolled_back';
  currentStep: string;
  progress: number; // 0-100
  recordsProcessed: number;
  totalRecords: number;
  errors: ValidationError[];
  startedAt: string;
  completedAt?: string;
}

/**
 * Import Result
 */
export interface ImportResult {
  success: boolean;
  workspaceId?: string;
  clinicIds?: string[];
  recordsImported: Record<string, number>;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  duration: number; // seconds
}
