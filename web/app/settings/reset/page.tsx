'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle, Trash2, UserX, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { AppLayout } from '@/components/layouts/AppLayout'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { useWorkspace } from '@/contexts/workspace-context'
import { toast } from 'sonner'

export default function ResetPage() {
  const t = useTranslations('settings.reset')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { currentClinic } = useCurrentClinic()
  const { user } = useWorkspace()

  // Delete all clinic data state
  const [deleteDataConfirm, setDeleteDataConfirm] = useState('')
  const [deletingData, setDeletingData] = useState(false)
  const [showDeleteDataDialog, setShowDeleteDataDialog] = useState(false)

  // Delete account state
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false)

  const handleDeleteAllData = async () => {
    if (!currentClinic) {
      toast.error(t('no_clinic'))
      return
    }

    setDeletingData(true)

    try {
      const response = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetType: 'all_data' })
      })

      if (!response.ok) {
        throw new Error('Failed to delete data')
      }

      toast.success(t('data_deleted_success'))

      setTimeout(() => {
        router.push('/setup')
      }, 2000)
    } catch (error) {
      console.error('Error deleting data:', error)
      toast.error(t('delete_error'))
      setDeletingData(false)
      setShowDeleteDataDialog(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeletingAccount(true)

    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete account')
      }

      toast.success(t('account_deleted_success'))

      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (error) {
      console.error('Error deleting account:', error)
      toast.error(t('delete_error'))
      setDeletingAccount(false)
      setShowDeleteAccountDialog(false)
    }
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-4xl space-y-6">
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle')}
        />

        <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>{t('warning')}:</strong> {t('warning_description')}
          </AlertDescription>
        </Alert>

        {/* Delete All Clinic Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              {t('delete_all_data_title')}
            </CardTitle>
            <CardDescription>
              {t('delete_all_data_description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm font-medium text-destructive mb-2">
                {t('data_will_be_deleted')}:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {t('data_item_patients')}</li>
                <li>• {t('data_item_treatments')}</li>
                <li>• {t('data_item_expenses')}</li>
                <li>• {t('data_item_services')}</li>
                <li>• {t('data_item_supplies')}</li>
                <li>• {t('data_item_all_config')}</li>
              </ul>
            </div>

            <Button
              onClick={() => setShowDeleteDataDialog(true)}
              disabled={!currentClinic || deletingData}
              variant="destructive"
              className="w-full"
            >
              {deletingData ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('deleting')}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('delete_all_data_button')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Delete Account */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <UserX className="h-5 w-5" />
              {t('delete_account_title')}
            </CardTitle>
            <CardDescription>
              {t('delete_account_description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <p className="text-sm font-medium text-destructive mb-2">
                {t('account_deletion_warning')}
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {t('account_item_all_data')}</li>
                <li>• {t('account_item_workspaces')}</li>
                <li>• {t('account_item_clinics')}</li>
                <li>• {t('account_item_no_recovery')}</li>
              </ul>
            </div>

            <Button
              onClick={() => setShowDeleteAccountDialog(true)}
              disabled={deletingAccount}
              variant="destructive"
              className="w-full"
            >
              {deletingAccount ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('deleting')}
                </>
              ) : (
                <>
                  <UserX className="h-4 w-4 mr-2" />
                  {t('delete_account_button')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Delete All Data Confirmation Dialog */}
        <ConfirmDialog
          open={showDeleteDataDialog}
          onOpenChange={setShowDeleteDataDialog}
          title={t('confirm_delete_all_data')}
          description={
            <div className="space-y-4">
              <p>{t('confirm_delete_all_data_description')}</p>
              <div className="space-y-2">
                <Label htmlFor="delete-data-confirm">
                  {t('type_delete_to_confirm')}
                </Label>
                <Input
                  id="delete-data-confirm"
                  placeholder={t('delete_placeholder')}
                  value={deleteDataConfirm}
                  onChange={(e) => setDeleteDataConfirm(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          }
          variant="destructive"
          onConfirm={handleDeleteAllData}
          confirmText={t('yes_delete')}
          cancelText={tCommon('cancel')}
          confirmDisabled={deleteDataConfirm.toUpperCase() !== 'DELETE' || deletingData}
        />

        {/* Delete Account Confirmation Dialog */}
        <ConfirmDialog
          open={showDeleteAccountDialog}
          onOpenChange={setShowDeleteAccountDialog}
          title={t('confirm_delete_account')}
          description={
            <div className="space-y-4">
              <p>{t('confirm_delete_account_description')}</p>
              <div className="space-y-2">
                <Label htmlFor="delete-account-confirm">
                  {t('type_delete_to_confirm')}
                </Label>
                <Input
                  id="delete-account-confirm"
                  placeholder={t('delete_placeholder')}
                  value={deleteAccountConfirm}
                  onChange={(e) => setDeleteAccountConfirm(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          }
          variant="destructive"
          onConfirm={handleDeleteAccount}
          confirmText={t('yes_delete_account')}
          cancelText={tCommon('cancel')}
          confirmDisabled={deleteAccountConfirm.toUpperCase() !== 'DELETE' || deletingAccount}
        />
      </div>
    </AppLayout>
  )
}
