export {}

type Clinic = {
  id: string
  name: string
}

type ConflictSeed = {
  stamp: string
  clinicId: string
  serviceId: string
  patientId: string
  treatmentId: string
  bookingId: string
  conflictingBookingId: string
  conflictingBookingEmail: string
  publicBookingAppointmentId: string
  conflictingPublicBookingAppointmentId: string
  date: string
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

function conflictIds(response: Cypress.Response<any>) {
  return (response.body.conflicts || []).map((conflict: any) => conflict.appointmentId)
}

describe('Stage appointment conflict enforcement', () => {
  let ctx: ConflictSeed | undefined

  after(() => {
    if (ctx?.stamp) {
      cy.task('qaScheduleConflictCleanup', { stamp: ctx.stamp })
    }
  })

  it('detects treatment and public-booking conflicts and blocks conflicting writes in the backend', () => {
    cy.loginAsDoctor()

    selectQaClinic().then(({ clinic, serviceName }) => {
      const stamp = `qa-schedule-conflict-${Date.now()}-${Cypress._.random(1000, 9999)}`

      cy.task('qaScheduleConflictSeed', {
        stamp,
        clinicName: clinic.name,
        serviceName,
      }).then((seeded) => {
        ctx = seeded as ConflictSeed

        cy.request({
          method: 'POST',
          url: '/api/treatments/check-conflicts',
          body: {
            clinic_id: clinic.id,
            date: ctx.date,
            time: '09:15',
            duration_minutes: 30,
          },
        }).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.hasConflict).to.eq(true)
          expect(conflictIds(response), 'existing treatment conflict').to.include(ctx!.treatmentId)
        })

        cy.request({
          method: 'POST',
          url: '/api/treatments/check-conflicts',
          body: {
            clinic_id: clinic.id,
            date: ctx.date,
            time: '11:15',
            duration_minutes: 30,
          },
        }).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.hasConflict).to.eq(true)
          expect(conflictIds(response), 'pending public booking conflict').to.include(ctx!.publicBookingAppointmentId)
        })

        cy.request({
          method: 'POST',
          url: '/api/treatments/check-conflicts',
          body: {
            clinic_id: clinic.id,
            date: ctx.date,
            time: '13:00',
            duration_minutes: 30,
          },
        }).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.hasConflict).to.eq(false)
          expect(response.body.conflicts).to.deep.eq([])
        })

        cy.request({
          method: 'POST',
          url: '/api/treatments',
          failOnStatusCode: false,
          body: {
            clinic_id: clinic.id,
            patient_id: ctx.patientId,
            service_id: ctx.serviceId,
            treatment_date: ctx.date,
            treatment_time: '09:30',
            minutes: 30,
            variable_cost_cents: 2500,
            margin_pct: 55,
            price_cents: 150000,
            status: 'scheduled',
            notes: `qa-schedule-conflict blocked-treatment ${stamp}`,
          },
        }).then((response) => {
          expect(response.status).to.eq(409)
          expect(response.body.error).to.eq('appointment_conflict')
          expect(conflictIds(response), 'backend conflict details').to.include(ctx!.treatmentId)
        })

        cy.request({
          method: 'PATCH',
          url: `/api/bookings/${ctx.conflictingBookingId}`,
          failOnStatusCode: false,
          body: {
            clinic_id: clinic.id,
            action: 'confirm',
          },
        }).then((response) => {
          expect(response.status).to.eq(409)
          expect(response.body.error).to.eq('appointment_conflict')
          expect(conflictIds(response), 'booking confirmation conflict details').to.include(ctx!.treatmentId)
        })

        cy.task('qaBookingRequestState', {
          bookingId: ctx.conflictingBookingId,
          patientEmail: ctx.conflictingBookingEmail,
        }).then((state: any) => {
          expect(state.booking.status).to.eq('pending')
          expect(state.booking.treatment_id).to.be.null
          expect(state.booking.patient_id).to.be.null
          expect(state.patient).to.be.null
          expect(state.treatment).to.be.null
        })

        cy.request({
          method: 'POST',
          url: '/api/treatments',
          body: {
            clinic_id: clinic.id,
            patient_id: ctx.patientId,
            service_id: ctx.serviceId,
            treatment_date: ctx.date,
            treatment_time: '13:00',
            minutes: 30,
            variable_cost_cents: 2500,
            margin_pct: 55,
            price_cents: 150000,
            status: 'scheduled',
            notes: `qa-schedule-conflict allowed-treatment ${stamp}`,
          },
        }).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.data.status).to.eq('scheduled')
          expect(response.body.data.treatment_date).to.eq(ctx!.date)
          expect(String(response.body.data.treatment_time).slice(0, 5)).to.eq('13:00')
        })
      })
    })
  })
})
