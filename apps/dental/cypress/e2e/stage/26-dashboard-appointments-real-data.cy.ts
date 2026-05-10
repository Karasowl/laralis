export {}

type Clinic = {
  id: string
  name: string
}

type DashboardAppointments = {
  today: number
  tomorrow: number
  thisWeek: number
  trend: 'up' | 'down' | 'stable'
  trendValue: number
}

type SeedContext = {
  stamp: string
  clinicId: string
  asOfDate: string
  expected: {
    today: number
    tomorrow: number
    thisWeek: number
  }
}

function civilToday() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dashboardAppointmentsUrl(clinicId: string, asOfDate: string) {
  return `/api/dashboard/appointments?clinicId=${clinicId}&asOf=${asOfDate}`
}

function expectAppointmentsShape(body: DashboardAppointments) {
  expect(body.today, 'today appointments').to.be.a('number').and.to.be.gte(0)
  expect(body.tomorrow, 'tomorrow appointments').to.be.a('number').and.to.be.gte(0)
  expect(body.thisWeek, 'this week appointments').to.be.a('number').and.to.be.gte(0)
  expect(body.trend, 'trend').to.match(/^(up|down|stable)$/)
  expect(body.trendValue, 'trend value').to.be.a('number').and.to.be.gte(0)
}

function selectQaClinic(): Cypress.Chainable<{ clinic: Clinic; serviceName: string }> {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
    const clinicA = dataset.clinics.find((clinic: any) => clinic.key === 'clinicA')
    const service = dataset.services.find((row: any) => row.key === 'limpieza')

    expect(clinicA, 'QA clinic A definition').to.exist
    expect(service, 'QA limpieza service definition').to.exist

    return cy.request('/api/clinics').then((clinicsResponse) => {
      expect(clinicsResponse.status).to.eq(200)
      const clinic = (clinicsResponse.body.data || []).find((row: Clinic) => row.name === clinicA.name)
      expect(clinic, 'QA clinic A in stage').to.exist

      return cy.request('POST', '/api/clinics', { clinicId: clinic.id }).then((selectResponse) => {
        expect(selectResponse.status).to.eq(200)
        return {
          clinic,
          serviceName: service.name,
        }
      })
    })
  })
}

describe('Stage dashboard appointment metrics', () => {
  let ctx: SeedContext | undefined

  after(() => {
    if (ctx?.stamp) {
      cy.task('qaDashboardAppointmentsCleanup', { stamp: ctx.stamp })
    }
  })

  it('counts real scheduled treatments and public booking requests without random mock data', () => {
    cy.loginAsDoctor()

    selectQaClinic().then(({ clinic, serviceName }) => {
      const asOfDate = civilToday()
      const stamp = `qa-dashboard-appointments-${Date.now()}-${Cypress._.random(1000, 9999)}`

      cy.request(dashboardAppointmentsUrl(clinic.id, asOfDate)).then((beforeResponse) => {
        expect(beforeResponse.status).to.eq(200)
        const beforeBody = beforeResponse.body as DashboardAppointments
        expectAppointmentsShape(beforeBody)

        cy.task('qaDashboardAppointmentsSeed', {
          stamp,
          clinicName: clinic.name,
          serviceName,
          asOfDate,
        }).then((seeded) => {
          ctx = seeded as SeedContext
          expect(ctx.asOfDate).to.eq(asOfDate)

          cy.request(dashboardAppointmentsUrl(clinic.id, asOfDate)).then((afterResponse) => {
            expect(afterResponse.status).to.eq(200)
            const afterBody = afterResponse.body as DashboardAppointments
            expectAppointmentsShape(afterBody)

            expect(afterBody.today - beforeBody.today, 'seeded today appointment delta').to.eq(ctx!.expected.today)
            expect(afterBody.tomorrow - beforeBody.tomorrow, 'seeded tomorrow appointment delta').to.eq(ctx!.expected.tomorrow)
            expect(afterBody.thisWeek - beforeBody.thisWeek, 'seeded this-week appointment delta').to.eq(ctx!.expected.thisWeek)

            cy.request(dashboardAppointmentsUrl(clinic.id, asOfDate)).then((repeatResponse) => {
              expect(repeatResponse.status).to.eq(200)
              expect(repeatResponse.body, 'appointments endpoint must be deterministic').to.deep.eq(afterBody)
            })
          })
        })
      })
    })
  })
})
