import { describe, expect, it } from 'vitest'
import { extractConvexAuthUserId } from './server'

function unsignedToken(payload: Record<string, unknown>) {
  return [
    Buffer.from('{}').toString('base64url'),
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    'signature-verified-by-convex-query',
  ].join('.')
}

describe('extractConvexAuthUserId', () => {
  it('maps a native Convex Auth subject to its application user id', () => {
    const token = unsignedToken({ sub: 'convex-user-id|convex-session-id' })

    expect(extractConvexAuthUserId(token)).toBe('convex-user-id')
  })

  it('rejects malformed token payloads', () => {
    expect(extractConvexAuthUserId('not-a-jwt')).toBeNull()
    expect(extractConvexAuthUserId(unsignedToken({ sub: 123 }))).toBeNull()
  })
})
