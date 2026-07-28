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
