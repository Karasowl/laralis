import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Permission } from './types'

export async function userHasPermission(
  userId: string,
  clinicId: string,
  permission: Permission
): Promise<boolean> {
  const [resource, action] = permission.split('.')

  const { data, error } = await supabaseAdmin.rpc('check_user_permission', {
    p_user_id: userId,
    p_clinic_id: clinicId,
    p_resource: resource,
    p_action: action,
  })

  if (error) {
    console.error('[permissions] Error checking permission:', error)
    return false
  }

  return Boolean(data)
}

export async function forbiddenIfMissingPermission(
  userId: string,
  clinicId: string,
  permission: Permission
): Promise<NextResponse<any> | null> {
  const allowed = await userHasPermission(userId, clinicId, permission)

  if (allowed) return null

  return NextResponse.json(
    {
      error: 'Forbidden',
      message: `You do not have permission: ${permission}`,
    },
    { status: 403 }
  )
}

export async function forbiddenIfMissingPermissions(
  userId: string,
  clinicId: string,
  permissions: Permission[]
): Promise<NextResponse<any> | null> {
  const results = await Promise.all(
    permissions.map(async (permission) => ({
      permission,
      allowed: await userHasPermission(userId, clinicId, permission),
    }))
  )

  const missing = results
    .filter((result) => !result.allowed)
    .map((result) => result.permission)

  if (missing.length === 0) return null

  return NextResponse.json(
    {
      error: 'Forbidden',
      message: `Missing permissions: ${missing.join(', ')}`,
    },
    { status: 403 }
  )
}
