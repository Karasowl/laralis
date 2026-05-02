import { NextResponse } from 'next/server'
import { createRouteLogger } from './logger'
import { getRequestId, attachRequestIdHeader } from './request-id'
import { internalServerError } from './response'
import type { RouteHandlerContext } from './types'

type Handler<T extends Request = Request> = (
  context: RouteHandlerContext & { request: T }
) => Promise<NextResponse>

export async function withRouteContext<T extends Request = Request>(
  request: T,
  handler: Handler<T>
): Promise<NextResponse> {
  const requestId = getRequestId(request)
  const logger = createRouteLogger(requestId)
  const startedAt = Date.now()

  try {
    const response = await handler({ request, requestId, startedAt })
    return attachRequestIdHeader(response, requestId)
  } catch (error) {
    logger.error('route.unhandled_error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return internalServerError('Unhandled route error', undefined, requestId)
  } finally {
    logger.debug('route.completed', { durationMs: Date.now() - startedAt })
  }
}
