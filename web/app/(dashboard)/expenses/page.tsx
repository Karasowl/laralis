'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ExpenseStats from '@/components/expenses/expense-stats'
import ExpensesTable from '@/components/expenses/expenses-table'
import CreateExpenseDialog from '@/components/expenses/create-expense-dialog'
import ExpenseAlerts from '@/components/expenses/expense-alerts'

export default function ExpensesPage() {
  const t = useTranslations('expenses')
  const [activeTab, setActiveTab] = useState('overview')
  

  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        <PageHeader
          title={t('title')}
          subtitle={t('description')}
          actions={<CreateExpenseDialog />}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
            <TabsTrigger value="list">{t('tabs.list')}</TabsTrigger>
            <TabsTrigger value="alerts">{t('tabs.alerts')}</TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <ExpenseStats detailed={true} />
          </TabsContent>
          
          {/* List Tab */}
          <TabsContent value="list" className="space-y-4">
            <ExpensesTable />
          </TabsContent>
          
          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            <ExpenseAlerts />
          </TabsContent>
        </Tabs>
        {/* Creation and editing are handled by CreateExpenseDialog and table modals */}
      </div>
    </AppLayout>
  )
}
