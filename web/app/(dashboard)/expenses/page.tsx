import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import ExpensesTable from '@/components/expenses/expenses-table'
import ExpenseStats from '@/components/expenses/expense-stats'
import ExpenseAlerts from '@/components/expenses/expense-alerts'
import CreateExpenseDialog from '@/components/expenses/create-expense-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const metadata: Metadata = {
  title: 'Gastos - Laralis',
  description: 'Gestión de gastos y control financiero'
}

export default async function ExpensesPage() {
  const t = await getTranslations('expenses')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <CreateExpenseDialog />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
          <TabsTrigger value="expenses">{t('tabs.expenses')}</TabsTrigger>
          <TabsTrigger value="analytics">{t('tabs.analytics')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Alerts Section */}
          <ExpenseAlerts />

          {/* Quick Stats */}
          <ExpenseStats />

          {/* Recent Expenses */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">{t('recent_expenses')}</h2>
            <ExpensesTable limit={5} />
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6">
          <ExpensesTable />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6">
            <ExpenseStats detailed />
            
            {/* Monthly Trends */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">{t('monthly_trends')}</h2>
              <div className="text-center text-muted-foreground py-8">
                {t('charts_coming_soon')}
              </div>
            </Card>

            {/* Category Breakdown */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">{t('category_breakdown')}</h2>
              <div className="text-center text-muted-foreground py-8">
                {t('charts_coming_soon')}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}