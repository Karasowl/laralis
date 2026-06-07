import { describe, it, expect } from 'vitest'
import { deriveTreatmentPaymentState } from '@/lib/calc/treatment-payment'

/**
 * Parity tests for the Convex port of the calculate_treatment_is_paid trigger
 * (migration 73). is_paid = COALESCE(pending,0)==0 OR status=='cancelled';
 * pending clamped to >= 0 afterwards.
 */
describe('deriveTreatmentPaymentState', () => {
  it('fully paid (pending 0) -> is_paid true', () => {
    expect(deriveTreatmentPaymentState({ pendingBalanceCents: 0, status: 'completed' })).toEqual({
      pendingBalanceCents: 0,
      isPaid: true,
    })
  })

  it('null pending -> treated as 0 -> is_paid true, clamped to 0', () => {
    expect(deriveTreatmentPaymentState({ pendingBalanceCents: null, status: 'scheduled' })).toEqual({
      pendingBalanceCents: 0,
      isPaid: true,
    })
  })

  it('positive pending -> is_paid false', () => {
    expect(deriveTreatmentPaymentState({ pendingBalanceCents: 5000, status: 'completed' })).toEqual({
      pendingBalanceCents: 5000,
      isPaid: false,
    })
  })

  it('cancelled is always is_paid true regardless of pending', () => {
    expect(deriveTreatmentPaymentState({ pendingBalanceCents: 5000, status: 'cancelled' })).toEqual({
      pendingBalanceCents: 5000,
      isPaid: true,
    })
  })

  it('negative pending -> is_paid false (COALESCE pre-clamp), pending clamped to 0', () => {
    expect(deriveTreatmentPaymentState({ pendingBalanceCents: -500, status: 'completed' })).toEqual({
      pendingBalanceCents: 0,
      isPaid: false,
    })
  })

  it('negative pending but cancelled -> is_paid true, pending clamped to 0', () => {
    expect(deriveTreatmentPaymentState({ pendingBalanceCents: -500, status: 'cancelled' })).toEqual({
      pendingBalanceCents: 0,
      isPaid: true,
    })
  })
})
