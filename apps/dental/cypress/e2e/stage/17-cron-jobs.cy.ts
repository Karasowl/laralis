type CronSeedContext = {
  stamp: string
  clinicId: string
  serviceId: string
  patientId: string
  pastTreatmentId: string
  futureTreatmentId: string
  reminderId: string
  recurringExpenseId: string
  pushEndpoint: string
  previousClinic: {
    auto_complete_appointments?: boolean | null
    notification_settings?: unknown
  }
}

function requiredCronSecret() {
  const value = Cypress.env('CRON_SECRET')
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Missing Cypress env CRON_SECRET')
  }
  return value.trim()
}

function cronHeaders() {
  return {
    authorization: `Bearer ${requiredCronSecret()}`,
    'x-laralis-qa-notifications': 'mock',
  }
}

function cronRequest(url: string) {
  return cy.request({
    method: 'GET',
    url,
    headers: cronHeaders(),
    failOnStatusCode: false,
  })
}

function expectUnauthorized(url: string) {
  cy.request({
    method: 'GET',
    url,
    failOnStatusCode: false,
  }).then((response) => {
    expect(response.status, `${url} must require CRON_SECRET`).to.eq(401)
    expect(String(response.body?.error || '')).to.match(/unauthorized/i)
  })
}

function byId(rows: Array<Record<string, any>>): Record<string, any> {
  return Object.fromEntries(rows.map((row) => [row.id, row]))
}

describe('Stage cron jobs', () => {
  let ctx: CronSeedContext

  before(() => {
    cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
      const clinic = dataset.clinics.find((row: any) => row.key === 'clinicA')
      const service = dataset.services.find((row: any) => row.key === 'limpieza')

      expect(clinic, 'QA clinic A').to.exist
      expect(service, 'QA limpieza service').to.exist

      const stamp = `qa-cron-${Date.now()}-${Cypress._.random(1000, 9999)}`
      cy.task('qaCronSeed', {
        stamp,
        clinicName: clinic.name,
        serviceName: service.name,
      }).then((seeded) => {
        ctx = seeded as CronSeedContext
      })
    })
  })

  after(() => {
    if (ctx) {
      cy.task('qaCronCleanup', ctx)
    }
  })

  it('rejects every cron route without CRON_SECRET', () => {
    expectUnauthorized('/api/cron/send-reminders')
    expectUnauthorized('/api/cron/complete-appointments')
    expectUnauthorized('/api/cron/recurring-expenses')
    expectUnauthorized('/api/cron/cleanup-draft-workspaces?dryRun=true')
  })

  it('processes due appointment reminders with mocked email and push, then records notification ids', () => {
    cronRequest('/api/cron/send-reminders').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.processed).to.be.greaterThan(0)
      expect(response.body.sent).to.be.greaterThan(0)
      expect(response.body.failed).to.eq(0)
      expect(response.body.push.sent).to.be.greaterThan(0)
    })

    cy.task('qaCronState', ctx).then((state: any) => {
      const reminder = state.reminder
      const email = state.emails.find((row: any) => row.provider_message_id === `qa-reminder-${ctx.reminderId}`)
      const push = state.pushNotifications.find((row: any) => row.notification_type === 'appointment_reminder')

      expect(reminder.status).to.eq('sent')
      expect(reminder.processed_at).to.be.a('string').and.not.be.empty
      expect(email, 'mocked reminder email log').to.exist
      expect(email.status).to.eq('sent')
      expect(email.notification_type).to.eq('reminder')
      expect(reminder.email_notification_id).to.eq(email.id)
      expect(push, 'mocked appointment reminder push log').to.exist
      expect(push.status).to.eq('sent')
      expect(push.body).to.include(ctx.stamp)
    })
  })

  it('auto-completes only past scheduled appointments and leaves future ones scheduled', () => {
    cronRequest('/api/cron/complete-appointments').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.success).to.eq(true)
      expect(response.body.updated).to.be.greaterThan(0)
      expect(response.body.clinics).to.be.greaterThan(0)
    })

    cy.task('qaCronState', ctx).then((state: any) => {
      const treatments = byId(state.treatments)

      expect(treatments[ctx.pastTreatmentId].status).to.eq('completed')
      expect(treatments[ctx.futureTreatmentId].status).to.eq('scheduled')
    })
  })

  it('generates recurring expenses from due templates exactly once', () => {
    cronRequest('/api/cron/recurring-expenses').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.success).to.eq(true)
      expect(response.body.generated).to.be.greaterThan(0)
      expect(response.body.expense_ids).to.be.an('array')
    })

    cy.task('qaCronState', ctx).then((state: any) => {
      expect(state.generatedExpenses, 'generated expenses for template').to.have.length(1)
      expect(state.generatedExpenses[0].parent_expense_id).to.eq(ctx.recurringExpenseId)
      expect(state.generatedExpenses[0].description).to.include(ctx.stamp)
      expect(state.generatedExpenses[0].amount_cents).to.eq(12345)
      expect(state.recurringExpense.next_recurrence_date).to.be.a('string').and.not.be.empty
    })
  })

  it('runs draft workspace cleanup dry-run under cron auth without mutating data', () => {
    cronRequest('/api/cron/cleanup-draft-workspaces?dryRun=true').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.success).to.eq(true)
      expect(response.body.dryRun).to.eq(true)
      expect(response.body.policy.draftExpiresAfterDays).to.be.a('number')
      expect(response.body.results).to.have.keys(['expired', 'archived', 'deleted', 'skipped'])
    })
  })
})
