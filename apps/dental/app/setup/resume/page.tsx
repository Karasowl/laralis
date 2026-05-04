'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { LogOut, Play, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loading } from '@/components/ui/loading'
import { useWorkspace } from '@/contexts/workspace-context'
import { toast } from 'sonner'

type LifecycleAction = 'resume_setup' | 'archive' | 'delete_incomplete'

const getStatus = (workspace: any) => workspace?.status || (workspace?.onboarding_completed ? 'active' : 'draft')

export default function ResumeSetupPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('setupResume')
  const { workspaces, loading, refreshWorkspaces, signOut } = useWorkspace()
  const [busyId, setBusyId] = useState<string | null>(null)

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace: any) => getStatus(workspace) === 'active'),
    [workspaces]
  )

  const resumableWorkspaces = useMemo(
    () => workspaces.filter((workspace: any) => !workspace.onboarding_completed && ['draft', 'expired'].includes(getStatus(workspace))),
    [workspaces]
  )

  useEffect(() => {
    if (loading) return
    if (activeWorkspace) {
      router.replace('/')
      return
    }
    if (workspaces.length === 0) {
      router.replace('/onboarding')
    }
  }, [activeWorkspace, loading, router, workspaces.length])

  const runAction = async (workspaceId: string, action: LifecycleAction) => {
    setBusyId(`${workspaceId}:${action}`)
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/lifecycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 409 && payload?.code === 'WORKSPACE_HAS_CRITICAL_DATA') {
          toast.error(t('hasCriticalData'))
          return
        }
        const fallback =
          action === 'resume_setup'
            ? t('resumeError')
            : action === 'archive'
              ? t('archiveError')
              : t('deleteError')
        toast.error(payload?.error || fallback)
        return
      }

      await refreshWorkspaces()

      if (action === 'resume_setup') {
        router.push('/setup')
        return
      }

      router.push('/onboarding')
    } catch (error) {
      console.error('[setup/resume] lifecycle action failed', error)
      toast.error(action === 'resume_setup' ? t('resumeError') : action === 'archive' ? t('archiveError') : t('deleteError'))
    } finally {
      setBusyId(null)
    }
  }

  const formatDate = (value?: string | null) => {
    if (!value) return '-'
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    } catch {
      return '-'
    }
  }

  if (loading) {
    return <Loading fullscreen message={t('title')} subtitle={t('subtitle')} />
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8" data-testid="setup-resume-page">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">{t('title')}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
          <Button variant="outline" onClick={signOut} className="w-full sm:w-auto">
            <LogOut className="mr-2 h-4 w-4" />
            {t('logout')}
          </Button>
        </div>

        {resumableWorkspaces.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{t('emptyTitle')}</CardTitle>
              <CardDescription>{t('emptyDescription')}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button onClick={() => router.push('/onboarding')} className="w-full sm:w-auto">
                <Play className="mr-2 h-4 w-4" />
                {t('startOver')}
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <div className="grid gap-4">
            {resumableWorkspaces.map((workspace: any) => {
              const status = getStatus(workspace)
              const lastSeen = workspace.setup_last_seen_at || workspace.updated_at || workspace.created_at
              const resumeBusy = busyId === `${workspace.id}:resume_setup`
              const archiveBusy = busyId === `${workspace.id}:archive`
              const deleteBusy = busyId === `${workspace.id}:delete_incomplete`

              return (
                <Card key={workspace.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle className="text-xl">{workspace.name || t('workspaceLabel')}</CardTitle>
                        <CardDescription>
                          {t('updatedLabel')}: {formatDate(lastSeen)}
                        </CardDescription>
                      </div>
                      <Badge variant={status === 'expired' ? 'secondary' : 'outline'}>
                        {t('statusLabel')}: {status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <span className="font-medium text-foreground">{t('workspaceLabel')}:</span> {workspace.id}
                      </div>
                      {workspace.delete_after && (
                        <div>
                          <span className="font-medium text-foreground">{t('deleteAfterLabel')}:</span> {formatDate(workspace.delete_after)}
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      onClick={() => runAction(workspace.id, 'resume_setup')}
                      disabled={Boolean(busyId)}
                      className="w-full sm:w-auto"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {resumeBusy ? '...' : t('continue')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (window.confirm(t('confirmArchive'))) {
                          void runAction(workspace.id, 'archive')
                        }
                      }}
                      disabled={Boolean(busyId)}
                      className="w-full sm:w-auto"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {archiveBusy ? '...' : t('startOver')}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (window.confirm(t('confirmDelete'))) {
                          void runAction(workspace.id, 'delete_incomplete')
                        }
                      }}
                      disabled={Boolean(busyId)}
                      className="w-full sm:w-auto"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deleteBusy ? '...' : t('delete')}
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
