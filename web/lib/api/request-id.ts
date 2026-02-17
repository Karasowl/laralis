import { NextResponse } from 'next/server'

const REQUEST_ID_HEADER = 'x-request-id'

export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getRequestId(request: Request): string {
  const existing = request.headers.get(REQUEST_ID_HEADER)
  return existing || createRequestId()
}

export function attachRequestIdHeader(response: NextResponse, requestId: string): NextResponse {
  response.headers.set(REQUEST_ID_HEADER, requestId)
  return response
}

export { REQUEST_ID_HEADER }
