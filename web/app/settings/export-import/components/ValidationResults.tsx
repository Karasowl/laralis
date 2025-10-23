'use client';

/**
 * Validation Results Component
 *
 * Displays validation results for import bundles including errors, warnings, and stats.
 */

import { useTranslations } from 'next-intl';
import { CheckCircle, XCircle, AlertTriangle, Info, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ValidationError {
  type: string;
  table?: string;
  field?: string;
  message: string;
  recordId?: string;
}

interface ValidationWarning {
  type: string;
  message: string;
  affectedRecords?: number;
  suggestion?: string;
}

interface ValidationStats {
  recordsToImport: number;
  estimatedDuration: number;
  diskSpaceRequired: number;
}

interface MigrationPreview {
  needsMigration: boolean;
  migrationsToApply: number;
  migrationsSummary: string[];
  currentVersion: number;
  targetVersion: number;
}

interface BundleInfo {
  workspaceName: string;
  exportDate: string;
  clinicCount: number;
  recordCounts: Record<string, number>;
}

interface ValidationResultsProps {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: ValidationStats;
  migrationPreview?: MigrationPreview;
  bundleInfo?: BundleInfo;
}

export function ValidationResults({
  valid,
  errors,
  warnings,
  stats,
  migrationPreview,
  bundleInfo,
}: ValidationResultsProps) {
  const t = useTranslations('export');

  /**
   * Format duration
   */
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  /**
   * Format date
   */
  const formatDate = (isoString: string): string => {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <Card
        className={`p-4 ${
          valid
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}
      >
        <div className="flex items-start gap-3">
          {valid ? (
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h3
              className={`text-sm font-medium ${
                valid
                  ? 'text-green-900 dark:text-green-200'
                  : 'text-red-900 dark:text-red-200'
              }`}
            >
              {valid ? t('validation.valid') : t('validation.invalid')}
            </h3>
            <p
              className={`text-sm mt-1 ${
                valid
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-red-700 dark:text-red-300'
              }`}
            >
              {valid
                ? t('validation.validDescription')
                : t('validation.invalidDescription')}
            </p>
          </div>
        </div>
      </Card>

      {/* Bundle Info */}
      {bundleInfo && (
        <Card className="p-4">
          <h4 className="text-sm font-medium text-foreground mb-3">{t('validation.bundleInfo')}</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('validation.workspaceName')}:</span>
              <span className="font-medium text-foreground">{bundleInfo.workspaceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('validation.exportDate')}:</span>
              <span className="font-medium text-foreground">{formatDate(bundleInfo.exportDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('validation.clinicCount')}:</span>
              <span className="font-medium text-foreground">{bundleInfo.clinicCount}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Migration Preview */}
      {migrationPreview && migrationPreview.needsMigration && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                {t('validation.migrationRequired')}
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                {t('validation.migrationDescription', {
                  from: migrationPreview.currentVersion,
                  to: migrationPreview.targetVersion,
                })}
              </p>
              {migrationPreview.migrationsSummary.length > 0 && (
                <ul className="space-y-1">
                  {migrationPreview.migrationsSummary.map((migration, index) => (
                    <li key={index} className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400">
                      <ArrowRight className="h-3 w-3" />
                      <span>{migration}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <h4 className="text-sm font-medium text-red-900 dark:text-red-200 mb-3">
            {t('validation.errors')} ({errors.length})
          </h4>
          <ul className="space-y-2">
            {errors.map((error, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span>{error.message}</span>
                  {error.table && (
                    <span className="ml-2 text-xs text-red-600 dark:text-red-400">
                      [{error.table}{error.field && `.${error.field}`}]
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-3">
            {t('validation.warnings')} ({warnings.length})
          </h4>
          <ul className="space-y-2">
            {warnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span>{warning.message}</span>
                  {warning.suggestion && (
                    <div className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                      {warning.suggestion}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Stats */}
      <Card className="p-4">
        <h4 className="text-sm font-medium text-foreground mb-3">{t('validation.importStats')}</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('stats.totalRecords')}</div>
            <div className="text-2xl font-semibold text-foreground">
              {stats.recordsToImport.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('validation.estimatedDuration')}</div>
            <div className="text-2xl font-semibold text-foreground">
              {formatDuration(stats.estimatedDuration)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('validation.diskSpace')}</div>
            <div className="text-2xl font-semibold text-foreground">
              {stats.diskSpaceRequired} MB
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
