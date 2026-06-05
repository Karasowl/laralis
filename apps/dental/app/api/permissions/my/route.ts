import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { shouldReturnConvexData } from '@/lib/data-backend';
import { getAuthBackend } from '@/lib/auth/convex-session';
import {
  getConvexDocumentByLegacyId,
  listConvexDocumentsByClinic,
  listConvexDocumentsByWorkspace,
  listConvexTable,
  decodeConvexValue,
} from '@/lib/convex/server';
import type { PermissionMap, WorkspaceRole, ClinicRole } from '@/lib/permissions';

// QA route contract: @qa-self-service-route authenticated current-user permission introspection.
/**
 * GET /api/permissions/my
 *
 * Returns the current user's permissions for the current clinic.
 * Includes workspace role, clinic role, and resolved permission map.
 *
 * Response:
 * {
 *   workspaceRole: 'owner' | 'super_admin' | 'admin' | 'editor' | 'viewer' | null,
 *   clinicRole: 'admin' | 'doctor' | 'assistant' | 'receptionist' | 'viewer' | null,
 *   permissions: { 'patients.view': true, 'expenses.view': false, ... }
 * }
 */
export async function GET() {
  const cookieStore = cookies();
  const context = await resolveClinicContext({ cookieStore });

  if ('error' in context) {
    return NextResponse.json(
      { error: context.error.message },
      { status: context.error.status }
    );
  }

  const { clinicId, userId } = context;

  try {
    // ------------------------------------------------------------------
    // Convex read branch (flag-gated, default Supabase).
    //
    // SECURITY: resolveClinicContext() above already authenticated the user
    // AND resolved the clinic the user has access to (it is the route's
    // membership/authorization guard). The Convex bridge has NO RLS, so we
    // only enter this branch AFTER that guard, and we only ever read data for
    // the SAME (userId, clinicId) pair that resolveClinicContext authorized.
    //
    // This branch replicates the get_user_permissions(p_user_id, p_clinic_id)
    // SQL RPC (migration 76_custom_roles_support.sql, which supersedes the
    // migration 70 definition) EXACTLY, plus the clinics / workspace_users /
    // clinic_users reads the Supabase path performs to build workspaceRole,
    // clinicRole, clinicId and workspaceId. Response shape is byte-identical.
    // ------------------------------------------------------------------
    // Gate mirrors lib/permissions/check.ts so the whole permission subsystem
    // (enforcement guard + self-service routes) flips on the SAME signal: either
    // a full auth cutover (AUTH_BACKEND=convex) or DATA_READ_BACKEND_ROLE_PERMISSIONS.
    if (getAuthBackend() === 'convex' || shouldReturnConvexData('role_permissions')) {
      return await handleConvexRead(userId, clinicId);
    }

    // Get workspace for this clinic
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .select('workspace_id')
      .eq('id', clinicId)
      .single();

    if (clinicError || !clinic) {
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 }
      );
    }

    // Get workspace membership
    const { data: workspaceMember, error: wsError } = await supabaseAdmin
      .from('workspace_users')
      .select('role, custom_permissions, allowed_clinics')
      .eq('workspace_id', clinic.workspace_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (wsError && wsError.code !== 'PGRST116') {
      console.error('[permissions] Error fetching workspace member:', wsError);
    }

    // Get clinic membership (optional, may not exist)
    const { data: clinicMember, error: clinicMemberError } = await supabaseAdmin
      .from('clinic_users')
      .select('role, custom_permissions')
      .eq('clinic_id', clinicId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (clinicMemberError && clinicMemberError.code !== 'PGRST116') {
      console.error('[permissions] Error fetching clinic member:', clinicMemberError);
    }

    const workspaceRole = (workspaceMember?.role || null) as WorkspaceRole | null;
    const clinicRole = (clinicMember?.role || null) as ClinicRole | null;

    // Get resolved permissions from database function
    const { data: permissions, error: permError } = await supabaseAdmin.rpc(
      'get_user_permissions',
      {
        p_user_id: userId,
        p_clinic_id: clinicId,
      }
    );

    if (permError) {
      console.error('[permissions] Error getting permissions:', permError);
      return NextResponse.json(
        { error: 'Failed to get permissions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      workspaceRole,
      clinicRole,
      permissions: (permissions || {}) as PermissionMap,
      clinicId,
      workspaceId: clinic.workspace_id,
    });
  } catch (error) {
    console.error('[permissions] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ====================================================================
// Convex read branch
// ====================================================================

type ConvexRecord = Record<string, any>;

/**
 * Strips the full Convex metadata set so downstream field access mirrors the
 * raw Supabase row shape (canonical normalizeConvexRecord contract).
 */
function normalizeConvexRecord(row: ConvexRecord) {
  const {
    _id,
    _creationTime,
    legacyId,
    legacyTable,
    convex_created_at,
    convex_updated_at,
    convex_snapshot_source,
    ...rest
  } = row;
  return rest;
}

/**
 * Replica of the SQL `||` JSONB concat (right operand overrides existing keys)
 * and `jsonb_object_agg` (last write wins) on a plain object, preserving the
 * exact override precedence get_user_permissions relies on. Source keys are
 * decoded first via decodeConvexValue because Convex stores JSONB object keys
 * encoded ("patients.view" -> "patients_u2e_view"); decoding is a no-op for the
 * already-canonical maps this is also called with.
 */
function mergePermissions(target: PermissionMap, source: Record<string, unknown> | null | undefined): PermissionMap {
  if (!source || typeof source !== 'object') return target;
  const decoded = decodeConvexValue(source) as Record<string, unknown>;
  for (const [key, value] of Object.entries(decoded)) {
    // Mirror Postgres ::BOOLEAN coercion of JSONB values (already booleans here).
    (target as Record<string, unknown>)[key] = Boolean(value);
  }
  return target;
}

async function handleConvexRead(userId: string, clinicId: string) {
  // --- Resolve clinic -> workspace_id (clinics keyed by workspace, no clinic_id) ---
  const clinicDoc = (await getConvexDocumentByLegacyId('clinics', clinicId)) as ConvexRecord | null;
  if (!clinicDoc) {
    return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
  }
  const clinic = normalizeConvexRecord(clinicDoc);
  const workspaceId = clinic.workspace_id != null ? String(clinic.workspace_id) : null;

  // get_user_permissions: IF v_workspace_id IS NULL THEN RETURN '{}'.
  // But the route still needs workspaceId for the response. The Supabase path
  // would have returned 404 here (clinic.workspace_id required to proceed),
  // however .single() on clinics already guaranteed the row. We mirror the
  // RPC: empty map if no workspace_id. workspaceId stays whatever clinic had.
  if (!workspaceId) {
    return NextResponse.json({
      workspaceRole: null as WorkspaceRole | null,
      clinicRole: null as ClinicRole | null,
      permissions: {} as PermissionMap,
      clinicId,
      workspaceId: clinic.workspace_id ?? null,
    });
  }

  // --- Load the membership + permission tables (mirrored, generic helpers) ---
  const [workspaceUsersRaw, clinicUsersRaw, rolePermissionsRaw, customRoleTemplatesRaw] = await Promise.all([
    listConvexDocumentsByWorkspace('workspace_users', workspaceId, 10000) as Promise<ConvexRecord[]>,
    listConvexDocumentsByClinic('clinic_users', clinicId, 10000) as Promise<ConvexRecord[]>,
    listConvexTable('role_permissions', 10000) as Promise<ConvexRecord[]>,
    listConvexTable('custom_role_templates', 10000) as Promise<ConvexRecord[]>,
  ]);

  const rolePermissions = rolePermissionsRaw.map(normalizeConvexRecord);
  const customRoleTemplates = customRoleTemplatesRaw.map(normalizeConvexRecord);

  // SQL: SELECT ... FROM workspace_users WHERE workspace_id = v_workspace_id
  //      AND user_id = p_user_id AND is_active = true  (single row)
  const workspaceMember = workspaceUsersRaw
    .map(normalizeConvexRecord)
    .find(
      (row) =>
        String(row.user_id) === String(userId) &&
        row.is_active === true
    ) ?? null;

  // SQL: SELECT ... FROM clinic_users WHERE clinic_id = p_clinic_id
  //      AND user_id = p_user_id AND is_active = true  (single row)
  const clinicMember = clinicUsersRaw
    .map(normalizeConvexRecord)
    .find(
      (row) =>
        String(row.user_id) === String(userId) &&
        row.is_active === true
    ) ?? null;

  const workspaceRole = (workspaceMember?.role || null) as WorkspaceRole | null;
  const clinicRole = (clinicMember?.role || null) as ClinicRole | null;

  const permissions = computeUserPermissions({
    workspaceMember,
    clinicMember,
    rolePermissions,
    customRoleTemplates,
  });

  return NextResponse.json({
    workspaceRole,
    clinicRole,
    permissions,
    clinicId,
    workspaceId,
  });
}

/**
 * Exact JS replica of get_user_permissions() from migration 76 (which
 * supersedes the migration 70 version). Step-by-step parity with the SQL:
 *
 *  1. workspace_users row -> v_ws_role; NULL role => '{}'.
 *  2. base map:
 *       owner OR super_admin => every role_permissions row => true
 *                               (NO scope filter, matches the SQL).
 *       else                 => role_permissions WHERE role = v_ws_role
 *                               AND scope = 'workspace' (allowed as-is).
 *  3. workspace custom role template (custom_role_id): REPLACES the base map
 *     with base_role's workspace permissions (or '{}' if no base_role), then
 *     overlays template.permissions.
 *  4. overlay workspace custom_permissions (highest workspace priority).
 *  5. clinic_users row -> overlay role_permissions WHERE role = v_clinic_role
 *     AND scope = 'clinic'.
 *  6. clinic custom role template: overlay base_role clinic perms then
 *     template.permissions.
 *  7. overlay clinic custom_permissions (final / highest priority).
 */
function computeUserPermissions(params: {
  workspaceMember: ConvexRecord | null;
  clinicMember: ConvexRecord | null;
  rolePermissions: ConvexRecord[];
  customRoleTemplates: ConvexRecord[];
}): PermissionMap {
  const { workspaceMember, clinicMember, rolePermissions, customRoleTemplates } = params;

  let result: PermissionMap = {};

  // Step 1: workspace role gate. NULL ws role => empty map.
  const wsRole = workspaceMember?.role ?? null;
  if (!wsRole) {
    return result;
  }

  const wsCustomPerms = (workspaceMember?.custom_permissions ?? null) as Record<string, unknown> | null;
  const wsCustomRoleId = workspaceMember?.custom_role_id ?? null;

  // Step 2: base map from workspace role.
  if (wsRole === 'owner' || wsRole === 'super_admin') {
    // SQL: jsonb_object_agg(resource||'.'||action, true) over ALL role_permissions
    // (no scope filter). owner AND super_admin both receive every permission.
    for (const perm of rolePermissions) {
      const key = `${perm.resource}.${perm.action}`;
      (result as Record<string, unknown>)[key] = true;
    }
  } else {
    // SQL: jsonb_object_agg(resource||'.'||action, allowed)
    //      WHERE role = v_ws_role AND scope = 'workspace'
    for (const perm of rolePermissions) {
      if (perm.role === wsRole && perm.scope === 'workspace') {
        const key = `${perm.resource}.${perm.action}`;
        (result as Record<string, unknown>)[key] = Boolean(perm.allowed);
      }
    }
  }

  // Step 3: workspace custom role template (only when custom_role_id present).
  if (wsCustomRoleId != null) {
    const template = customRoleTemplates.find(
      (tpl) =>
        String(tpl.id) === String(wsCustomRoleId) &&
        tpl.scope === 'workspace' &&
        tpl.is_active === true
    ) ?? null;

    const templateBase = template?.base_role ?? null;
    const templatePerms = (template?.permissions ?? null) as Record<string, unknown> | null;

    // SQL: IF base_role IS NOT NULL -> v_result := base_role workspace perms
    //      ELSE v_result := '{}'.  (This REPLACES, not merges.)
    if (templateBase != null) {
      const base: PermissionMap = {};
      for (const perm of rolePermissions) {
        if (perm.role === templateBase && perm.scope === 'workspace') {
          const key = `${perm.resource}.${perm.action}`;
          (base as Record<string, unknown>)[key] = Boolean(perm.allowed);
        }
      }
      result = base;
    } else {
      result = {};
    }

    // SQL: IF template_perms IS NOT NULL THEN v_result := v_result || template_perms
    result = mergePermissions(result, templatePerms);
  }

  // Step 4: workspace custom_permissions overlay.
  result = mergePermissions(result, wsCustomPerms);

  // Step 5: clinic role overlay.
  const clinicRole = clinicMember?.role ?? null;
  if (clinicRole != null) {
    for (const perm of rolePermissions) {
      if (perm.role === clinicRole && perm.scope === 'clinic') {
        const key = `${perm.resource}.${perm.action}`;
        (result as Record<string, unknown>)[key] = Boolean(perm.allowed);
      }
    }
  }

  // Step 6: clinic custom role template overlay.
  const clinicCustomRoleId = clinicMember?.custom_role_id ?? null;
  if (clinicCustomRoleId != null) {
    const template = customRoleTemplates.find(
      (tpl) =>
        String(tpl.id) === String(clinicCustomRoleId) &&
        tpl.scope === 'clinic' &&
        tpl.is_active === true
    ) ?? null;

    const templateBase = template?.base_role ?? null;
    const templatePerms = (template?.permissions ?? null) as Record<string, unknown> | null;

    // SQL: IF base_role IS NOT NULL THEN v_result := v_result || base_role clinic perms
    //      (overlay, NOT replace, unlike the workspace template branch).
    if (templateBase != null) {
      const base: PermissionMap = {};
      for (const perm of rolePermissions) {
        if (perm.role === templateBase && perm.scope === 'clinic') {
          const key = `${perm.resource}.${perm.action}`;
          (base as Record<string, unknown>)[key] = Boolean(perm.allowed);
        }
      }
      result = mergePermissions(result, base);
    }

    result = mergePermissions(result, templatePerms);
  }

  // Step 7: clinic custom_permissions overlay (final priority).
  const clinicCustomPerms = (clinicMember?.custom_permissions ?? null) as Record<string, unknown> | null;
  result = mergePermissions(result, clinicCustomPerms);

  return result;
}
