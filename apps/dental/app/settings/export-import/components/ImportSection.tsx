'use client';

/**
 * Import Section Component
 *
 * UI for importing workspace data with validation and preview.
 */

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, Loader2, CheckCircle, AlertTriangle, Database, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ValidationResults } from './ValidationResults';

interface ValidationResponse {
  valid: boolean;
  errors: any[];
  warnings: any[];
  stats: any;
  migrationPreview?: any;
  bundleInfo?: any;
}

export function ImportSection() {
  const t = useTranslations('export');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [bundle, setBundle] = useState<any | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
  const [importComplete, setImportComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedWorkspaceId, setImportedWorkspaceId] = useState<string | null>(null);

  /**
   * Handle file selection
   */
  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setValidationResult(null);
    setImportComplete(false);

    // Read and parse file
    try {
      const text = await selectedFile.text();
      const parsedBundle = JSON.parse(text);
      setBundle(parsedBundle);

      // Automatically validate
      await validateBundle(parsedBundle);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('import.errors.invalidFile')
      );
      setFile(null);
      setBundle(null);
    }
  };

  /**
   * Handle file input change
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  /**
   * Handle drag and drop
   */
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const selectedFile = event.dataTransfer.files[0];
    if (selectedFile && selectedFile.type === 'application/json') {
      handleFileSelect(selectedFile);
    } else {
      setError(t('import.errors.invalidFileType'));
    }
  };

  /**
   * Validate bundle
   */
  const validateBundle = async (bundleToValidate: any) => {
    setIsValidating(true);
    setError(null);

    try {
      const response = await fetch('/api/export/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bundleToValidate),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('import.errors.validationFailed'));
      }

      const result = await response.json();
      setValidationResult(result);
    } catch (err) {
      console.error('Validation error:', err);
      setError(err instanceof Error ? err.message : t('import.errors.unknown'));
    } finally {
      setIsValidating(false);
    }
  };

  /**
   * Handle import confirmation
   */
  const handleImport = async () => {
    if (!bundle || !validationResult?.valid) return;

    setIsImporting(true);
    setError(null);
    setImportComplete(false);

    try {
      const response = await fetch('/api/export/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bundle,
          options: {
            mode: 'create',
            skipValidation: false,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('import.errors.importFailed'));
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || t('import.errors.importFailed'));
      }

      setImportedWorkspaceId(result.workspaceId);
      setImportComplete(true);
    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : t('import.errors.unknown'));
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * Reset state
   */
  const handleReset = () => {
    setFile(null);
    setBundle(null);
    setValidationResult(null);
    setImportComplete(false);
    setError(null);
    setImportedWorkspaceId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">{t('import.title')}</h2>
        <p className="text-muted-foreground">{t('import.description')}</p>
      </div>

      {/* Upload Card */}
      {!file && (
        <Card className="p-6">
          <div className="space-y-6">
            {/* Icon and Info */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg">
                <Database className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-foreground mb-1">{t('import.upload.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('import.upload.subtitle')}</p>
              </div>
            </div>

            {/* Drag & Drop Area */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm font-medium text-foreground mb-1">
                {t('import.upload.dragDrop')}
              </p>
              <p className="text-xs text-muted-foreground">{t('import.upload.fileFormat')}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Validating State */}
      {isValidating && (
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-foreground">{t('import.validating')}</span>
          </div>
        </Card>
      )}

      {/* Validation Results */}
      {validationResult && !isValidating && (
        <div className="space-y-4">
          <ValidationResults {...validationResult} />

          {/* Action Buttons */}
          <div className="flex gap-3">
            {validationResult.valid && !importComplete && (
              <Button onClick={handleImport} disabled={isImporting} size="lg">
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('import.importing')}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {t('import.confirm')}
                  </>
                )}
              </Button>
            )}
            <Button onClick={handleReset} variant="outline" disabled={isImporting}>
              {t('import.tryAnother')}
            </Button>
          </div>
        </div>
      )}

      {/* Success Message */}
      {importComplete && importedWorkspaceId && (
        <Card className="p-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900 dark:text-green-200">
                {t('import.success.title')}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {t('import.success.description')}
              </p>
              <Button
                onClick={() => (window.location.href = `/`)}
                variant="outline"
                size="sm"
                className="mt-3"
              >
                {t('import.success.goToWorkspace')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Card className="p-6 bg-destructive/10 dark:bg-destructive/20/20 border-destructive/30 dark:border-destructive/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive dark:text-destructive/80 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive dark:text-destructive">
                {t('errors.title')}
              </p>
              <p className="text-sm text-destructive dark:text-destructive/90 mt-1">{error}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
