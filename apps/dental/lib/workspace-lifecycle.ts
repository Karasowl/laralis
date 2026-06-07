import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { deleteClinicData } from '@/lib/clinic-tables'
import {
  listConvexDocumentsByClinic,
  listConvexDocumentsByWorkspace,
  deleteConvexDocumentByLegacyId,
} from '@/lib/convex/server'
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath } from '@/lib/data-backend'

type ConvexRow = Record<string, any>

// Per-clinic table delete order mirroring CLINIC_DELETE_SEQUENCE (lib/clinic-tables.ts),
// restricted to the tables Convex actually mirrors. marketing_platforms /
// expense_categories are NOT migrated tables, so the Supabase-only cleanup of those is
// skipped in the Convex path (delete on a non-migrated table throws in Convex).
const CONVEX_CLINIC_DELETE_TABLES = [
  'treatments',
  'tariffs',
  'expenses',
  'patients',
  'services',
  'supplies',
  'assets',
  'fixed_costs',
  'settings_time',
  'marketing_campaigns',
  'categories',
  'category_types',
] as const

// Workspace-scoped tables deleted after per-clinic cleanup, mirroring the
// deleteWorkspaceTree order below (workspace_activity / custom_role_templates included).
const CONVEX_WORKSPACE_DELETE_TABLES = [
  'invitations',
  'workspace_users',
  'workspace_members',
  'workspace_activity',
  'custom_role_templates',
] as const

async function deleteConvexRowsByClinic(table: string, clinicId: string) {
  const rows = (await listConvexDocumentsByClinic(table, clinicId)) as ConvexRow[]
  for (const row of rows) {
    const legacyId = row?.id ?? row?.legacyId
    if (legacyId) await deleteConvexDocumentByLegacyId(table, String(legacyId))
  }
}

async function deleteConvexRowsByWorkspace(table: string, workspaceId: string) {
  const rows = (await listConvexDocumentsByWorkspace(table, workspaceId)) as ConvexRow[]
  for (const row of rows) {
    const legacyId = row?.id ?? row?.legacyId
    if (legacyId) await deleteConvexDocumentByLegacyId(table, String(legacyId))
  }
}

export const WORKSPACE_STATUSES = [
  'draft',
  'active',
  'archived',
  'expired',
  'pending_deletion',
  'deleted',
] as const

export type WorkspaceStatus = typeof WORKSPACE_STATUSES[number]

export const WORKSPACE_DRAFT_EXPIRY_DAYS = 14
export const WORKSPACE_EXPIRED_PURGE_DAYS = 30

export const RESUMABLE_WORKSPACE_STATUSES = new Set<WorkspaceStatus>(['draft', 'expired'])
export const HIDDEN_WORKSPACE_STATUSES = new Set<WorkspaceStatus>([
  'archived',
  'pending_deletion',
  'deleted',
])

export function normalizeWorkspaceStatus(
  status: unknown,
  onboardingCompleted?: boolean | null
): WorkspaceStatus {
  if (typeof status === 'string' && WORKSPACE_STATUSES.includes(status as WorkspaceStatus)) {
    return status as WorkspaceStatus
  }

  return onboardingCompleted ? 'active' : 'draft'
}

export function isActiveWorkspace(workspace: {
  status?: string | null
  onboarding_completed?: boolean | null
}) {
  return normalizeWorkspaceStatus(workspace.status, workspace.onboarding_completed) === 'active'
}

export function isHiddenWorkspace(workspace: {
  status?: string | null
  onboarding_completed?: boolean | null
}) {
  return HIDDEN_WORKSPACE_STATUSES.has(
    normalizeWorkspaceStatus(workspace.status, workspace.onboarding_completed)
  )
}

export function isResumableWorkspace(workspace: {
  status?: string | null
  onboarding_completed?: boolean | null
}) {
  const status = normalizeWorkspaceStatus(workspace.status, workspace.onboarding_completed)
  return !workspace.onboarding_completed && RESUMABLE_WORKSPACE_STATUSES.has(status)
}

export async function countWorkspaceCriticalRows(workspaceId: string) {
  // Convex-only read path: Supabase is unreachable, so count patients + treatments
  // across the workspace clinics via the Convex mirror instead of supabaseAdmin.
  if (shouldReturnConvexData('workspaces')) {
    const clinicRows = (await listConvexDocumentsByWorkspace('clinics', workspaceId)) as ConvexRow[]
    const clinicIds = clinicRows
      .map((clinic) => clinic?.id)
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)

    if (clinicIds.length === 0) {
      return { clinicIds, patients: 0, treatments: 0, hasCriticalData: false }
    }

    let patients = 0
    let treatments = 0
    for (const clinicId of clinicIds) {
      const [patientRows, treatmentRows] = await Promise.all([
        listConvexDocumentsByClinic('patients', clinicId) as Promise<ConvexRow[]>,
        listConvexDocumentsByClinic('treatments', clinicId) as Promise<ConvexRow[]>,
      ])
      patients += patientRows.length
      treatments += treatmentRows.length
    }

    return {
      clinicIds,
      patients,
      treatments,
      hasCriticalData: patients > 0 || treatments > 0,
    }
  }

  const { data: clinics, error: clinicsError } = await supabaseAdmin
    .from('clinics')
    .select('id')
    .eq('workspace_id', workspaceId)

  if (clinicsError) throw clinicsError

  const clinicIds = (clinics ?? [])
    .map((clinic: any) => clinic?.id)
    .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)

  if (clinicIds.length === 0) {
    return {
      clinicIds,
      patients: 0,
      treatments: 0,
      hasCriticalData: false,
    }
  }

  const [{ count: patients, error: patientsError }, { count: treatments, error: treatmentsError }] =
    await Promise.all([
      supabaseAdmin
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .in('clinic_id', clinicIds),
      supabaseAdmin
        .from('treatments')
        .select('id', { count: 'exact', head: true })
        .in('clinic_id', clinicIds),
    ])

  if (patientsError) throw patientsError
  if (treatmentsError) throw treatmentsError

  return {
    clinicIds,
    patients: patients ?? 0,
    treatments: treatments ?? 0,
    hasCriticalData: (patients ?? 0) > 0 || (treatments ?? 0) > 0,
  }
}

async function deleteRows(table: string, column: string, value: string) {
  const { error } = await supabaseAdmin.from(table).delete().eq(column, value)
  if (error && error.code !== 'PGRST116') throw error
}

export async function deleteWorkspaceTree(workspaceId: string) {
  // Convex-only write path: Supabase is unreachable. Hard-delete the workspace
  // subtree via the Convex mirror in the same order Supabase cascades:
  // per-clinic data (marketing_campaign_status_history -> per-table sequence) +
  // clinic_users, then workspace-scoped tables, then clinics, then the workspace row.
  // Mirrors deleteWorkspaceTreeInConvex in app/api/workspaces/[id]/lifecycle/route.ts.
  if (shouldUseConvexOnlyWritePath('workspaces')) {
    const clinicRows = (await listConvexDocumentsByWorkspace('clinics', workspaceId)) as ConvexRow[]
    const clinicIds = clinicRows
      .map((row) => row?.id)
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)

    for (const clinicId of clinicIds) {
      // marketing_campaign_status_history is keyed by campaign_id (not clinic_id):
      // resolve this clinic's campaigns first, then delete their status history.
      const campaigns = (await listConvexDocumentsByClinic('marketing_campaigns', clinicId)) as ConvexRow[]
      const campaignIds = new Set(
        campaigns
          .map((row) => row?.id)
          .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      )
      if (campaignIds.size > 0) {
        const historyByClinic = (await listConvexDocumentsByClinic('marketing_campaign_status_history', clinicId)) as ConvexRow[]
        const historyByWorkspace = (await listConvexDocumentsByWorkspace('marketing_campaign_status_history', workspaceId)) as ConvexRow[]
        const seen = new Set<string>()
        for (const row of [...historyByClinic, ...historyByWorkspace]) {
          const legacyId = row?.id ?? row?.legacyId
          if (!legacyId) continue
          if (row?.campaign_id != null && !campaignIds.has(String(row.campaign_id))) continue
          const key = String(legacyId)
          if (seen.has(key)) continue
          seen.add(key)
          await deleteConvexDocumentByLegacyId('marketing_campaign_status_history', key)
        }
      }

      for (const table of CONVEX_CLINIC_DELETE_TABLES) {
        await deleteConvexRowsByClinic(table, clinicId)
      }
      await deleteConvexRowsByClinic('clinic_users', clinicId)
    }

    for (const table of CONVEX_WORKSPACE_DELETE_TABLES) {
      await deleteConvexRowsByWorkspace(table, workspaceId)
    }

    for (const clinicId of clinicIds) {
      await deleteConvexDocumentByLegacyId('clinics', clinicId)
    }
    await deleteConvexDocumentByLegacyId('workspaces', workspaceId)
    return
  }

  const { data: clinicRows, error: clinicQueryError } = await supabaseAdmin
    .from('clinics')
    .select('id')
    .eq('workspace_id', workspaceId)

  if (clinicQueryError) throw clinicQueryError

  const clinicIds = (clinicRows ?? [])
    .map((row: any) => row?.id)
    .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)

  for (const clinicId of clinicIds) {
    await deleteClinicData(clinicId)
    await deleteRows('clinic_users', 'clinic_id', clinicId)
  }

  await deleteRows('invitations', 'workspace_id', workspaceId)
  await deleteRows('workspace_users', 'workspace_id', workspaceId)
  await deleteRows('workspace_members', 'workspace_id', workspaceId)
  await deleteRows('workspace_activity', 'workspace_id', workspaceId)
  await deleteRows('custom_role_templates', 'workspace_id', workspaceId)
  await deleteRows('clinics', 'workspace_id', workspaceId)
  await deleteRows('workspaces', 'id', workspaceId)
}

export function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function daysAgo(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date
}
