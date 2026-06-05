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
    })

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

    const context = await getAuthContextForUser(ctx, args.userId)
    const clinic = context.clinics.find((row) => row.id === args.clinicId || row.legacyId === args.clinicId)
    if (!clinic?.workspace_id) return false

    const workspaceId = String(clinic.workspace_id)
    if (context.workspaces.some((workspace) => workspace.id === workspaceId && workspace.owner_id === args.userId)) {
      return true
    }

    const directClinicMembership = context.clinicUsers.find((membership) => {
      return membership.clinic_id === args.clinicId && membership.user_id === args.userId && membership.is_active !== false
    })
    if (directClinicMembership && roleAllows(context.rolePermissions, directClinicMembership.role, resource, action)) {
      return true
    }

    const workspaceMembership = [...context.workspaceUsers, ...context.workspaceMembers].find((membership) => {
      return membership.workspace_id === workspaceId && membership.user_id === args.userId && membership.is_active !== false
    })
    if (!workspaceMembership) return false
    if (workspaceMembership.role === 'owner') return true

    return roleAllows(context.rolePermissions, workspaceMembership.role, resource, action)
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

function roleAllows(rolePermissions: ImportedDocument[], role: string | null | undefined, resource: string, action: string) {
  if (!role) return false
  return rolePermissions.some((permission) => {
    return (
      permission.role === role &&
      permission.resource === resource &&
      permission.action === action &&
      permission.allowed === true
    )
  })
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
