import { NextRequest } from 'next/server'
import {
  createMockPushNotificationService,
  pushNotificationService,
  type PushNotificationService,
} from '@/lib/push/service'

const STAGE_SUPABASE_REF = 'kafbqdliromcveojtdar'

export type QaNotificationMode = 'mock' | 'fail' | null

export function getQaNotificationMode(request: NextRequest): QaNotificationMode {
  const mode = request.headers.get('x-laralis-qa-notifications')
  const isStage = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').includes(STAGE_SUPABASE_REF)
  if (!isStage) return null
  return mode === 'mock' || mode === 'fail' ? mode : null
}

export function isQaNotificationMockRequest(request: NextRequest): boolean {
  return getQaNotificationMode(request) === 'mock'
}

export function isQaNotificationControlledRequest(request: NextRequest): boolean {
  return getQaNotificationMode(request) !== null
}

export function getPushNotificationServiceForRequest(request: NextRequest): PushNotificationService {
  return isQaNotificationControlledRequest(request)
    ? createMockPushNotificationService()
    : pushNotificationService
}
