/**
 * Static snapshot table schema (Convex / no-`information_schema` path)
 *
 * Canonical, Postgres-free enumeration of the clinic tables a snapshot covers.
 * Mirrors EXACTLY what the legacy `information_schema` discovery produced via
 * `getKnownDirectTables()` + `KNOWN_INDIRECT_TABLES` in `discovery.ts`, so snapshot
 * output (tables, recordsByTable, checksums, foreignKeyOrder) stays byte-identical
 * when `DATA_READ_BACKEND_SNAPSHOTS=convex`.
 *
 * Do NOT enumerate the full `MIRRORED_TABLES` set here: it contains workspace/global
 * tables (workspaces, clinics, organizations, role_permissions, ...) that have no
 * clinic_id column and were never part of a clinic snapshot. Adding them would
 * change every snapshot's contents and checksum — a behavior change even behind the
 * flag. `MIRRORED_TABLES` is used here only for a dev-time superset cross-check.
 */
import { DiscoveredTable, TableCategory } from './types'
import { MIRRORED_TABLES } from '@/lib/convex/supabase-runtime-mirror'

// Tables that carry clinic_id directly (parity with discovery.getKnownDirectTables()).
const DIRECT_TABLE_NAMES: string[] = [
  // Core operations
  'settings_time',
  'fixed_costs',
  'assets',
  'supplies',
  'services',
  'service_supplies',
  'patients',
  'treatments',
  'expenses',
  // Categories and sources
  'patient_sources',
  'custom_categories',
  'categories', // hybrid (clinic_id nullable)
  // Marketing
  'marketing_campaigns',
  'marketing_campaign_channels',
  'leads',
  'inbox_conversations',
  // Users and invitations
  'clinic_users',
  'invitations',
  // AI and chat
  'action_logs',
  'chat_sessions',
  // Notifications
  'email_notifications',
  'sms_notifications',
  'scheduled_reminders',
  'push_subscriptions',
  'push_notifications',
  // Calendar
  'clinic_google_calendar',
  // Public
  'public_bookings',
  // Medical
  'medications', // hybrid (clinic_id nullable)
  'prescriptions',
  'quotes',
]

// clinic_id is nullable on these (global + clinic-specific rows) -> hybrid.
const HYBRID_TABLE_NAMES = new Set(['categories', 'medications'])

// Indirect tables: no clinic_id, owned by a clinic via a FK to a direct table.
export const INDIRECT_TABLE_DEFS: Array<{ child: string; parent: string; fk: string }> = [
  { child: 'chat_messages', parent: 'chat_sessions', fk: 'session_id' },
  { child: 'ai_feedback', parent: 'chat_sessions', fk: 'session_id' },
  { child: 'inbox_messages', parent: 'inbox_conversations', fk: 'conversation_id' },
  { child: 'prescription_items', parent: 'prescriptions', fk: 'prescription_id' },
  { child: 'quote_items', parent: 'quotes', fk: 'quote_id' },
  {
    child: 'marketing_campaign_status_history',
    parent: 'marketing_campaigns',
    fk: 'campaign_id',
  },
]

function buildStaticTables(): DiscoveredTable[] {
  const directParents = new Set(DIRECT_TABLE_NAMES)

  const direct: DiscoveredTable[] = DIRECT_TABLE_NAMES.map((name) => {
    const isHybrid = HYBRID_TABLE_NAMES.has(name)
    return {
      name,
      category: (isHybrid ? 'hybrid' : 'direct') as TableCategory,
      clinicIdColumn: 'clinic_id',
      isNullable: isHybrid,
    }
  })

  // Same gating as discovery.findIndirectTables(): parent must be a known direct
  // table and the child must not itself be direct.
  const indirect: DiscoveredTable[] = INDIRECT_TABLE_DEFS.filter(
    (def) => directParents.has(def.parent) && !directParents.has(def.child)
  ).map((def) => ({
    name: def.child,
    category: 'indirect' as TableCategory,
    clinicIdColumn: null,
    parentTable: def.parent,
    parentColumn: def.fk,
    isNullable: false,
  }))

  return [...direct, ...indirect]
}

export const STATIC_DISCOVERED_TABLES: DiscoveredTable[] = buildStaticTables()

// Dev-time superset cross-check: every static table must exist in the canonical
// mirror set (otherwise it can never be read from Convex). Logged, never throws.
if (process.env.NODE_ENV !== 'production') {
  const missing = STATIC_DISCOVERED_TABLES.map((t) => t.name).filter(
    (name) => !MIRRORED_TABLES.has(name)
  )
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[static-schema] tables not in MIRRORED_TABLES (no Convex data): ${missing.join(', ')}`
    )
  }
}
