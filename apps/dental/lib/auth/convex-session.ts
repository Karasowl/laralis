export const CONVEX_SESSION_COOKIE_NAME = 'laralis_convex_session'

export type ConvexSessionPayload = {
  sub: string
  email: string
  userMetadata?: Record<string, unknown>
  workspaceId?: string | null
  clinicId?: string | null
  iat: number
  exp: number
}

type CookieReader = {
  get(name: string): { value?: string } | undefined
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export async function createConvexSessionToken(
  payload: Omit<ConvexSessionPayload, 'iat' | 'exp'> & { iat?: number; exp?: number },
  secret: string,
  maxAgeSeconds = 60 * 60 * 24 * 30
) {
  const now = Math.floor(Date.now() / 1000)
  const fullPayload: ConvexSessionPayload = {
    ...payload,
    iat: payload.iat ?? now,
    exp: payload.exp ?? now + maxAgeSeconds,
  }
  const payloadPart = encodeBase64Url(encoder.encode(JSON.stringify(fullPayload)))
  const signaturePart = encodeBase64Url(await hmacSha256(secret, payloadPart))
  return `${payloadPart}.${signaturePart}`
}

export async function verifyConvexSessionToken(token: string | undefined | null, secret: string | undefined) {
  if (!token || !secret) return null

  const [payloadPart, signaturePart] = token.split('.')
  if (!payloadPart || !signaturePart) return null

  const expectedSignature = encodeBase64Url(await hmacSha256(secret, payloadPart))
  if (!constantTimeEqual(signaturePart, expectedSignature)) return null

  const payload = JSON.parse(decoder.decode(decodeBase64Url(payloadPart))) as ConvexSessionPayload
  if (!payload.sub || !payload.email || !payload.exp) return null

  const now = Math.floor(Date.now() / 1000)
  if (payload.exp <= now) return null

  return payload
}

export async function getConvexSessionFromCookieStore(cookieStore: CookieReader) {
  return verifyConvexSessionToken(
    cookieStore.get(CONVEX_SESSION_COOKIE_NAME)?.value,
    process.env.CONVEX_AUTH_SESSION_SECRET
  )
}

export function getAuthBackend() {
  const value = process.env.AUTH_BACKEND ?? process.env.NEXT_PUBLIC_AUTH_BACKEND ?? 'supabase'
  return value === 'convex' || value === 'dual' ? value : 'supabase'
}

export function isConvexAuthEnabled() {
  return getAuthBackend() === 'convex' || getAuthBackend() === 'dual'
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const end = Math.min(index + chunkSize, bytes.length)
    for (let chunkIndex = index; chunkIndex < end; chunkIndex += 1) {
      binary += String.fromCharCode(bytes[chunkIndex])
    }
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function hmacSha256(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false

  let result = 0
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return result === 0
}
