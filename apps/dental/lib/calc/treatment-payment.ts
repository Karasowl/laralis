/**
 * Port of the Postgres trigger `calculate_treatment_is_paid`
 * (supabase/migrations/73_fix_pending_balance_v2.sql):
 *
 *   NEW.is_paid := ( COALESCE(NEW.pending_balance_cents, 0) = 0 OR NEW.status = 'cancelled' );
 *   IF NEW.pending_balance_cents IS NULL OR NEW.pending_balance_cents < 0 THEN
 *     NEW.pending_balance_cents := 0;
 *   END IF;
 *
 * Note the order: is_paid is derived from COALESCE(pending, 0) (NULL treated as 0,
 * but NOT clamped first), so a NEGATIVE pending yields is_paid=false even though
 * pending is subsequently clamped to 0. Money stays in integer cents throughout.
 */
export function deriveTreatmentPaymentState(params: {
  pendingBalanceCents: number | null | undefined
  status: string | null | undefined
}): { pendingBalanceCents: number; isPaid: boolean } {
  const raw = params.pendingBalanceCents
  // is_paid uses COALESCE(pending, 0) = 0 (NULL -> 0, value NOT clamped here).
  const coalesced = raw == null ? 0 : raw
  const isPaid = coalesced === 0 || params.status === 'cancelled'
  // pending_balance_cents is then clamped to >= 0.
  const clamped = raw == null || raw < 0 ? 0 : raw
  return { pendingBalanceCents: clamped, isPaid }
}

export interface TreatmentPaymentSnapshot {
  price_cents?: number | null
  amount_paid_cents?: number | null
  pending_balance_cents?: number | null
  status?: string | null
  is_refunded?: boolean | null
}

/**
 * Returns the outstanding amount recorded for a treatment.
 * Newer records use pending_balance_cents as the source of truth. The price
 * fallback keeps legacy records payable without manufacturing a negative debt.
 */
export function getTreatmentOutstandingBalanceCents(
  treatment: TreatmentPaymentSnapshot
): number {
  if (treatment.pending_balance_cents !== undefined) {
    return Math.max(0, Math.round(treatment.pending_balance_cents ?? 0))
  }

  const priceCents = Math.round(treatment.price_cents ?? 0)
  const amountPaidCents = Math.round(treatment.amount_paid_cents ?? 0)
  return Math.max(0, priceCents - amountPaidCents)
}

export function canRegisterTreatmentPayment(
  treatment: TreatmentPaymentSnapshot
): boolean {
  if (treatment.is_refunded || treatment.status === 'cancelled') return false
  return getTreatmentOutstandingBalanceCents(treatment) > 0
}
