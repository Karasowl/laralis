import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { deleteClinicData } from '@/lib/clinic-tables'

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
