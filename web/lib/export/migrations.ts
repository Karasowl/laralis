/**
 * Export Migration Catalog
 *
 * This file contains all migrations for the export/import system.
 * When the database schema evolves, add new migrations here to ensure
 * that old export bundles can still be imported in newer versions.
 *
 * IMPORTANT: Migrations are applied sequentially from the bundle's schema
 * version to the current schema version.
 */

import type { ExportBundle } from './types';

/**
 * Export Migration
 *
 * Defines a transformation from one schema version to the next.
 */
export interface ExportMigration {
  /** Source schema version */
  from: number;

  /** Target schema version */
  to: number;

  /** Human-readable description of changes */
  description: string;

  /** Transformation function */
  transform: (bundle: ExportBundle) => ExportBundle;

  /** Optional: Validation function to run after migration */
  validate?: (bundle: ExportBundle) => string[];
}

/**
 * Current Schema Version
 *
 * This should match the latest migration number in supabase/migrations/
 * Update this when you add database migrations.
 */
export const CURRENT_SCHEMA_VERSION = 41;

/**
 * Export Format Version
 *
 * Follows semantic versioning (major.minor.patch)
 * - Major: Breaking changes in export format structure
 * - Minor: New tables/fields added (backward compatible)
 * - Patch: Bug fixes
 */
export const EXPORT_FORMAT_VERSION = '1.0.0';

/**
 * Migration Registry
 *
 * ALL migrations MUST be registered here in sequential order.
 * Each migration transforms a bundle from version N to N+1.
 *
 * HOW TO ADD A NEW MIGRATION:
 *
 * 1. Create your database migration file (e.g., 42_add_appointments.sql)
 * 2. Update CURRENT_SCHEMA_VERSION above to 42
 * 3. Add a migration entry below:
 *
 * ```typescript
 * {
 *   from: 41,
 *   to: 42,
 *   description: "Add appointments table",
 *   transform: (bundle) => {
 *     // Add appointments array to each clinic
 *     return {
 *       ...bundle,
 *       data: {
 *         ...bundle.data,
 *         clinics: bundle.data.clinics.map(clinic => ({
 *           ...clinic,
 *           appointments: [], // new field
 *         })),
 *       },
 *     };
 *   },
 *   validate: (bundle) => {
 *     const errors: string[] = [];
 *     bundle.data.clinics.forEach((clinic, i) => {
 *       if (!Array.isArray(clinic.appointments)) {
 *         errors.push(`Clinic ${i} missing appointments array`);
 *       }
 *     });
 *     return errors;
 *   },
 * }
 * ```
 */
export const EXPORT_MIGRATIONS: ExportMigration[] = [
  // Example migration (this is a template - remove when adding real migrations)
  // {
  //   from: 41,
  //   to: 42,
  //   description: "Add campaign_id field to expenses table",
  //   transform: (bundle: ExportBundle) => {
  //     return {
  //       ...bundle,
  //       metadata: {
  //         ...bundle.metadata,
  //         schemaVersion: 42,
  //       },
  //       data: {
  //         ...bundle.data,
  //         clinics: bundle.data.clinics.map((clinic) => ({
  //           ...clinic,
  //           expenses: clinic.expenses.map((expense) => ({
  //             ...expense,
  //             campaign_id: expense.campaign_id || null,
  //           })),
  //         })),
  //       },
  //     };
  //   },
  //   validate: (bundle: ExportBundle) => {
  //     const errors: string[] = [];
  //     bundle.data.clinics.forEach((clinic, clinicIndex) => {
  //       clinic.expenses.forEach((expense, expenseIndex) => {
  //         if (!('campaign_id' in expense)) {
  //           errors.push(
  //             `Clinic ${clinicIndex}, Expense ${expenseIndex}: missing campaign_id field`
  //           );
  //         }
  //       });
  //     });
  //     return errors;
  //   },
  // },

  // Add future migrations here...
];

/**
 * Gets all migrations needed to upgrade from a specific version to current
 *
 * @param fromVersion - Source schema version
 * @returns Array of migrations to apply in order
 *
 * @example
 * ```typescript
 * const migrations = getMigrationsToApply(39);
 * // Returns migrations: [39→40, 40→41]
 * ```
 */
export function getMigrationsToApply(fromVersion: number): ExportMigration[] {
  const migrations: ExportMigration[] = [];

  for (let v = fromVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    const migration = EXPORT_MIGRATIONS.find((m) => m.from === v && m.to === v + 1);
    if (migration) {
      migrations.push(migration);
    }
  }

  return migrations;
}

/**
 * Checks if a migration path exists from source to target version
 *
 * @param fromVersion - Source schema version
 * @param toVersion - Target schema version (defaults to current)
 * @returns true if migration path exists
 *
 * @example
 * ```typescript
 * const canMigrate = hasMigrationPath(39, 41);
 * // true if migrations 39→40 and 40→41 exist
 * ```
 */
export function hasMigrationPath(
  fromVersion: number,
  toVersion: number = CURRENT_SCHEMA_VERSION
): boolean {
  for (let v = fromVersion; v < toVersion; v++) {
    const migration = EXPORT_MIGRATIONS.find((m) => m.from === v && m.to === v + 1);
    if (!migration) {
      return false;
    }
  }
  return true;
}

/**
 * Gets a summary of all migrations between two versions
 *
 * @param fromVersion - Source schema version
 * @param toVersion - Target schema version (defaults to current)
 * @returns Array of migration descriptions
 *
 * @example
 * ```typescript
 * const summary = getMigrationSummary(39);
 * // ['Add campaign_id to expenses', 'Create appointments table']
 * ```
 */
export function getMigrationSummary(
  fromVersion: number,
  toVersion: number = CURRENT_SCHEMA_VERSION
): string[] {
  const migrations = getMigrationsToApply(fromVersion);
  return migrations.map((m) => `v${m.from}→v${m.to}: ${m.description}`);
}

/**
 * Validates that the migration registry is consistent
 *
 * @returns Array of validation errors (empty if valid)
 *
 * @example
 * ```typescript
 * const errors = validateMigrationRegistry();
 * if (errors.length > 0) {
 *   console.error('Migration registry is invalid:', errors);
 * }
 * ```
 */
export function validateMigrationRegistry(): string[] {
  const errors: string[] = [];

  // Check for gaps in version sequence
  const versions = EXPORT_MIGRATIONS.map((m) => m.from).sort((a, b) => a - b);
  for (let i = 0; i < versions.length - 1; i++) {
    if (versions[i + 1] !== versions[i] + 1) {
      errors.push(`Gap in migration versions: ${versions[i]} → ${versions[i + 1]}`);
    }
  }

  // Check for duplicate migrations
  const seen = new Set<string>();
  EXPORT_MIGRATIONS.forEach((m) => {
    const key = `${m.from}-${m.to}`;
    if (seen.has(key)) {
      errors.push(`Duplicate migration: ${key}`);
    }
    seen.add(key);
  });

  // Check that migrations are sequential (from→to = +1)
  EXPORT_MIGRATIONS.forEach((m) => {
    if (m.to !== m.from + 1) {
      errors.push(`Non-sequential migration: ${m.from} → ${m.to} (must be +1)`);
    }
  });

  return errors;
}

/**
 * Determines if a bundle needs migration
 *
 * @param bundleVersion - Bundle's schema version
 * @returns true if migration is needed
 *
 * @example
 * ```typescript
 * if (needsMigration(bundle.metadata.schemaVersion)) {
 *   console.log('Bundle needs migration to current version');
 * }
 * ```
 */
export function needsMigration(bundleVersion: number): boolean {
  return bundleVersion < CURRENT_SCHEMA_VERSION;
}

/**
 * Checks if a bundle is from a future version
 *
 * @param bundleVersion - Bundle's schema version
 * @returns true if bundle is from the future
 *
 * @example
 * ```typescript
 * if (isFromFuture(bundle.metadata.schemaVersion)) {
 *   throw new Error('Please update the application');
 * }
 * ```
 */
export function isFromFuture(bundleVersion: number): boolean {
  return bundleVersion > CURRENT_SCHEMA_VERSION;
}

/**
 * Migration statistics
 */
export interface MigrationStats {
  totalMigrations: number;
  oldestVersion: number;
  newestVersion: number;
  currentVersion: number;
  hasGaps: boolean;
}

/**
 * Gets statistics about the migration registry
 *
 * @returns Migration statistics
 *
 * @example
 * ```typescript
 * const stats = getMigrationStats();
 * console.log(`We have ${stats.totalMigrations} migrations registered`);
 * ```
 */
export function getMigrationStats(): MigrationStats {
  const versions = EXPORT_MIGRATIONS.map((m) => m.from).sort((a, b) => a - b);

  return {
    totalMigrations: EXPORT_MIGRATIONS.length,
    oldestVersion: versions.length > 0 ? versions[0] : CURRENT_SCHEMA_VERSION,
    newestVersion:
      EXPORT_MIGRATIONS.length > 0
        ? Math.max(...EXPORT_MIGRATIONS.map((m) => m.to))
        : CURRENT_SCHEMA_VERSION,
    currentVersion: CURRENT_SCHEMA_VERSION,
    hasGaps: validateMigrationRegistry().length > 0,
  };
}
