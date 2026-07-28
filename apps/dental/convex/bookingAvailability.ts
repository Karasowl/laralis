import { v } from 'convex/values'
import { query } from './_generated/server'

/**
 * Convex port of the Postgres RPC `check_booking_slot_availability`
 * (supabase/migrations/79_fix_booking_availability_treatment_minutes.sql — the
 * CURRENT body; reads treatments.`minutes`, NOT duration_minutes).
 *
 * PUBLIC query (no secret): the SQL function is GRANTed to anon because public
 * booking is unauthenticated. It returns only a boolean, never row data.
 *
 * Returns true when the candidate slot is available, false when it collides with
 * a blocked slot, a scheduled/in-progress treatment, or a pending public booking.
 * Replicates the SQL half-open overlap test EXACTLY, including its pre-existing
 * limitation (does not detect a candidate that fully envelops a shorter slot).
 */

type Doc = Record<string, any>

// 'HH:MM' / 'HH:MM:SS' -> minute-of-day. Defensive: Supabase `time` may serialize
// either way in the mirror; integer math avoids interval-parsing edge cases.
function toMinutes(value: string | null | undefined): number | null {
  if (value == null) return null
  const parts = String(value).slice(0, 5).split(':')
  if (parts.length < 2) return null
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

// SQL: (cand >= exStart AND cand < exEnd) OR (candEnd > exStart AND candEnd <= exEnd)
function overlaps(candStart: number, candEnd: number, exStart: number, exEnd: number): boolean {
  return (candStart >= exStart && candStart < exEnd) || (candEnd > exStart && candEnd <= exEnd)
}

export const checkSlotAvailable = query({
  args: {
    clinicId: v.string(),
    date: v.string(),
    time: v.string(),
    durationMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const dur = args.durationMinutes ?? 30
    const startMin = toMinutes(args.time)
    if (startMin == null) return false
    const slotEndMin = startMin + dur

    // 1. Blocked slots (whole-day if start_time IS NULL).
    const blocked = (await ctx.db.query('booking_blocked_slots' as any).collect()) as Doc[]
    for (const b of blocked) {
      if (String(b.clinic_id) !== args.clinicId || b.blocked_date !== args.date) continue
      if (b.start_time == null) return false
      const exStart = toMinutes(b.start_time)
      const exEnd = toMinutes(b.end_time)
      if (exStart == null || exEnd == null) continue
      if (overlaps(startMin, slotEndMin, exStart, exEnd)) return false
    }

    // 2. Treatment conflicts. Existing duration = COALESCE(minutes, 30).
    const treatments = (await ctx.db.query('treatments' as any).collect()) as Doc[]
    for (const t of treatments) {
      if (String(t.clinic_id) !== args.clinicId || t.treatment_date !== args.date) continue
      if (t.status !== 'scheduled' && t.status !== 'in_progress') continue
      if (t.treatment_time == null) continue
      const exStart = toMinutes(t.treatment_time)
      if (exStart == null) continue
      const exEnd = exStart + Number(t.minutes ?? 30)
      if (overlaps(startMin, slotEndMin, exStart, exEnd)) return false
    }

    // 3. Pending public bookings. Existing booking end uses the CANDIDATE duration
    //    (SQL quirk: public_bookings has no stored duration column).
    const bookings = (await ctx.db.query('public_bookings' as any).collect()) as Doc[]
    for (const pb of bookings) {
      if (String(pb.clinic_id) !== args.clinicId || pb.requested_date !== args.date) continue
      if (pb.status !== 'pending') continue
      const exStart = toMinutes(pb.requested_time)
      if (exStart == null) continue
      const exEnd = exStart + dur
      if (overlaps(startMin, slotEndMin, exStart, exEnd)) return false
    }

    return true
  },
})
