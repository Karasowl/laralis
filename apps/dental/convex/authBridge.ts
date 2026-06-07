import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

type ImportedDocument = Record<string, any>

function assertBridgeSecret(secret: string) {
  const expected = process.env.CONVEX_AUTH_BRIDGE_SECRET
  if (!expected || secret !== expected) {
    throw new Error('Unauthorized auth bridge request')
  }
}

export const upsertPasswordCredential = mutation({
  args: {
    secret: v.string(),
    supabaseUserId: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    passwordSalt: v.string(),
    algorithm: v.string(),
    userMetadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    assertBridgeSecret(args.secret)

    const email = args.email.trim().toLowerCase()
    const existing = await ctx.db
      .query('auth_password_credentials' as any)
      .filter((q) => q.eq(q.field('email'), email))
      .first()

    const now = new Date().toISOString()
    const document = {
      supabaseUserId: args.supabaseUserId,
      email,
      passwordHash: args.passwordHash,
      passwordSalt: args.passwordSalt,
      algorithm: args.algorithm,
      userMetadata: args.userMetadata ?? {},
      updatedAt: now,
    }

    if (existing) {
      await ctx.db.patch(existing._id, document)
      return { id: existing._id, updated: true }
    }

    const id = await ctx.db.insert('auth_password_credentials' as any, {
      ...document,
      createdAt: now,
    })
    return { id, updated: false }
  },
})

export const createPasswordResetToken = mutation({
  args: {
    secret: v.string(),
    email: v.string(),
    tokenHash: v.string(),
    expiresAt: v.string(),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertBridgeSecret(args.secret)

    const email = args.email.trim().toLowerCase()
    const user = await findAuthUserByEmail(ctx, email)
    if (!user) {
      throw new Error('No migrated auth user exists for this email')
    }

    const existing = await ctx.db
      .query('auth_password_reset_tokens' as any)
      .filter((q) => q.eq(q.field('tokenHash'), args.tokenHash))
      .first()

    if (existing) {
      throw new Error('Password reset token already exists')
    }

    const now = new Date().toISOString()
    const id = await ctx.db.insert('auth_password_reset_tokens' as any, {
      tokenHash: args.tokenHash,
      supabaseUserId: String(user.id ?? user.legacyId),
      email,
      expiresAt: args.expiresAt,
      createdAt: now,
      createdBy: args.createdBy ?? 'migration',
      usedAt: null,
    })

    return {
      id,
      email,
      supabaseUserId: String(user.id ?? user.legacyId),
      expiresAt: args.expiresAt,
    }
  },
})

export const verifyPasswordResetToken = query({
  args: {
    secret: v.string(),
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    assertBridgeSecret(args.secret)
    const token = await getUsablePasswordResetToken(ctx, args.tokenHash)
    if (!token) return { ok: false }

    return {
      ok: true,
      email: token.email,
      expiresAt: token.expiresAt,
    }
  },
})

export const consumePasswordResetToken = mutation({
  args: {
    secret: v.string(),
    tokenHash: v.string(),
    passwordHash: v.string(),
    passwordSalt: v.string(),
    algorithm: v.string(),
  },
  handler: async (ctx, args) => {
    assertBridgeSecret(args.secret)
    const token = await getUsablePasswordResetToken(ctx, args.tokenHash)
    if (!token) {
      throw new Error('Invalid or expired password reset token')
    }

    const user = await findAuthUserByEmail(ctx, token.email)
    if (!user) {
      throw new Error('Migrated auth user no longer exists')
    }

    const credential = await upsertPasswordCredentialForUser(ctx, {
      supabaseUserId: String(user.id ?? user.legacyId ?? token.supabaseUserId),
      email: token.email,
      passwordHash: args.passwordHash,
      passwordSalt: args.passwordSalt,
      algorithm: args.algorithm,
      userMetadata: readUserMetadata(user),
    })

    await ctx.db.patch(token._id, {
      usedAt: new Date().toISOString(),
    } as any)

    return {
      ...credential,
      supabaseUserId: String(user.id ?? user.legacyId ?? token.supabaseUserId),
      email: token.email,
      userMetadata: readUserMetadata(user),
    }
  },
})

export const credentialByEmail = query({
  args: {
    secret: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    assertBridgeSecret(args.secret)
    const email = args.email.trim().toLowerCase()

    return await ctx.db
      .query('auth_password_credentials' as any)
      .filter((q) => q.eq(q.field('email'), email))
      .first()
  },
})

export const credentialStats = query({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertBridgeSecret(args.secret)
    const credentials = await ctx.db.query('auth_password_credentials' as any).collect()
    const users = await ctx.db.query('supabase_auth_users' as any).collect()

    return {
      passwordCredentials: credentials.length,
      migratedAuthUsers: users.length,
      readyForConvexPasswordLogin: users.length > 0 && credentials.length >= users.length,
    }
  },
})

export const contextForUser = query({
  args: {
    secret: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    assertBridgeSecret(args.secret)
    return getAuthContextForUser(ctx, args.userId)
  },
})

/**
 * Exact JS replica of the SQL check_user_permission RPC (migration 76).
 *
 * Precedence (matching the SQL exactly):
 *   1. clinic.workspace_id NULL -> false
 *   2. no active workspace_users row -> false
 *   3. ws role 'owner' -> true
 *   4. ws role 'super_admin' -> true, except workspace.delete / transfer_ownership
 *   5. allowed_clinics non-empty and clinic not in it -> false
 *   6. workspace custom_permissions[key] -> return it (early)
 *   7. compute ws decision: custom_role template (perms key, else base_role
 *      role_permissions scope=workspace), else ws role role_permissions
 *   8. clinic custom_permissions[key] -> return it (early)
 *   9. compute clinic decision: custom_role template (perms key, else base_role
 *      role_permissions scope=clinic), else clinic role role_permissions
 *   10. clinic decision (incl. explicit false) wins over workspace decision
 *   11. else false
 *
 * Self-contained (does not reuse getAuthContextForUser) so the per-table reads
 * mirror the SQL exactly. custom_permissions / template.permissions JSONB keys
 * were encoded on write by encodeConvexFieldName, so we encode the permission
 * key before looking it up.
 */
export const userHasPermission = query({
  args: {
    secret: v.string(),
    userId: v.string(),
    clinicId: v.string(),
    permission: v.string(),
  },
  handler: async (ctx, args) => {
    assertBridgeSecret(args.secret)
    const [resource, action] = args.permission.split('.')
    if (!resource || !action) return false
    const permKey = `${resource}.${action}`
    const encodedPermKey = encodeConvexFieldName(permKey)

    const [clinics, workspaceUsers, clinicUsers, rolePermissions, customRoleTemplates] =
      (await Promise.all([
        ctx.db.query('clinics' as any).collect(),
        ctx.db.query('workspace_users' as any).collect(),
        ctx.db.query('clinic_users' as any).collect(),
        ctx.db.query('role_permissions' as any).collect(),
        ctx.db.query('custom_role_templates' as any).collect(),
      ])) as ImportedDocument[][]

    const clinic = clinics.find((row) => row.id === args.clinicId || row.legacyId === args.clinicId)
    if (!clinic?.workspace_id) return false
    const workspaceId = String(clinic.workspace_id)
    const clinicLegacyId = String(clinic.id ?? clinic.legacyId)

    // 2. active workspace_users membership (SQL: is_active = true, strict)
    const ws = workspaceUsers.find((m) =>
      String(m.workspace_id) === workspaceId && m.user_id === args.userId && m.is_active === true)
    if (!ws) return false

    // 3-4. owner / super_admin
    if (ws.role === 'owner') return true
    if (ws.role === 'super_admin') {
      return !(permKey === 'workspace.delete' || permKey === 'workspace.transfer_ownership')
    }

    // 5. allowed_clinics restriction
    const allowedClinics = Array.isArray(ws.allowed_clinics) ? ws.allowed_clinics.map(String) : []
    if (allowedClinics.length > 0 && !allowedClinics.includes(clinicLegacyId)) {
      return false
    }

    // 6. workspace explicit override (short-circuits before clinic)
    const wsOverride = jsonbBool(ws.custom_permissions, encodedPermKey)
    if (wsOverride !== null) return wsOverride

    // 7. workspace decision (template or base role)
    let wsAllowed: boolean | null = null
    if (ws.custom_role_id) {
      const tpl = customRoleTemplates.find((t) =>
        (t.id === ws.custom_role_id || t.legacyId === ws.custom_role_id) && t.scope === 'workspace' && t.is_active === true)
      if (tpl) {
        const tplBool = jsonbBool(tpl.permissions, encodedPermKey)
        if (tplBool !== null) wsAllowed = tplBool
        else if (tpl.base_role) wsAllowed = roleDecision(rolePermissions, tpl.base_role, 'workspace', resource, action)
      }
      // template missing -> wsAllowed stays null (matches SQL: no base fallback)
    } else {
      wsAllowed = roleDecision(rolePermissions, ws.role, 'workspace', resource, action)
    }

    // 8. clinic membership + explicit override (SQL: is_active = true, strict)
    const cu = clinicUsers.find((m) =>
      String(m.clinic_id) === clinicLegacyId && m.user_id === args.userId && m.is_active === true)
    if (cu) {
      const cuOverride = jsonbBool(cu.custom_permissions, encodedPermKey)
      if (cuOverride !== null) return cuOverride
    }

    // 9. clinic decision (template or base role)
    let clinicAllowed: boolean | null = null
    if (cu?.custom_role_id) {
      const tpl = customRoleTemplates.find((t) =>
        (t.id === cu.custom_role_id || t.legacyId === cu.custom_role_id) && t.scope === 'clinic' && t.is_active === true)
      if (tpl) {
        const tplBool = jsonbBool(tpl.permissions, encodedPermKey)
        if (tplBool !== null) clinicAllowed = tplBool
        else if (tpl.base_role) clinicAllowed = roleDecision(rolePermissions, tpl.base_role, 'clinic', resource, action)
      }
    } else if (cu?.role) {
      clinicAllowed = roleDecision(rolePermissions, cu.role, 'clinic', resource, action)
    }

    // 10-11. clinic decision (incl. explicit false) wins over workspace; else false
    if (clinicAllowed !== null) return clinicAllowed
    if (wsAllowed !== null) return wsAllowed
    return false
  },
})

/**
 * Exact JS replica of the SQL is_clinic_member / user_has_clinic_access RPC
 * (migration 72_fix_rls_clinic_memberships). Access iff:
 *   1. active clinic_users row for (clinic, user), OR
 *   2. active workspace_users row for the clinic's workspace, with the clinic
 *      passing the allowed_clinics restriction (empty/null array = all clinics).
 */
export const userHasClinicAccess = query({
  args: {
    secret: v.string(),
    userId: v.string(),
    clinicId: v.string(),
  },
  handler: async (ctx, args) => {
    assertBridgeSecret(args.secret)

    const [clinics, clinicUsers, workspaceUsers] = (await Promise.all([
      ctx.db.query('clinics' as any).collect(),
      ctx.db.query('clinic_users' as any).collect(),
      ctx.db.query('workspace_users' as any).collect(),
    ])) as ImportedDocument[][]

    const clinic = clinics.find((row) => row.id === args.clinicId || row.legacyId === args.clinicId)
    if (!clinic) return false
    const clinicLegacyId = String(clinic.id ?? clinic.legacyId)
    const workspaceId = clinic.workspace_id != null ? String(clinic.workspace_id) : null

    // 1. direct clinic_users membership (is_active = true, strict)
    const directMember = clinicUsers.some(
      (m) => String(m.clinic_id) === clinicLegacyId && m.user_id === args.userId && m.is_active === true
    )
    if (directMember) return true

    // 2. via workspace_users, honoring allowed_clinics ('{}' / NULL = all)
    if (workspaceId) {
      const viaWorkspace = workspaceUsers.some((wu) => {
        if (String(wu.workspace_id) !== workspaceId || wu.user_id !== args.userId || wu.is_active !== true) {
          return false
        }
        const allowed = Array.isArray(wu.allowed_clinics) ? wu.allowed_clinics.map(String) : []
        return allowed.length === 0 || allowed.includes(clinicLegacyId)
      })
      if (viaWorkspace) return true
    }

    return false
  },
})

async function getAuthContextForUser(ctx: any, userId: string) {
  const [users, workspaces, workspaceUsers, workspaceMembers, clinicUsers, clinics, rolePermissions] =
    (await Promise.all([
      ctx.db.query('supabase_auth_users' as any).collect(),
      ctx.db.query('workspaces' as any).collect(),
      ctx.db.query('workspace_users' as any).collect(),
      ctx.db.query('workspace_members' as any).collect(),
      ctx.db.query('clinic_users' as any).collect(),
      ctx.db.query('clinics' as any).collect(),
      ctx.db.query('role_permissions' as any).collect(),
    ])) as ImportedDocument[][]

  const user = users.find((row) => row.id === userId || row.legacyId === userId) ?? null
  const ownedWorkspaces = workspaces.filter((workspace) => workspace.owner_id === userId)
  const activeWorkspaceUsers = workspaceUsers.filter((membership) => {
    return membership.user_id === userId && membership.is_active !== false
  })
  const activeWorkspaceMembers = workspaceMembers.filter((membership) => {
    return membership.user_id === userId && membership.is_active !== false
  })
  const activeClinicUsers = clinicUsers.filter((membership) => {
    return membership.user_id === userId && membership.is_active !== false
  })

  const workspaceIds = new Set<string>()
  for (const workspace of ownedWorkspaces) workspaceIds.add(String(workspace.id))
  for (const membership of activeWorkspaceUsers) workspaceIds.add(String(membership.workspace_id))
  for (const membership of activeWorkspaceMembers) workspaceIds.add(String(membership.workspace_id))

  const clinicIds = new Set<string>(activeClinicUsers.map((membership) => String(membership.clinic_id)))
  const accessibleClinics = clinics.filter((clinic) => {
    return workspaceIds.has(String(clinic.workspace_id)) || clinicIds.has(String(clinic.id))
  })

  const defaultWorkspace = ownedWorkspaces[0] ??
    workspaces.find((workspace) => workspaceIds.has(String(workspace.id))) ??
    null
  const defaultClinic = accessibleClinics[0] ?? null

  return {
    user,
    workspaces: ownedWorkspaces,
    workspaceUsers: activeWorkspaceUsers,
    workspaceMembers: activeWorkspaceMembers,
    clinicUsers: activeClinicUsers,
    clinics: accessibleClinics,
    rolePermissions,
    defaultWorkspace,
    defaultClinic,
  }
}

/**
 * Replica of encodeConvexFieldName in lib/convex/legacy.ts. JSONB object keys
 * (custom_permissions, template.permissions) were encoded on write the same way,
 * so a permission key like "patients.view" must be encoded ("." -> "_u2e_")
 * before looking it up in those maps.
 */
function encodeConvexFieldName(key: string) {
  let encoded = ''
  for (const char of key) {
    encoded += /[A-Za-z0-9_]/.test(char) ? char : `_u${char.codePointAt(0)?.toString(16)}_`
  }
  if (!encoded) encoded = '_empty'
  if (encoded === '_id' || encoded === '_creationTime') encoded = `legacy${encoded}`
  return encoded
}

/**
 * Reads a tri-state boolean out of an encoded JSONB permission map.
 * Returns null when the key is absent (so the caller can fall through to the
 * next precedence level), true/false when the key is present. Mirrors the SQL
 * `(perms ->> key)::boolean` plus the "key not present" short-circuit.
 */
function jsonbBool(obj: any, encodedKey: string): boolean | null {
  if (!obj || typeof obj !== 'object') return null
  if (!(encodedKey in obj)) return null
  const value = obj[encodedKey]
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value === 'true' || value === 't'
  if (value === null || value === undefined) return null
  return Boolean(value)
}

/**
 * Resolves a role_permissions row to a tri-state decision.
 * Returns null when no matching (role, scope, resource, action) row exists
 * (so the caller can fall through), otherwise the row's `allowed` flag.
 * Mirrors the SQL lookup against role_permissions with an explicit scope.
 */
function roleDecision(
  rolePermissions: ImportedDocument[],
  role: string | null | undefined,
  scope: string,
  resource: string,
  action: string
): boolean | null {
  if (!role) return null
  const row = rolePermissions.find(
    (permission) =>
      permission.role === role &&
      permission.scope === scope &&
      permission.resource === resource &&
      permission.action === action
  )
  if (!row) return null
  return row.allowed === true || row.allowed === 'true'
}

async function upsertPasswordCredentialForUser(
  ctx: any,
  args: {
    supabaseUserId: string
    email: string
    passwordHash: string
    passwordSalt: string
    algorithm: string
    userMetadata?: any
  }
) {
  const email = args.email.trim().toLowerCase()
  const existing = await ctx.db
    .query('auth_password_credentials' as any)
    .filter((q) => q.eq(q.field('email'), email))
    .first()

  const now = new Date().toISOString()
  const document = {
    supabaseUserId: args.supabaseUserId,
    email,
    passwordHash: args.passwordHash,
    passwordSalt: args.passwordSalt,
    algorithm: args.algorithm,
    userMetadata: args.userMetadata ?? {},
    updatedAt: now,
  }

  if (existing) {
    await ctx.db.patch(existing._id, document)
    return { id: existing._id, updated: true }
  }

  const id = await ctx.db.insert('auth_password_credentials' as any, {
    ...document,
    createdAt: now,
  })
  return { id, updated: false }
}

async function findAuthUserByEmail(ctx: any, email: string) {
  const users = (await ctx.db.query('supabase_auth_users' as any).collect()) as ImportedDocument[]
  return users.find((user) => readUserEmail(user) === email) ?? null
}

async function getUsablePasswordResetToken(ctx: any, tokenHash: string) {
  const token = await ctx.db
    .query('auth_password_reset_tokens' as any)
    .filter((q) => q.eq(q.field('tokenHash'), tokenHash))
    .first()

  if (!token || token.usedAt) return null
  if (!token.expiresAt || new Date(token.expiresAt).getTime() <= Date.now()) return null
  return token
}

function readUserEmail(user: ImportedDocument) {
  return String(user.email ?? user.user_metadata?.email ?? '').trim().toLowerCase()
}

function readUserMetadata(user: ImportedDocument) {
  const metadata = user.user_metadata ?? user.raw_user_meta_data ?? {}
  return metadata && typeof metadata === 'object' ? metadata : {}
}
