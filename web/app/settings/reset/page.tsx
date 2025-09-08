'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Trash2, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { AppLayout } from '@/components/layouts/AppLayout'
import { ResetOption } from '@/components/settings/ResetOption'
import { ChecklistItem } from '@/components/settings/ChecklistItem'
import { FormSection } from '@/components/ui/form-field'
import { useReset } from '@/hooks/use-reset'

export default function ResetPage() {
  const t = useTranslations('settings')
  const {
    resetOptions,
    selectedOptions,
    loading,
    resetProgress,
    dataStatus,
    confirmText,
    setConfirmText,
    toggleOption,
    performReset,
    fetchStatus
  } = useReset()

  const hasAllDataSelected = selectedOptions.includes('all_data')

  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        <PageHeader 
          title={t('reset.title')} 
          subtitle={t('reset.subtitle')}
        />

        <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>{t('reset.warning')}:</strong> {t('reset.warning_description')}
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>{t('reset.clean_data')}</CardTitle>
            <CardDescription>
              {t('reset.clean_data_description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {resetOptions.map(option => (
                <ResetOption
                  key={option.id}
                  {...option}
                  selected={selectedOptions.includes(option.id)}
                  disabled={loading}
                  status={resetProgress[option.id]}
                  onToggle={() => toggleOption(option.id)}
                />
              ))}
            </div>

            {hasAllDataSelected && (
              <Alert className="bg-red-100 dark:bg-red-950/20 border-red-300 dark:border-red-800">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription>
                  <p className="font-medium text-red-800 dark:text-red-200 mb-2">
                    {t('reset.confirm_delete_all')}
                  </p>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-md bg-white dark:bg-gray-900"
                    placeholder={t('reset.delete_all_placeholder')}
                    disabled={loading}
                  />
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between items-center pt-4">
              <p className="text-sm text-muted-foreground">
                {selectedOptions.length} {t('reset.options_selected')}
              </p>
              <Button
                onClick={performReset}
                disabled={loading || selectedOptions.length === 0}
                variant={hasAllDataSelected ? 'destructive' : 'default'}
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {t('reset.cleaning')}
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('reset.clean_selected')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{t('reset.status_title')}</CardTitle>
                <CardDescription>
                  {t('reset.status_description')}
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchStatus}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <FormSection>
              <div className="space-y-1">
                <ChecklistItem 
                  label={t('reset.checklist.time_config')} 
                  completed={dataStatus?.timeConfigured || false} 
                  count={null}
                />
                <ChecklistItem 
                  label={t('reset.checklist.assets')} 
                  completed={(dataStatus?.assets || 0) > 0} 
                  count={dataStatus?.assets}
                />
                <ChecklistItem 
                  label={t('reset.checklist.fixed_costs')} 
                  completed={(dataStatus?.fixedCosts || 0) > 0} 
                  count={dataStatus?.fixedCosts}
                />
                <ChecklistItem 
                  label={t('reset.checklist.supplies')} 
                  completed={(dataStatus?.supplies || 0) > 0} 
                  count={dataStatus?.supplies}
                />
                <ChecklistItem 
                  label={t('reset.checklist.services')} 
                  completed={(dataStatus?.services || 0) > 0} 
                  count={dataStatus?.services}
                />
                <ChecklistItem 
                  label={t('reset.checklist.custom_categories')} 
                  completed={(dataStatus?.customCategories || 0) > 0} 
                  count={dataStatus?.customCategories}
                />
              </div>
            </FormSection>
            
            {dataStatus?.hasData && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {t('reset.has_data_warning')}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}