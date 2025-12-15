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
  global_discount_config: {
    enabled: boolean;
    type: 'percentage' | 'fixed';
    value: number;
  } | null;
  price_rounding: number; // Default 10
  auto_complete_appointments: boolean;
  notification_settings: {
    sender_name: string | null;
    email_enabled: boolean;
    reply_to_email: string | null;
    reminder_enabled: boolean;
    confirmation_enabled: boolean;
    reminder_hours_before: number;
  } | null;
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
  monthly_goal_cents: bigint | null; // Migration 57: Monthly revenue goal
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
 * Service - Service/procedure catalog with integrated pricing (v3)
 * Note: tariffs table is DEPRECATED - all pricing is now in services
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
  price_cents: bigint; // SINGLE SOURCE OF TRUTH: Final price with discount applied
  // Migration 46: Discount fields moved from tariffs
  discount_type: 'none' | 'percentage' | 'fixed';
  discount_value: number; // Percentage (0-100) or cents depending on type
  discount_reason: string | null;
  final_price_with_discount_cents: number | null; // Calculated field
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
 * Contains immutable cost snapshots from time of treatment
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
  tariff_version: number | null; // DEPRECATED: kept for legacy data
  discount_pct: number; // DEPRECATED: use service snapshot instead
  discount_reason: string | null; // DEPRECATED: use service snapshot instead
  is_paid: boolean;
  payment_method: string | null;
  payment_date: string | null;
  // Migration 55: Refund tracking
  is_refunded: boolean;
  refunded_at: string | null;
  refund_reason: string | null;
  // Migration 52: Google Calendar sync
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Expense - Expense tracking with recurring support
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
  notes: string | null;
  is_variable: boolean;
  expense_category: string | null;
  recurrence_interval: 'weekly' | 'monthly' | 'yearly' | null;
  recurrence_day: number | null;
  next_recurrence_date: string | null;
  parent_expense_id: string | null;
  related_fixed_cost_id: string | null;
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
 * Records all actions executed by Lara AI assistant
 */
export interface ActionLog {
  id: string;
  clinic_id: string;
  user_id: string | null;
  action_type: string; // update_service_price, adjust_service_margin, etc.
  success: boolean;
  params: Record<string, any>;
  result: Record<string, any> | null; // Before/after state
  error_code: string | null;
  error_message: string | null;
  error_details: Record<string, any> | null;
  dry_run: boolean;
  executed_at: string;
  created_at: string;
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
  started_at: string;
  ended_at: string | null;
  last_message_at: string;
  message_count: number;
  is_archived: boolean;
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
  thinking_process: string | null; // Kimi K2 thinking process
  model_used: string | null; // LLM model identifier
  tokens_used: number | null; // Approximate token count
  action_suggested: Record<string, any> | null; // ActionSuggestion object
  action_executed: boolean;
  action_result: Record<string, any> | null; // ActionResult if executed
  entity_type: string | null; // For entry mode entities
  extracted_data: Record<string, any> | null; // Extracted form data
  audio_duration_ms: number | null; // Voice message duration
  created_at: string;
}

/**
 * AI Feedback - User feedback on AI responses (Migration 54)
 */
export interface AIFeedback {
  id: string;
  message_id: string;
  clinic_id: string;
  user_id: string;
  rating: 'positive' | 'negative'; // CHECK constraint only allows these values
  comment: string | null;
  query_type: string | null; // Category of query
  created_at: string;
}

// ============================================================================
// NOTIFICATIONS & REMINDERS TABLES
// ============================================================================

/**
 * Email Notification - Email notifications sent to patients
 */
export interface EmailNotification {
  id: string;
  clinic_id: string;
  treatment_id: string | null;
  patient_id: string | null;
  notification_type: 'confirmation' | 'reminder' | 'cancellation' | 'reschedule';
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced' | 'opened';
  sent_at: string | null;
  opened_at: string | null;
  error_message: string | null;
  provider: string;
  provider_message_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * SMS Notification - SMS notifications sent to patients
 */
export interface SMSNotification {
  id: string;
  clinic_id: string;
  treatment_id: string | null;
  patient_id: string | null;
  notification_type: 'appointment_confirmation' | 'appointment_reminder' | 'appointment_cancelled' | 'appointment_rescheduled' | 'booking_received' | 'booking_confirmed' | 'custom';
  recipient_phone: string;
  recipient_name: string | null;
  message_content: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  sent_at: string | null;
  delivered_at: string | null;
  error_message: string | null;
  provider: string;
  provider_message_id: string | null;
  cost_cents: number;
  created_at: string;
  updated_at: string;
}

/**
 * Scheduled Reminder - Reminders scheduled to be sent
 */
export interface ScheduledReminder {
  id: string;
  clinic_id: string;
  treatment_id: string;
  patient_id: string;
  scheduled_for: string;
  reminder_type: '24h' | '48h' | '1h' | 'custom';
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  processed_at: string | null;
  email_notification_id: string | null;
  created_at: string;
}

/**
 * Push Subscription - Web push notification subscriptions
 */
export interface PushSubscription {
  id: string;
  clinic_id: string;
  user_id: string;
  endpoint: string;
  expiration_time: string | null;
  keys_p256dh: string;
  keys_auth: string;
  user_agent: string | null;
  device_name: string | null;
  is_active: boolean;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Push Notification - Push notifications sent to users
 */
export interface PushNotification {
  id: string;
  clinic_id: string;
  subscription_id: string | null;
  notification_type: string;
  title: string;
  body: string;
  icon_url: string | null;
  action_url: string | null;
  status: string;
  sent_at: string | null;
  clicked_at: string | null;
  error_message: string | null;
  created_at: string;
}

// ============================================================================
// PRESCRIPTIONS & MEDICATIONS TABLES
// ============================================================================

/**
 * Medication - Medication catalog (can be clinic-specific or global)
 */
export interface Medication {
  id: string;
  clinic_id: string | null;
  name: string;
  generic_name: string | null;
  brand_name: string | null;
  category: string | null;
  controlled_substance: boolean;
  requires_prescription: boolean;
  dosage_form: string | null;
  strength: string | null;
  unit: string | null;
  default_dosage: string | null;
  default_frequency: string | null;
  default_duration: string | null;
  default_instructions: string | null;
  common_uses: string[];
  contraindications: string | null;
  side_effects: string | null;
  interactions: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Prescription - Medical prescriptions issued by the clinic
 */
export interface Prescription {
  id: string;
  clinic_id: string;
  patient_id: string;
  treatment_id: string | null;
  prescription_number: string | null;
  prescription_date: string;
  prescriber_name: string;
  prescriber_license: string | null;
  prescriber_specialty: string | null;
  diagnosis: string | null;
  status: 'active' | 'cancelled' | 'expired' | 'dispensed';
  valid_until: string | null;
  notes: string | null;
  pharmacy_notes: string | null;
  pdf_generated_at: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/**
 * Prescription Item - Individual medication items in a prescription
 */
export interface PrescriptionItem {
  id: string;
  prescription_id: string;
  medication_id: string | null;
  medication_name: string;
  medication_strength: string | null;
  medication_form: string | null;
  dosage: string;
  frequency: string;
  duration: string | null;
  quantity: string | null;
  instructions: string | null;
  sort_order: number;
  created_at: string;
}

// ============================================================================
// QUOTES (PRESUPUESTOS) TABLES
// ============================================================================

/**
 * Quote - Patient quotes/estimates
 */
export interface Quote {
  id: string;
  clinic_id: string;
  patient_id: string;
  quote_number: string | null;
  quote_date: string;
  validity_days: number;
  valid_until: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';
  subtotal_cents: bigint;
  discount_type: 'none' | 'percentage' | 'fixed' | null;
  discount_value: number;
  discount_cents: bigint;
  tax_rate: number;
  tax_cents: bigint;
  total_cents: bigint;
  notes: string | null;
  patient_notes: string | null;
  terms_conditions: string | null;
  pdf_generated_at: string | null;
  sent_at: string | null;
  sent_via: string | null;
  responded_at: string | null;
  response_notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/**
 * Quote Item - Individual line items in a quote
 */
export interface QuoteItem {
  id: string;
  quote_id: string;
  service_id: string | null;
  service_name: string;
  service_description: string | null;
  quantity: number;
  unit_price_cents: bigint;
  discount_type: 'none' | 'percentage' | 'fixed';
  discount_value: number;
  discount_cents: bigint;
  subtotal_cents: bigint;
  total_cents: bigint;
  tooth_number: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

// ============================================================================
// USER SETTINGS TABLE
// ============================================================================

/**
 * User Settings - User-specific settings stored as key-value pairs
 */
export interface UserSetting {
  user_id: string;
  key: string;
  value: Record<string, any>;
  created_at: string;
  updated_at: string;
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

  // Notifications & Reminders
  emailNotifications?: EmailNotification[];
  smsNotifications?: SMSNotification[];
  scheduledReminders?: ScheduledReminder[];
  pushSubscriptions?: PushSubscription[];
  pushNotifications?: PushNotification[];

  // Prescriptions & Medications
  medications?: Medication[];
  prescriptions?: Prescription[];
  prescriptionItems?: PrescriptionItem[];

  // Quotes (Presupuestos)
  quotes?: Quote[];
  quoteItems?: QuoteItem[];

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
