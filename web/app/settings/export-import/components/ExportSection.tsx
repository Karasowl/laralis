'use client';

/**
 * Export Section Component
 *
 * UI for exporting workspace data with options and progress tracking.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Loader2, CheckCircle, AlertTriangle, Database, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCurrentWorkspace } from '@/hooks/use-current-workspace';
import { useCurrentClinic } from '@/hooks/use-current-clinic';

interface ExportStats {
  totalRecords: number;
  recordsByTable: Record<string, number>;
  exportDuration: number;
  bundleSize: number;
}

interface ExportOptions {
  includeAuditLogs: boolean;
  includeHistorical: boolean;
}

export function ExportSection() {
  const t = useTranslations('export');
  const { workspace } = useCurrentWorkspace();
  const { currentClinic } = useCurrentClinic();

  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ExportStats | null>(null);
  const [options, setOptions] = useState<ExportOptions>({
    includeAuditLogs: false,
    includeHistorical: true,
  });

  // AI Export states
  const [isExportingAI, setIsExportingAI] = useState(false);
  const [aiExportComplete, setAiExportComplete] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiExportType, setAiExportType] = useState<'snapshot' | 'full' | 'both'>('both');

  /**
   * Handle export button click
   */
  const handleExport = async () => {
    if (!workspace) {
      setError(t('errors.noWorkspace'));
      return;
    }

    setIsExporting(true);
    setError(null);
    setExportComplete(false);
    setStats(null);

    try {
      const response = await fetch('/api/export/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: workspace.id,
          options,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('errors.exportFailed'));
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || t('errors.exportFailed'));
      }

      // Set stats
      setStats(data.stats);
      setExportComplete(true);

      // Trigger download
      const blob = new Blob([JSON.stringify(data.bundle, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `laralis-backup-${workspace.slug}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      setError(err instanceof Error ? err.message : t('errors.unknown'));
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Handle AI export for external AI integration
   */
  const handleAIExport = async () => {
    if (!currentClinic) {
      setAiError(t('errors.noClinic'));
      return;
    }

    setIsExportingAI(true);
    setAiError(null);
    setAiExportComplete(false);

    try {
      const response = await fetch(
        `/api/clinic/${currentClinic.id}/export?type=${aiExportType}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('errors.exportFailed'));
      }

      const data = await response.json();

      // Trigger download
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clinic-ai-export-${currentClinic.name.replace(/\s+/g, '-').toLowerCase()}-${aiExportType}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setAiExportComplete(true);
    } catch (err) {
      console.error('AI Export error:', err);
      setAiError(err instanceof Error ? err.message : t('errors.unknown'));
    } finally {
      setIsExportingAI(false);
    }
  };

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /**
   * Format duration
   */
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          {t('title')}
        </h2>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      {/* Export Card */}
      <Card className="p-6">
        <div className="space-y-6">
          {/* Icon and Info */}
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium text-foreground mb-1">
                {t('export.title')}
              </h3>
              <p className="text-sm text-muted-foreground">{t('export.subtitle')}</p>
            </div>
          </div>

          {/* Export Button */}
          <div className="border-t border-border pt-6">
            <Button
              onClick={handleExport}
              disabled={isExporting || !workspace}
              className="w-full sm:w-auto"
              size="lg"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('actions.exporting')}
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  {t('actions.export')}
                </>
              )}
            </Button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 dark:bg-destructive/20/20 border border-destructive/30 dark:border-destructive/40 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-destructive dark:text-destructive/80 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive dark:text-destructive">
                  {t('errors.title')}
                </p>
                <p className="text-sm text-destructive dark:text-destructive/90 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message with Stats */}
          {exportComplete && stats && (
            <div className="space-y-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900 dark:text-green-200">
                    {t('success.title')}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    {t('success.description')}
                  </p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-green-200 dark:border-green-800">
                <div>
                  <div className="text-xs text-green-700 dark:text-green-400 mb-1">
                    {t('stats.totalRecords')}
                  </div>
                  <div className="text-lg font-semibold text-green-900 dark:text-green-100">
                    {stats.totalRecords.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-green-700 dark:text-green-400 mb-1">
                    {t('stats.fileSize')}
                  </div>
                  <div className="text-lg font-semibold text-green-900 dark:text-green-100">
                    {formatFileSize(stats.bundleSize)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-green-700 dark:text-green-400 mb-1">
                    {t('stats.duration')}
                  </div>
                  <div className="text-lg font-semibold text-green-900 dark:text-green-100">
                    {formatDuration(stats.exportDuration)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* AI Export Card */}
      <Card className="p-6">
        <div className="space-y-6">
          {/* Icon and Info */}
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium text-foreground mb-1">
                {t('aiExport.title')}
              </h3>
              <p className="text-sm text-muted-foreground">{t('aiExport.subtitle')}</p>
            </div>
          </div>

          {/* Export Type Selection */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAiExportType('snapshot')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                aiExportType === 'snapshot'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {t('aiExport.types.snapshot')}
            </button>
            <button
              onClick={() => setAiExportType('full')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                aiExportType === 'full'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {t('aiExport.types.full')}
            </button>
            <button
              onClick={() => setAiExportType('both')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                aiExportType === 'both'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {t('aiExport.types.both')}
            </button>
          </div>

          {/* Type Description */}
          <p className="text-xs text-muted-foreground">
            {aiExportType === 'snapshot' && t('aiExport.descriptions.snapshot')}
            {aiExportType === 'full' && t('aiExport.descriptions.full')}
            {aiExportType === 'both' && t('aiExport.descriptions.both')}
          </p>

          {/* Export Button */}
          <div className="border-t border-border pt-6">
            <Button
              onClick={handleAIExport}
              disabled={isExportingAI || !currentClinic}
              className="w-full sm:w-auto"
              size="lg"
              variant="outline"
            >
              {isExportingAI ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('actions.exporting')}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('aiExport.action')}
                </>
              )}
            </Button>
            {!currentClinic && (
              <p className="text-xs text-muted-foreground mt-2">{t('aiExport.noClinic')}</p>
            )}
          </div>

          {/* Error Message */}
          {aiError && (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{aiError}</p>
            </div>
          )}

          {/* Success Message */}
          {aiExportComplete && (
            <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900 dark:text-green-200">
                  {t('aiExport.success')}
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  {t('aiExport.successHint')}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Info Card */}
      <Card className="p-6 bg-muted/30">
        <h4 className="text-sm font-medium text-foreground mb-3">
          {t('info.title')}
        </h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>{t('info.point1')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>{t('info.point2')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>{t('info.point3')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>{t('info.point4')}</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
