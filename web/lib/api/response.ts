import { NextResponse } from 'next/server'
import { attachRequestIdHeader } from './request-id'
import type { ApiErrorEnvelope, ApiSuccessEnvelope } from './types'

function withRequestId(response: NextResponse, requestId?: string): NextResponse {
  if (!requestId) return response
  return attachRequestIdHeader(response, requestId)
}

export function ok<T>(data: T, requestId?: string): NextResponse {
  const body: ApiSuccessEnvelope<T> = requestId ? { data, requestId } : { data }
  return withRequestId(NextResponse.json(body), requestId)
}

export function created<T>(data: T, requestId?: string): NextResponse {
  const body: ApiSuccessEnvelope<T> = requestId ? { data, requestId } : { data }
  return withRequestId(NextResponse.json(body, { status: 201 }), requestId)
}

export function apiError(
  status: number,
  error: string,
  message?: string,
  details?: unknown,
  requestId?: string
): NextResponse {
  const body: ApiErrorEnvelope = { error }
  if (message) body.message = message
  if (details !== undefined) body.details = details
  if (requestId) body.requestId = requestId
  return withRequestId(NextResponse.json(body, { status }), requestId)
}

export function badRequest(error: string, message?: string, details?: unknown, requestId?: string) {
  return apiError(400, error, message, details, requestId)
}

export function unauthorized(error = 'Unauthorized', message?: string, requestId?: string) {
  return apiError(401, error, message, undefined, requestId)
}

export function forbidden(error = 'Forbidden', message?: string, requestId?: string) {
  return apiError(403, error, message, undefined, requestId)
}

export function notFound(error = 'Not found', message?: string, requestId?: string) {
  return apiError(404, error, message, undefined, requestId)
}

export function conflict(error: string, message?: string, details?: unknown, requestId?: string) {
  return apiError(409, error, message, details, requestId)
}

export function internalServerError(
  message = 'Internal server error',
  details?: unknown,
  requestId?: string
) {
  return apiError(500, 'Internal server error', message, details, requestId)
}
