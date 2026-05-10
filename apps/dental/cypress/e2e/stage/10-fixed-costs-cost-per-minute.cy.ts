export {}

type QaDataset = {
  clinics: Array<{
    key: string
    name: string
  }>
}

type CostPerMinuteSnapshot = {
  per_minute_cents: number
  monthly_fixed_cents: number
  effective_minutes_per_month: number
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function selectQaClinic(key = 'clinicA') {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset: QaDataset) => {
    const clinicName = dataset.clinics.find((clinic) => clinic.key === key)?.name

    return cy.request('/api/clinics').then((clinicsResponse) => {
      expect(clinicsResponse.status).to.eq(200)
      const clinic = (clinicsResponse.body.data || []).find((item: any) => item.name === clinicName)
      expect(clinic, `QA ${key}`).to.exist

      return cy.request('POST', '/api/clinics', { clinicId: clinic.id }).then((selectResponse) => {
        expect(selectResponse.status).to.eq(200)
        return clinic
      })
    })
  })
}

function getCostPerMinute() {
  return cy.request('/api/time/cost-per-minute').then((response) => {
    expect(response.status).to.eq(200)
    const data = response.body.data as CostPerMinuteSnapshot
    expect(data.effective_minutes_per_month, 'effective minutes').to.be.greaterThan(0)
    return data
  })
}

function visibleText($root: JQuery<HTMLElement>) {
  return $root
    .find(':visible')
    .toArray()
    .map((element) => element.textContent || '')
    .join(' ')
}

describe('Stage fixed costs and cost per minute', () => {
  const stamp = `QA Costo Fijo ${Date.now()}`
  const initialAmountCents = 216000
  const updatedAmountCents = 432000
  let createdFixedCostId: string | undefined

  beforeEach(() => {
    cy.loginAsDoctor()
    selectQaClinic('clinicA')
  })

  afterEach(() => {
    if (!createdFixedCostId) return

    cy.loginAsDoctor()
    selectQaClinic('clinicA')
    cy.request({
      method: 'DELETE',
      url: `/api/fixed-costs/${createdFixedCostId}`,
      failOnStatusCode: false,
    }).then((response) => {
      expect([200, 204, 404], 'cleanup fixed cost').to.include(response.status)
    })
    createdFixedCostId = undefined
  })

  it('creates, updates, deletes a fixed cost and recalculates cost per minute', () => {
    getCostPerMinute().then((baseline) => {
      cy.request('POST', '/api/fixed-costs', {
        category: 'other',
        concept: stamp,
        amount_cents: initialAmountCents,
      }).then((createResponse) => {
        expect(createResponse.status).to.eq(201)
        createdFixedCostId = createResponse.body.data.id
        expect(createResponse.body.data.concept).to.eq(stamp)
        expect(createResponse.body.data.amount_cents).to.eq(initialAmountCents)
      })

      cy.visit('/fixed-costs')
      cy.assertAppShell()
      cy.assertNoHorizontalScroll()
      cy.get('main', { timeout: 30000 }).should(($main) => {
        const text = visibleText($main)
        expect(text).to.include(stamp)
        expect(text).to.include(formatCurrency(initialAmountCents))
      })

      getCostPerMinute().then((afterCreate) => {
        expect(afterCreate.monthly_fixed_cents).to.eq(
          baseline.monthly_fixed_cents + initialAmountCents
        )
        expect(afterCreate.per_minute_cents).to.eq(
          Math.round(afterCreate.monthly_fixed_cents / afterCreate.effective_minutes_per_month)
        )
      })

      cy.then(() => {
        expect(createdFixedCostId, 'created fixed cost id').to.be.a('string')
        cy.request('PUT', `/api/fixed-costs/${createdFixedCostId}`, {
          category: 'other',
          concept: `${stamp} Editado`,
          amount_cents: updatedAmountCents,
        }).then((updateResponse) => {
          expect(updateResponse.status).to.eq(200)
          expect(updateResponse.body.data.concept).to.eq(`${stamp} Editado`)
          expect(updateResponse.body.data.amount_cents).to.eq(updatedAmountCents)
        })
      })

      getCostPerMinute().then((afterUpdate) => {
        expect(afterUpdate.monthly_fixed_cents).to.eq(
          baseline.monthly_fixed_cents + updatedAmountCents
        )
        expect(afterUpdate.per_minute_cents).to.eq(
          Math.round(afterUpdate.monthly_fixed_cents / afterUpdate.effective_minutes_per_month)
        )
      })

      cy.then(() => {
        cy.request('DELETE', `/api/fixed-costs/${createdFixedCostId}`).then((deleteResponse) => {
          expect(deleteResponse.status).to.eq(200)
          createdFixedCostId = undefined
        })
      })

      getCostPerMinute().then((afterDelete) => {
        expect(afterDelete.monthly_fixed_cents).to.eq(baseline.monthly_fixed_cents)
        expect(afterDelete.per_minute_cents).to.eq(baseline.per_minute_cents)
      })
    })
  })
})
