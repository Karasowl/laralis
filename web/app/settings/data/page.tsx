'use client';

import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { Download, Upload, HardDrive, AlertTriangle, File, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layouts/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DeleteAccountSection } from '../SettingsClient';

const MAX_IMPORT_SIZE_MB = 10;
const MAX_IMPORT_SIZE_BYTES = MAX_IMPORT_SIZE_MB * 1024 * 1024;

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes)) {
    return '0 MB';
  }
  if (bytes < 1024) {
    return `${bytes.toFixed(0)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export default function DataSettingsPage() {
  const router = useRouter();
  const tSettings = useTranslations('settings');
  const t = useTranslations('settings.dataManagement');
  const common = useTranslations('common');
  const tSummary = useTranslations('settings.summary');
  const { toast } = useToast();

  const [isExporting, setIsExporting] = useState(false);
  const [isBackup, setIsBackup] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const triggerDownload = async (mode: 'export' | 'backup') => {
    const setLoading = mode === 'backup' ? setIsBackup : setIsExporting;
    const successMessage = mode === 'backup' ? t('backup.success') : t('export.success');
    const errorMessage = mode === 'backup' ? t('backup.error') : t('export.error');

    try {
      setLoading(true);
      const response = await fetch(`/api/settings/data/export?mode=${mode}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        let details: string | undefined;
        try {
          const payload = await response.json();
          details = payload?.error || payload?.message;
        } catch {
          // ignore
        }
        throw new Error(details || errorMessage);
      }

      const blob = await response.blob();
      let filename = `laralis-${mode}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const disposition = response.headers.get('content-disposition');
      const match = disposition?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
      if (match?.[1]) {
        filename = match[1].replace(/['"]/g, '').trim();
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast({
        title: successMessage,
      });
    } catch (error) {
      toast({
        title: errorMessage,
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setIsDragActive(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.json')) {
      toast({
        title: t('messages.invalidFormat'),
        variant: 'destructive',
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_IMPORT_SIZE_BYTES) {
      toast({
        title: t('messages.sizeExceeded', { limit: MAX_IMPORT_SIZE_MB }),
        variant: 'destructive',
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const triggerFileDialog = () => {
    setIsDragActive(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleDropZoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      triggerFileDialog();
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    if (!isDragActive) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) {
      return;
    }
    if (isDragActive) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    handleFileChange(file);
    event.dataTransfer.clearData();
  };

  const openImportConfirm = () => {
    if (!selectedFile) {
      toast({
        title: t('import.noFile'),
        variant: 'destructive',
      });
      return;
    }
    setConfirmOpen(true);
  };

  const runImport = async () => {
    if (!selectedFile) {
      return;
    }

    try {
      setIsImporting(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/settings/data/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const code = typeof payload?.errorCode === 'string' ? payload.errorCode : undefined;
        const details = code ? t(`messages.${code}` as any, { limit: MAX_IMPORT_SIZE_MB }) : payload?.error || payload?.message;
        throw new Error(details || t('import.error'));
      }

      const summary = payload?.summary ?? {};
      const summaryEntries = Object.entries(summary)
        .filter(([, count]) => typeof count === 'number' && count > 0)
        .map(([key, count]) => ({
          key,
          count: count as number
        }));

      toast({
        title: t('messages.importSummaryTitle'),
        description: (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('messages.importSummaryDescription')}</p>
            {summaryEntries.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {summaryEntries.map(({ key, count }) => (
                  <li key={key}>
                    {tSummary(key as any, { count, defaultValue: key })}:{' '}
                    <span className="font-semibold">{count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t('messages.importSummaryEmpty')}</p>
            )}
          </div>
        ),
      });

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setConfirmOpen(false);

      router.refresh();
    } catch (error) {
      const description = error instanceof Error ? error.message : undefined;
      toast({
        title: t('messages.importErrorTitle'),
        description: (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('messages.importErrorDescription')}
            </p>
            {description && (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {t('messages.importErrorDetails', { message: description })}
              </p>
            )}
          </div>
        ),
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-8">
        <PageHeader
          title={tSettings('data.title')}
          subtitle={tSettings('data.description')}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              {t('export.title')}
            </CardTitle>
            <CardDescription>{t('export.description')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3">
            <Button
              onClick={() => triggerDownload('export')}
              disabled={isExporting || isBackup}
            >
              {isExporting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t('export.button')}
                </span>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  {t('export.button')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" />
              {t('backup.title')}
            </CardTitle>
            <CardDescription>{t('backup.description')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3">
            <Button
              onClick={() => triggerDownload('backup')}
              disabled={isExporting || isBackup}
              variant="secondary"
            >
              {isBackup ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t('backup.button')}
                </span>
              ) : (
                <>
                  <HardDrive className="h-4 w-4 mr-2" />
                  {t('backup.button')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              {t('import.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertTitle>{t('import.title')}</AlertTitle>
              <AlertDescription>{t('import.description')}</AlertDescription>
            </Alert>

            <Input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              id="data-import-file"
              className="sr-only"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            />

            <div
              role="button"
              tabIndex={0}
              aria-label={t('import.selectFile')}
              onClick={triggerFileDialog}
              onKeyDown={handleDropZoneKeyDown}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/40'
              }`}
            >
              <Upload className="h-8 w-8 text-primary" />
              <p className="mt-3 text-sm font-medium text-foreground">
                {t('import.clickLabel')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('import.dropLabel')}
              </p>
            </div>

            {selectedFile ? (
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 text-left">
                  <File className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium break-all">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('import.fileInfo', { size: formatFileSize(selectedFile.size) })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={triggerFileDialog}
                  >
                    {t('import.change')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearSelectedFile}
                    aria-label={t('import.remove')}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center">
                {t('import.noFile')}
              </p>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              onClick={openImportConfirm}
              disabled={!selectedFile || isImporting}
              variant="destructive"
            >
              {isImporting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t('import.processing')}
                </span>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {t('import.button')}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">{tSettings('dangerZone')}</CardTitle>
            <CardDescription>{tSettings('deleteAccountWarning')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <DeleteAccountSection />
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!isImporting) {
            setConfirmOpen(open);
          }
        }}
        title={t('import.confirmTitle')}
        description={t('import.confirmDescription')}
        confirmText={t('import.button')}
        cancelText={common('cancel')}
        variant="warning"
        onConfirm={runImport}
        loading={isImporting}
      />
    </AppLayout>
  );
}
