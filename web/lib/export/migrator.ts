/**
 * Export Bundle Migrator
 *
 * Automatically migrates export bundles from older schema versions to the
 * current version using the migration catalog.
 *
 * This ensures forward-compatibility: exports created with old schema versions
 * can still be imported in newer versions of the application.
 */

import type { ExportBundle } from './types';
import {
  CURRENT_SCHEMA_VERSION,
  EXPORT_MIGRATIONS,
  getMigrationsToApply,
  hasMigrationPath,
  isFromFuture,
  needsMigration,
  getMigrationSummary,
} from './migrations';

/**
 * Migration Result
 */
export interface MigrationResult {
  success: boolean;
  originalVersion: number;
  finalVersion: number;
  migrationsApplied: number;
  migrationsSummary: string[];
  errors: string[];
  warnings: string[];
  bundle: ExportBundle;
}

/**
 * Migration Error
 */
export class MigrationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

/**
 * Export Migrator
 *
 * Handles automatic migration of export bundles between schema versions.
 */
export class ExportMigrator {
  /**
   * Migrates a bundle from its original version to the current schema version
   *
   * @param bundle - The export bundle to migrate
   * @param options - Migration options
   * @returns Migration result with the migrated bundle
   *
   * @throws {MigrationError} If migration fails or bundle is from future
   *
   * @example
   * ```typescript
   * const migrator = new ExportMigrator();
   * const result = migrator.migrate(oldBundle);
   *
   * if (result.success) {
   *   console.log(`Migrated from v${result.originalVersion} to v${result.finalVersion}`);
   *   console.log('Applied migrations:', result.migrationsSummary);
   *   // Use result.bundle for import
   * }
   * ```
   */
  migrate(
    bundle: ExportBundle,
    options: {
      /** Validate bundle after each migration step */
      validateEachStep?: boolean;
      /** Continue on validation warnings */
      continueOnWarnings?: boolean;
    } = {}
  ): MigrationResult {
    const originalVersion = bundle.metadata.schemaVersion;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if bundle is already at current version
    if (originalVersion === CURRENT_SCHEMA_VERSION) {
      return {
        success: true,
        originalVersion,
        finalVersion: CURRENT_SCHEMA_VERSION,
        migrationsApplied: 0,
        migrationsSummary: [],
        errors: [],
        warnings: ['Bundle is already at current schema version'],
        bundle,
      };
    }

    // Check if bundle is from a future version
    if (isFromFuture(originalVersion)) {
      throw new MigrationError(
        `Bundle is from a future schema version (v${originalVersion}). ` +
          `Current version is v${CURRENT_SCHEMA_VERSION}. ` +
          `Please update the application to import this bundle.`,
        'FUTURE_VERSION',
        { bundleVersion: originalVersion, currentVersion: CURRENT_SCHEMA_VERSION }
      );
    }

    // Check if migration path exists
    if (!hasMigrationPath(originalVersion, CURRENT_SCHEMA_VERSION)) {
      throw new MigrationError(
        `No migration path exists from v${originalVersion} to v${CURRENT_SCHEMA_VERSION}. ` +
          `Some intermediate migrations may be missing.`,
        'NO_MIGRATION_PATH',
        { from: originalVersion, to: CURRENT_SCHEMA_VERSION }
      );
    }

    // Get migrations to apply
    const migrationsToApply = getMigrationsToApply(originalVersion);

    if (migrationsToApply.length === 0) {
      warnings.push(
        `No migrations found from v${originalVersion} to v${CURRENT_SCHEMA_VERSION}, ` +
          `but versions differ. This may indicate a gap in the migration registry.`
      );
    }

    // Apply migrations sequentially
    let migratedBundle = { ...bundle };
    let appliedCount = 0;

    for (const migration of migrationsToApply) {
      try {
        console.log(`Applying migration: v${migration.from} → v${migration.to}`);
        console.log(`  Description: ${migration.description}`);

        // Apply transformation
        migratedBundle = migration.transform(migratedBundle);
        appliedCount++;

        // Update schema version in metadata
        migratedBundle.metadata.schemaVersion = migration.to;

        // Validate after migration if requested
        if (options.validateEachStep && migration.validate) {
          const validationErrors = migration.validate(migratedBundle);
          if (validationErrors.length > 0) {
            errors.push(...validationErrors);

            if (!options.continueOnWarnings) {
              throw new MigrationError(
                `Migration v${migration.from}→v${migration.to} validation failed: ${validationErrors.join(', ')}`,
                'VALIDATION_FAILED',
                { migration: migration.description, errors: validationErrors }
              );
            } else {
              warnings.push(
                `Migration v${migration.from}→v${migration.to} has validation warnings: ${validationErrors.join(', ')}`
              );
            }
          }
        }

        console.log(`  ✓ Migration applied successfully`);
      } catch (error) {
        if (error instanceof MigrationError) {
          throw error;
        }

        throw new MigrationError(
          `Migration v${migration.from}→v${migration.to} failed: ${error instanceof Error ? error.message : String(error)}`,
          'MIGRATION_FAILED',
          { migration: migration.description, error }
        );
      }
    }

    // Final version check
    const finalVersion = migratedBundle.metadata.schemaVersion;

    if (finalVersion !== CURRENT_SCHEMA_VERSION) {
      errors.push(
        `Migration completed but final version (v${finalVersion}) does not match current version (v${CURRENT_SCHEMA_VERSION})`
      );
    }

    return {
      success: errors.length === 0,
      originalVersion,
      finalVersion,
      migrationsApplied: appliedCount,
      migrationsSummary: getMigrationSummary(originalVersion, finalVersion),
      errors,
      warnings,
      bundle: migratedBundle,
    };
  }

  /**
   * Checks if a bundle can be migrated to the current version
   *
   * @param bundleVersion - Bundle's schema version
   * @returns Object with migration feasibility info
   *
   * @example
   * ```typescript
   * const migrator = new ExportMigrator();
   * const check = migrator.canMigrate(39);
   *
   * if (check.canMigrate) {
   *   console.log('Migrations needed:', check.migrationsNeeded);
   * } else {
   *   console.error('Cannot migrate:', check.reason);
   * }
   * ```
   */
  canMigrate(bundleVersion: number): {
    canMigrate: boolean;
    reason?: string;
    migrationsNeeded: number;
    summary: string[];
  } {
    // Already at current version
    if (bundleVersion === CURRENT_SCHEMA_VERSION) {
      return {
        canMigrate: true,
        migrationsNeeded: 0,
        summary: [],
      };
    }

    // From future version
    if (isFromFuture(bundleVersion)) {
      return {
        canMigrate: false,
        reason: `Bundle is from future version v${bundleVersion} (current: v${CURRENT_SCHEMA_VERSION})`,
        migrationsNeeded: 0,
        summary: [],
      };
    }

    // Check migration path
    if (!hasMigrationPath(bundleVersion, CURRENT_SCHEMA_VERSION)) {
      return {
        canMigrate: false,
        reason: `No migration path exists from v${bundleVersion} to v${CURRENT_SCHEMA_VERSION}`,
        migrationsNeeded: 0,
        summary: [],
      };
    }

    // Can migrate
    const migrations = getMigrationsToApply(bundleVersion);
    return {
      canMigrate: true,
      migrationsNeeded: migrations.length,
      summary: getMigrationSummary(bundleVersion, CURRENT_SCHEMA_VERSION),
    };
  }

  /**
   * Dry run: checks what migrations would be applied without applying them
   *
   * @param bundle - Export bundle to analyze
   * @returns Object with migration preview
   *
   * @example
   * ```typescript
   * const migrator = new ExportMigrator();
   * const preview = migrator.previewMigration(bundle);
   *
   * console.log('Will apply:', preview.migrationsToApply.length, 'migrations');
   * preview.migrationsSummary.forEach(m => console.log('  -', m));
   * ```
   */
  previewMigration(bundle: ExportBundle): {
    currentVersion: number;
    targetVersion: number;
    needsMigration: boolean;
    migrationsToApply: number;
    migrationsSummary: string[];
    canMigrate: boolean;
    reason?: string;
  } {
    const currentVersion = bundle.metadata.schemaVersion;
    const check = this.canMigrate(currentVersion);

    return {
      currentVersion,
      targetVersion: CURRENT_SCHEMA_VERSION,
      needsMigration: needsMigration(currentVersion),
      migrationsToApply: check.migrationsNeeded,
      migrationsSummary: check.summary,
      canMigrate: check.canMigrate,
      reason: check.reason,
    };
  }

  /**
   * Gets information about the current migration system
   *
   * @returns System information
   *
   * @example
   * ```typescript
   * const migrator = new ExportMigrator();
   * const info = migrator.getSystemInfo();
   * console.log('Current schema version:', info.currentSchemaVersion);
   * console.log('Total migrations registered:', info.totalMigrations);
   * ```
   */
  getSystemInfo() {
    return {
      currentSchemaVersion: CURRENT_SCHEMA_VERSION,
      totalMigrations: EXPORT_MIGRATIONS.length,
      oldestSupportedVersion:
        EXPORT_MIGRATIONS.length > 0
          ? Math.min(...EXPORT_MIGRATIONS.map((m) => m.from))
          : CURRENT_SCHEMA_VERSION,
      newestSupportedVersion: CURRENT_SCHEMA_VERSION,
    };
  }
}

/**
 * Convenience function to migrate a bundle
 *
 * @param bundle - Export bundle to migrate
 * @returns Migrated bundle
 * @throws {MigrationError} If migration fails
 *
 * @example
 * ```typescript
 * const migratedBundle = await migrateBundle(oldBundle);
 * ```
 */
export function migrateBundle(bundle: ExportBundle): ExportBundle {
  const migrator = new ExportMigrator();
  const result = migrator.migrate(bundle, {
    validateEachStep: true,
    continueOnWarnings: true,
  });

  if (!result.success) {
    throw new MigrationError(
      `Migration failed: ${result.errors.join(', ')}`,
      'MIGRATION_FAILED',
      { errors: result.errors, warnings: result.warnings }
    );
  }

  return result.bundle;
}

/**
 * Convenience function to preview migration without applying
 *
 * @param bundle - Export bundle to preview
 * @returns Migration preview
 *
 * @example
 * ```typescript
 * const preview = previewMigration(bundle);
 * if (preview.needsMigration) {
 *   console.log('Migrations required:', preview.migrationsSummary);
 * }
 * ```
 */
export function previewMigration(bundle: ExportBundle) {
  const migrator = new ExportMigrator();
  return migrator.previewMigration(bundle);
}
