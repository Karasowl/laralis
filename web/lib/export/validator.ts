/**
 * Export Bundle Validator
 *
 * Validates export bundles before import to ensure data integrity and compatibility.
 * Performs extensive validation including checksums, foreign keys, types, and constraints.
 */

import type { ExportBundle, ValidationResult, ValidationError, ValidationWarning } from './types';
import { verifyChecksum, validateMoneyFields } from './checksum';
import { needsMigration, isFromFuture, getMigrationSummary, CURRENT_SCHEMA_VERSION } from './migrations';

/**
 * Validation Error Type
 */
export class ValidationException extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ValidationException';
  }
}

/**
 * Bundle Validator
 *
 * Validates export bundles comprehensively before import.
 */
export class BundleValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationWarning[] = [];
  private bundle: ExportBundle;

  constructor(bundle: ExportBundle) {
    this.bundle = bundle;
  }

  /**
   * Validate the bundle completely
   */
  async validate(): Promise<ValidationResult> {
    const startTime = Date.now();
    this.errors = [];
    this.warnings = [];

    try {
      // 1. Validate structure
      this.validateStructure();

      // 2. Validate checksum
      await this.validateChecksum();

      // 3. Validate schema version
      this.validateSchemaVersion();

      // 4. Validate money fields
      this.validateMoney();

      // 5. Validate data types
      this.validateDataTypes();

      // 6. Validate foreign keys
      this.validateForeignKeys();

      // 7. Validate unique constraints
      this.validateUniqueConstraints();

      // 8. Validate required fields
      this.validateRequiredFields();

      // Calculate stats
      const recordsToImport = this.countRecords();
      const estimatedDuration = this.estimateDuration(recordsToImport);
      const diskSpaceRequired = this.estimateDiskSpace();

      return {
        valid: this.errors.length === 0,
        errors: this.errors,
        warnings: this.warnings,
        stats: {
          recordsToImport,
          estimatedDuration,
          diskSpaceRequired,
        },
      };
    } catch (error) {
      this.addError({
        type: 'INVALID_SCHEMA',
        message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
      });

      return {
        valid: false,
        errors: this.errors,
        warnings: this.warnings,
        stats: {
          recordsToImport: 0,
          estimatedDuration: 0,
          diskSpaceRequired: 0,
        },
      };
    }
  }

  /**
   * Validate bundle structure
   */
  private validateStructure() {
    // Check top-level structure
    if (!this.bundle.metadata) {
      this.addError({
        type: 'INVALID_SCHEMA',
        message: 'Missing metadata in bundle',
      });
      return;
    }

    if (!this.bundle.data) {
      this.addError({
        type: 'INVALID_SCHEMA',
        message: 'Missing data in bundle',
      });
      return;
    }

    if (!this.bundle.migrations) {
      this.addError({
        type: 'INVALID_SCHEMA',
        message: 'Missing migrations info in bundle',
      });
      return;
    }

    // Check metadata fields
    const requiredMetadataFields = [
      'version',
      'schemaVersion',
      'exportDate',
      'workspaceId',
      'workspaceName',
      'checksum',
    ];

    for (const field of requiredMetadataFields) {
      if (!(field in this.bundle.metadata)) {
        this.addError({
          type: 'MISSING_FIELD',
          field: `metadata.${field}`,
          message: `Missing required metadata field: ${field}`,
        });
      }
    }

    // Check data structure
    if (!this.bundle.data.workspace) {
      this.addError({
        type: 'INVALID_SCHEMA',
        message: 'Missing workspace in data',
      });
    }

    if (!Array.isArray(this.bundle.data.clinics)) {
      this.addError({
        type: 'INVALID_SCHEMA',
        message: 'Clinics must be an array',
      });
    }
  }

  /**
   * Validate checksum
   */
  private async validateChecksum() {
    try {
      const isValid = await verifyChecksum(this.bundle);
      if (!isValid) {
        this.addError({
          type: 'CHECKSUM_MISMATCH',
          message: 'Bundle checksum verification failed. Data may be corrupted.',
        });
      }
    } catch (error) {
      this.addError({
        type: 'CHECKSUM_MISMATCH',
        message: `Checksum validation error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Validate schema version and migrations
   */
  private validateSchemaVersion() {
    const bundleVersion = this.bundle.metadata.schemaVersion;

    // Check if from future
    if (isFromFuture(bundleVersion)) {
      this.addError({
        type: 'INVALID_SCHEMA',
        message: `Bundle is from future schema version v${bundleVersion} (current: v${CURRENT_SCHEMA_VERSION}). Please update the application.`,
        expected: CURRENT_SCHEMA_VERSION,
        actual: bundleVersion,
      });
      return;
    }

    // Check if needs migration
    if (needsMigration(bundleVersion)) {
      const migrations = getMigrationSummary(bundleVersion);
      this.addWarning({
        type: 'MIGRATION_REQUIRED',
        message: `Bundle will be migrated from v${bundleVersion} to v${CURRENT_SCHEMA_VERSION}`,
        affectedRecords: this.countRecords(),
        suggestion: `Migrations to apply: ${migrations.join(', ')}`,
      });
    }
  }

  /**
   * Validate money fields are integers
   */
  private validateMoney() {
    const moneyErrors = validateMoneyFields(this.bundle);
    for (const error of moneyErrors) {
      this.addError({
        type: 'INVALID_TYPE',
        message: error,
      });
    }
  }

  /**
   * Validate data types
   */
  private validateDataTypes() {
    // Validate workspace
    if (this.bundle.data.workspace) {
      this.validateWorkspaceTypes(this.bundle.data.workspace);
    }

    // Validate clinics
    this.bundle.data.clinics.forEach((clinic, index) => {
      this.validateClinicTypes(clinic, index);
    });
  }

  /**
   * Validate workspace types
   */
  private validateWorkspaceTypes(workspace: any) {
    if (typeof workspace.id !== 'string') {
      this.addError({
        type: 'INVALID_TYPE',
        table: 'workspaces',
        field: 'id',
        message: 'Workspace ID must be a string (UUID)',
        expected: 'string',
        actual: typeof workspace.id,
      });
    }

    if (typeof workspace.name !== 'string') {
      this.addError({
        type: 'INVALID_TYPE',
        table: 'workspaces',
        field: 'name',
        message: 'Workspace name must be a string',
        expected: 'string',
        actual: typeof workspace.name,
      });
    }
  }

  /**
   * Validate clinic types
   */
  private validateClinicTypes(clinic: any, clinicIndex: number) {
    if (!clinic.clinic || typeof clinic.clinic.id !== 'string') {
      this.addError({
        type: 'INVALID_TYPE',
        table: 'clinics',
        message: `Clinic ${clinicIndex} has invalid or missing ID`,
      });
    }
  }

  /**
   * Validate foreign keys
   */
  private validateForeignKeys() {
    const workspaceId = this.bundle.data.workspace.id;

    // Validate workspace_users reference workspace
    this.bundle.data.workspaceUsers?.forEach((user, index) => {
      if (user.workspace_id !== workspaceId) {
        this.addError({
          type: 'FK_VIOLATION',
          table: 'workspace_users',
          recordId: user.id,
          message: `WorkspaceUser ${index} references wrong workspace: ${user.workspace_id} (expected: ${workspaceId})`,
        });
      }
    });

    // Validate workspace_members reference workspace
    this.bundle.data.workspaceMembers?.forEach((member, index) => {
      if (member.workspace_id !== workspaceId) {
        this.addError({
          type: 'FK_VIOLATION',
          table: 'workspace_members',
          recordId: member.id,
          message: `WorkspaceMember ${index} references wrong workspace`,
        });
      }
    });

    // Validate clinic foreign keys
    this.bundle.data.clinics.forEach((clinicBundle, clinicIndex) => {
      const clinicId = clinicBundle.clinic.id;

      // Validate clinic references workspace
      if (clinicBundle.clinic.workspace_id !== workspaceId) {
        this.addError({
          type: 'FK_VIOLATION',
          table: 'clinics',
          recordId: clinicId,
          message: `Clinic ${clinicIndex} references wrong workspace`,
        });
      }

      // Validate patients reference clinic
      clinicBundle.patients?.forEach((patient, patientIndex) => {
        if (patient.clinic_id !== clinicId) {
          this.addError({
            type: 'FK_VIOLATION',
            table: 'patients',
            recordId: patient.id,
            message: `Patient ${patientIndex} in clinic ${clinicIndex} references wrong clinic`,
          });
        }
      });

      // Validate treatments reference clinic and patients
      const patientIds = new Set(clinicBundle.patients?.map((p) => p.id) || []);
      const serviceIds = new Set(clinicBundle.services?.map((s) => s.id) || []);

      clinicBundle.treatments?.forEach((treatment, treatmentIndex) => {
        if (treatment.clinic_id !== clinicId) {
          this.addError({
            type: 'FK_VIOLATION',
            table: 'treatments',
            recordId: treatment.id,
            message: `Treatment ${treatmentIndex} references wrong clinic`,
          });
        }

        if (!patientIds.has(treatment.patient_id)) {
          this.addError({
            type: 'FK_VIOLATION',
            table: 'treatments',
            field: 'patient_id',
            recordId: treatment.id,
            message: `Treatment ${treatmentIndex} references non-existent patient: ${treatment.patient_id}`,
          });
        }

        if (!serviceIds.has(treatment.service_id)) {
          this.addError({
            type: 'FK_VIOLATION',
            table: 'treatments',
            field: 'service_id',
            recordId: treatment.id,
            message: `Treatment ${treatmentIndex} references non-existent service: ${treatment.service_id}`,
          });
        }
      });
    });
  }

  /**
   * Validate unique constraints
   */
  private validateUniqueConstraints() {
    // Validate workspace slug is unique (in this bundle)
    const workspaceSlug = this.bundle.data.workspace.slug;
    if (!workspaceSlug) {
      this.addError({
        type: 'CONSTRAINT_VIOLATION',
        table: 'workspaces',
        field: 'slug',
        message: 'Workspace slug is required',
      });
    }

    // Validate patient emails are unique within clinic
    this.bundle.data.clinics.forEach((clinicBundle, clinicIndex) => {
      const emails = new Set<string>();
      clinicBundle.patients?.forEach((patient) => {
        if (patient.email) {
          if (emails.has(patient.email)) {
            this.addWarning({
              type: 'DATA_LOSS',
              message: `Duplicate patient email in clinic ${clinicIndex}: ${patient.email}`,
              affectedRecords: 1,
            });
          }
          emails.add(patient.email);
        }
      });
    });
  }

  /**
   * Validate required fields
   */
  private validateRequiredFields() {
    // Validate workspace required fields
    const workspace = this.bundle.data.workspace;
    if (!workspace.name) {
      this.addError({
        type: 'MISSING_FIELD',
        table: 'workspaces',
        field: 'name',
        message: 'Workspace name is required',
      });
    }

    if (!workspace.slug) {
      this.addError({
        type: 'MISSING_FIELD',
        table: 'workspaces',
        field: 'slug',
        message: 'Workspace slug is required',
      });
    }

    // Validate clinic required fields
    this.bundle.data.clinics.forEach((clinicBundle, index) => {
      if (!clinicBundle.clinic.name) {
        this.addError({
          type: 'MISSING_FIELD',
          table: 'clinics',
          field: 'name',
          message: `Clinic ${index} name is required`,
        });
      }
    });
  }

  /**
   * Count total records in bundle
   */
  private countRecords(): number {
    let total = 1; // workspace

    total += this.bundle.data.organizations?.length || 0;
    total += this.bundle.data.categoryTypes?.length || 0;
    total += this.bundle.data.rolePermissions?.length || 0;
    total += this.bundle.data.workspaceUsers?.length || 0;
    total += this.bundle.data.workspaceMembers?.length || 0;

    this.bundle.data.clinics.forEach((clinic) => {
      total += 1; // clinic itself
      total += clinic.customCategories?.length || 0;
      total += clinic.categories?.length || 0;
      total += clinic.patientSources?.length || 0;
      total += clinic.assets?.length || 0;
      total += clinic.supplies?.length || 0;
      total += clinic.fixedCosts?.length || 0;
      total += clinic.services?.length || 0;
      total += clinic.serviceSupplies?.length || 0;
      total += clinic.tariffs?.length || 0;
      total += clinic.marketingCampaigns?.length || 0;
      total += clinic.marketingCampaignStatusHistory?.length || 0;
      total += clinic.patients?.length || 0;
      total += clinic.treatments?.length || 0;
      total += clinic.expenses?.length || 0;
    });

    return total;
  }

  /**
   * Estimate import duration in seconds
   */
  private estimateDuration(recordCount: number): number {
    // Rough estimate: ~500 records per second
    return Math.ceil(recordCount / 500);
  }

  /**
   * Estimate disk space required in MB
   */
  private estimateDiskSpace(): number {
    const jsonSize = JSON.stringify(this.bundle).length;
    return Math.ceil(jsonSize / (1024 * 1024));
  }

  /**
   * Add validation error
   */
  private addError(error: Omit<ValidationError, 'expected' | 'actual'> & { expected?: any; actual?: any }) {
    this.errors.push(error as ValidationError);
  }

  /**
   * Add validation warning
   */
  private addWarning(warning: ValidationWarning) {
    this.warnings.push(warning);
  }
}

/**
 * Convenience function to validate a bundle
 */
export async function validateBundle(bundle: ExportBundle): Promise<ValidationResult> {
  const validator = new BundleValidator(bundle);
  return await validator.validate();
}
