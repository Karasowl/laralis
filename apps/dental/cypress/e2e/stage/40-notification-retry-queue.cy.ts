type RetrySeed = {
  stamp: string
  clinicId: string
  emailId: string
  smsId: string
  retryIds: string[]
}

function requiredCronSecret() {
  const value = Cypress.env('CRON_SECRET')
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Missing Cypress env CRON_SECRET')
  }
  return value.trim()
}

function cronRequest(mode: 'mock' | 'fail') {
  return cy.request({
    method: 'GET',
    url: '/api/cron/retry-notifications?limit=10',
    headers: {
      authorization: `Bearer ${requiredCronSecret()}`,
      'x-laralis-qa-notifications': mode,
    },
    failOnStatusCode: false,
  })
}

function retryByChannel(rows: Array<Record<string, any>>) {
  return Object.fromEntries(rows.map((row) => [row.channel, row]))
}

describe('Stage notification retry queue', () => {
  let seed: RetrySeed | null = null

  before(() => {
    cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
      const clinic = dataset.clinics.find((row: any) => row.key === 'clinicA')
      expect(clinic, 'QA clinic A').to.exist

      const stamp = `qa-notification-retry-${Date.now()}-${Cypress._.random(1000, 9999)}`
      cy.task('qaNotificationRetrySeed', {
        stamp,
        clinicName: clinic.name,
      }).then((result) => {
        seed = result as RetrySeed
      })
    })
  })

  after(() => {
    if (!seed) return
    cy.task('qaNotificationRetryCleanup', seed)
  })

  it('rejects retry processing without CRON_SECRET', () => {
    cy.request({
      method: 'GET',
      url: '/api/cron/retry-notifications?limit=1',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(401)
      expect(String(response.body?.error || '')).to.match(/unauthorized/i)
    })
  })

  it('reschedules transient provider failures, then succeeds the same queued email and SMS rows', () => {
    expect(seed, 'seeded retry rows').to.exist

    cronRequest('fail').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.processed).to.eq(2)
      expect(response.body.succeeded).to.eq(0)
      expect(response.body.rescheduled).to.eq(2)
      expect(response.body.abandoned).to.eq(0)
    })

    cy.task('qaNotificationRetryState', seed).then((state: any) => {
      const retries = retryByChannel(state.retries)

      expect(state.email.status).to.eq('failed')
      expect(state.sms.status).to.eq('failed')
      expect(retries.email.status).to.eq('pending')
      expect(retries.sms.status).to.eq('pending')
      expect(retries.email.retry_count).to.eq(1)
      expect(retries.sms.retry_count).to.eq(1)
      expect(new Date(retries.email.next_retry_at).getTime()).to.be.greaterThan(Date.now())
      expect(new Date(retries.sms.next_retry_at).getTime()).to.be.greaterThan(Date.now())
    })

    cy.task('qaNotificationRetryMakeDue', {
      retryIds: seed!.retryIds,
    })

    cronRequest('mock').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.processed).to.eq(2)
      expect(response.body.succeeded).to.eq(2)
      expect(response.body.rescheduled).to.eq(0)
      expect(response.body.abandoned).to.eq(0)
    })

    cy.task('qaNotificationRetryState', seed).then((state: any) => {
      const retries = retryByChannel(state.retries)

      expect(state.email.status).to.eq('sent')
      expect(state.email.provider_message_id).to.match(/^qa-retry-email-/)
      expect(state.email.error_message).to.be.null
      expect(state.sms.status).to.eq('sent')
      expect(state.sms.provider_message_id).to.match(/^qa-retry-sms-/)
      expect(state.sms.error_message).to.be.null
      expect(retries.email.status).to.eq('succeeded')
      expect(retries.sms.status).to.eq('succeeded')
      expect(retries.email.processed_at).to.be.a('string').and.not.be.empty
      expect(retries.sms.processed_at).to.be.a('string').and.not.be.empty
    })
  })
})

export {}
