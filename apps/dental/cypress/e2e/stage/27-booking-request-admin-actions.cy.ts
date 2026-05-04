export {}

type Clinic = {
  id: string
  name: string
}

type SeededBooking = {
  stamp: string
  clinicId: string
  serviceId: string
  bookingId: string
  patientEmail: string
  requestedDate: string
  requestedTime: string
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

describe('Stage booking request admin actions', () => {
  const cleanupStamps = new Set<string>()

  after(() => {
    for (const stamp of cleanupStamps) {
      cy.task('qaBookingRequestCleanup', { stamp })
    }
  })

  it('lists pending public booking requests, confirms one into a scheduled treatment, and rejects another', () => {
    cy.loginAsDoctor()

    selectQaClinic().then(({ clinic, serviceName }) => {
      const stamp = `qa-booking-admin-${Date.now()}-${Cypress._.random(1000, 9999)}`
      cleanupStamps.add(stamp)

      cy.task('qaBookingRequestSeed', {
        stamp,
        clinicName: clinic.name,
        serviceName,
        patientLabel: 'Confirm',
        offsetDays: 4,
      }).then((confirmSeeded) => {
        const confirmBooking = confirmSeeded as SeededBooking

        cy.task('qaBookingRequestSeed', {
          stamp,
          clinicName: clinic.name,
          serviceName,
          patientLabel: 'Reject',
          offsetDays: 5,
        }).then((rejectSeeded) => {
          const rejectBooking = rejectSeeded as SeededBooking

          cy.request(`/api/bookings?clinicId=${clinic.id}&status=pending`).then((listResponse) => {
            expect(listResponse.status).to.eq(200)
            const bookingIds = (listResponse.body.data || []).map((row: any) => row.id)
            expect(bookingIds, 'pending booking request list').to.include(confirmBooking.bookingId)
            expect(bookingIds, 'pending booking request list').to.include(rejectBooking.bookingId)
          })

          cy.request({
            method: 'PATCH',
            url: `/api/bookings/${confirmBooking.bookingId}`,
            body: {
              clinic_id: clinic.id,
              action: 'confirm',
            },
          }).then((confirmResponse) => {
            expect(confirmResponse.status).to.eq(200)
            expect(confirmResponse.body.data.status).to.eq('confirmed')
            expect(confirmResponse.body.data.treatment_id).to.be.a('string').and.not.be.empty
            expect(confirmResponse.body.patient_id).to.be.a('string').and.not.be.empty
            expect(confirmResponse.body.treatment.status).to.eq('scheduled')
          })

          cy.task('qaBookingRequestState', {
            bookingId: confirmBooking.bookingId,
            patientEmail: confirmBooking.patientEmail,
          }).then((state: any) => {
            expect(state.booking.status).to.eq('confirmed')
            expect(state.booking.confirmed_at).to.be.a('string').and.not.be.empty
            expect(state.booking.treatment_id).to.eq(state.treatment.id)
            expect(state.booking.patient_id).to.eq(state.patient.id)
            expect(state.patient.email).to.eq(confirmBooking.patientEmail)
            expect(state.treatment.treatment_date).to.eq(confirmBooking.requestedDate)
            expect(String(state.treatment.treatment_time).slice(0, 5)).to.eq(confirmBooking.requestedTime)
            expect(state.treatment.status).to.eq('scheduled')
          })

          cy.request({
            method: 'PATCH',
            url: `/api/bookings/${rejectBooking.bookingId}`,
            body: {
              clinic_id: clinic.id,
              action: 'reject',
              rejection_reason: 'QA rejected slot',
            },
          }).then((rejectResponse) => {
            expect(rejectResponse.status).to.eq(200)
            expect(rejectResponse.body.data.status).to.eq('rejected')
            expect(rejectResponse.body.data.rejection_reason).to.eq('QA rejected slot')
            expect(rejectResponse.body.data.treatment_id).to.be.null
          })

          cy.task('qaBookingRequestState', {
            bookingId: rejectBooking.bookingId,
            patientEmail: rejectBooking.patientEmail,
          }).then((state: any) => {
            expect(state.booking.status).to.eq('rejected')
            expect(state.booking.rejection_reason).to.eq('QA rejected slot')
            expect(state.booking.treatment_id).to.be.null
            expect(state.treatment).to.be.null
            expect(state.patient).to.be.null
          })

          cy.request({
            method: 'PATCH',
            url: `/api/bookings/${rejectBooking.bookingId}`,
            failOnStatusCode: false,
            body: {
              clinic_id: clinic.id,
              action: 'confirm',
            },
          }).then((response) => {
            expect(response.status, 'rejected bookings cannot be confirmed later').to.eq(409)
          })
        })
      })
    })
  })
})
