/**
 * Export/Import System
 *
 * Complete system for exporting and importing workspace data with
 * forward-compatible versioning and automatic migrations.
 *
 * @example
 * ```typescript
 * import { ExportMigrator, generateChecksum, CURRENT_SCHEMA_VERSION } from '@/lib/export';
 *
 * // Migrate old bundle
 * const migrator = new ExportMigrator();
 * const result = migrator.migrate(oldBundle);
 *
 * // Generate checksum
 * const checksum = await generateChecksum(bundle);
 * ```
 */

// Types
export type {
  // Database types
  Workspace,
  Organization,
  Clinic,
  WorkspaceUser,
  WorkspaceMember,
  ClinicUser,
  Invitation,
  RolePermission,
  CategoryType,
  CustomCategory,
  Category,
  SettingsTime,
  PatientSource,
  Asset,
  Supply,
  FixedCost,
  Service,
  ServiceSupply,
  Tariff,
  MarketingCampaign,
  MarketingCampaignStatusHistory,
  Patient,
  Treatment,
  Expense,
  WorkspaceActivity,
  // Bundle types
  ClinicDataBundle,
  ExportMetadata,
  MigrationInfo,
  ExportBundle,
  // Validation types
  ValidationError,
  ValidationWarning,
  ValidationResult,
  // Options types
  ExportOptions,
  ImportOptions,
  ImportProgress,
  ImportResult,
} from './types';

// Checksum functions
export {
  generateChecksum,
  verifyChecksum,
  addChecksum,
  calculateDataChecksum,
  validateMoneyFields,
} from './checksum';

// Migration catalog
export type { ExportMigration } from './migrations';
export {
  CURRENT_SCHEMA_VERSION,
  EXPORT_FORMAT_VERSION,
  EXPORT_MIGRATIONS,
  getMigrationsToApply,
  hasMigrationPath,
  getMigrationSummary,
  validateMigrationRegistry,
  needsMigration,
  isFromFuture,
  getMigrationStats,
} from './migrations';

// Migrator
export type { MigrationResult } from './migrator';
export { ExportMigrator, MigrationError, migrateBundle, previewMigration } from './migrator';

// Exporter
export type { ExportStats } from './exporter';
export { WorkspaceExporter, ExportError } from './exporter';

// Validator
export { BundleValidator, ValidationException, validateBundle } from './validator';

// Importer
export { WorkspaceBundleImporter, ImportError } from './importer';
