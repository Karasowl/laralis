import { NextRequest } from 'next/server'
import {
  createMockPushNotificationService,
  pushNotificationService,
  type PushNotificationService,
} from '@/lib/push/service'

const STAGE_SUPABASE_REF = 'kafbqdliromcveojtdar'

export function isQaNotificationMockRequest(request: NextRequest): boolean {
  return (
    request.headers.get('x-laralis-qa-notifications') === 'mock' &&
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').includes(STAGE_SUPABASE_REF)
  )
}

export function isQaNotificationControlledRequest(request: NextRequest): boolean {
  const mode = request.headers.get('x-laralis-qa-notifications')
  return (
    (mode === 'mock' || mode === 'fail') &&
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').includes(STAGE_SUPABASE_REF)
  )
}

export function getPushNotificationServiceForRequest(request: NextRequest): PushNotificationService {
  return isQaNotificationControlledRequest(request)
    ? createMockPushNotificationService()
    : pushNotificationService
}
