import type { DbAccessPolicy } from './types'

const ADMIN_PATH_SEGMENTS = ['/api/cron/', '/api/public/', '/api/whatsapp/webhook']

export function resolveDbAccessPolicy(pathname: string): DbAccessPolicy {
  const normalized = pathname.toLowerCase()
  if (ADMIN_PATH_SEGMENTS.some((segment) => normalized.includes(segment))) {
    return 'admin'
  }
  return 'rls'
}
