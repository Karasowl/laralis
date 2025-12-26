'use client'

/**
 * Snapshots Settings Page Client Component
 *
 * Allows clinic owners to create, view, download, and restore snapshots.
 */

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  Database,
  Plus,
  Loader2,
  Download,
  Trash2,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Clock,
  HardDrive,
  FileArchive,
  Shield,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useSnapshots, type SnapshotListItem } from '@/hooks/use-snapshots'
import { cn } from '@/lib/utils'

// ============================================================================
// Helper Functions
// ============================================================================

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string, t: ReturnType<typeof useTranslations>): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return t('time.today') + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays === 1) {
    return t('time.yesterday') + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays < 7) {
    return t('time.daysAgo', { days: diffDays })
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  }
}

function getTotalRecords(recordCounts: Record<string, number> | null): number {
  if (!recordCounts) return 0
  return Object.values(recordCounts).reduce((sum, count) => sum + count, 0)
}

// ============================================================================
// Snapshot Card Component
// ============================================================================

interface SnapshotCardProps {
  snapshot: SnapshotListItem
  onDownload: (id: string) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  isDeleting: boolean
  isRestoring: boolean
  isOwner: boolean
  t: ReturnType<typeof useTranslations>
}

function SnapshotCard({
  snapshot,
  onDownload,
  onDelete,
  onRestore,
  isDeleting,
  isRestoring,
  isOwner,
  t,
}: SnapshotCardProps) {
  const [expanded, setExpanded] = useState(false)

  const typeLabel = {
    manual: t('types.manual'),
    scheduled: t('types.scheduled'),
    'pre-restore': t('types.preRestore'),
  }[snapshot.type]

  const typeColor = {
    manual: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    scheduled: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    'pre-restore': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  }[snapshot.type]

  const statusIcon = {
    pending: <Loader2 className="h-4 w-4 animate-spin text-amber-500" />,
    completed: <CheckCircle className="h-4 w-4 text-green-500" />,
    failed: <AlertTriangle className="h-4 w-4 text-red-500" />,
  }[snapshot.status]

  const totalRecords = getTotalRecords(snapshot.recordCounts)

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {statusIcon}
            <span className="font-medium text-foreground truncate">
              {formatDate(snapshot.createdAt, t)}
            </span>
            <Badge variant="secondary" className={cn('text-xs', typeColor)}>
              {typeLabel}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Database className="h-3.5 w-3.5" />
              {t('records', { count: totalRecords })}
            </span>
            <span className="flex items-center gap-1">
              <HardDrive className="h-3.5 w-3.5" />
              {formatFileSize(snapshot.compressedSizeBytes)}
            </span>
            <span className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              v{snapshot.schemaVersion}
            </span>
          </div>

          {/* Expandable table details */}
          {expanded && snapshot.tableManifest && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground mb-2">{t('tablesIncluded')}:</div>
              <div className="flex flex-wrap gap-1.5">
                {snapshot.tableManifest.map((table) => (
                  <Badge key={table.name} variant="outline" className="text-xs font-normal">
                    {table.name}: {table.recordCount}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? t('actions.collapse') : t('actions.expand')}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDownload(snapshot.id)}
            disabled={snapshot.status !== 'completed'}
            title={t('actions.download')}
          >
            <Download className="h-4 w-4" />
          </Button>

          {isOwner && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRestore(snapshot.id)}
                disabled={snapshot.status !== 'completed' || isRestoring}
                title={t('actions.restore')}
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              >
                {isRestoring ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(snapshot.id)}
                disabled={isDeleting}
                title={t('actions.delete')}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function SnapshotsClient() {
  const t = useTranslations('snapshots')

  const {
    snapshots,
    loading,
    creating,
    restoring,
    deleting,
    createSnapshot,
    deleteSnapshot,
    restoreSnapshot,
    downloadSnapshot,
    isOwner,
    hasSnapshots,
  } = useSnapshots()

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null)

  // Handle create
  const handleCreate = async () => {
    await createSnapshot('manual')
  }

  // Handle delete
  const handleDeleteClick = (id: string) => {
    setSelectedSnapshotId(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (selectedSnapshotId) {
      await deleteSnapshot(selectedSnapshotId)
      setDeleteDialogOpen(false)
      setSelectedSnapshotId(null)
    }
  }

  // Handle restore
  const handleRestoreClick = (id: string) => {
    setSelectedSnapshotId(id)
    setRestoreDialogOpen(true)
  }

  const handleRestoreConfirm = async () => {
    if (selectedSnapshotId) {
      await restoreSnapshot(selectedSnapshotId, {
        mode: 'replace',
        createBackupFirst: true,
      })
      setRestoreDialogOpen(false)
      setSelectedSnapshotId(null)
    }
  }

  // Sorted snapshots (newest first)
  const sortedSnapshots = useMemo(() => {
    return [...snapshots].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [snapshots])

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">
            {t('title')}
          </h2>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>

        {isOwner && (
          <Button onClick={handleCreate} disabled={creating} className="flex-shrink-0">
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('actions.creating')}
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {t('actions.create')}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Info Banner */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="text-blue-900 dark:text-blue-100 font-medium mb-1">
              {t('info.title')}
            </p>
            <ul className="text-blue-700 dark:text-blue-300 space-y-1">
              <li>{t('info.point1')}</li>
              <li>{t('info.point2')}</li>
              <li>{t('info.point3')}</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !hasSnapshots && (
        <Card className="p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <FileArchive className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            {t('empty.title')}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            {t('empty.description')}
          </p>
          {isOwner && (
            <Button onClick={handleCreate} disabled={creating}>
              <Plus className="mr-2 h-4 w-4" />
              {t('actions.createFirst')}
            </Button>
          )}
        </Card>
      )}

      {/* Snapshots List */}
      {!loading && hasSnapshots && (
        <div className="space-y-3">
          {sortedSnapshots.map((snapshot) => (
            <SnapshotCard
              key={snapshot.id}
              snapshot={snapshot}
              onDownload={downloadSnapshot}
              onDelete={handleDeleteClick}
              onRestore={handleRestoreClick}
              isDeleting={deleting === snapshot.id}
              isRestoring={restoring === snapshot.id}
              isOwner={isOwner}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Not Owner Warning */}
      {!isOwner && (
        <Card className="p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {t('ownerOnly')}
            </p>
          </div>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogs.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dialogs.delete.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('actions.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t('dialogs.restore.title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>{t('dialogs.restore.description')}</p>
              <p className="font-medium text-foreground">
                {t('dialogs.restore.warning')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestoreConfirm}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {t('actions.confirmRestore')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
