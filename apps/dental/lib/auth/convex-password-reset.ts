import { createHash, randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export function createConvexPasswordResetToken() {
  return randomBytes(32).toString('base64url')
}

export function hashConvexPasswordResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function authorizeMigrationSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is required' }, { status: 503 })
  }

  const authorization = request.headers.get('authorization')
  const headerSecret = request.headers.get('x-migration-secret')
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null

  if (bearer === secret || headerSecret === secret) {
    return null
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function getRequestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  if (forwardedHost) {
    return `${forwardedProto ?? 'https'}://${forwardedHost}`
  }
  return request.nextUrl.origin
}
