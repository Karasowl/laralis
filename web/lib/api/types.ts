export interface ApiErrorEnvelope {
  error: string
  message?: string
  details?: unknown
  requestId?: string
}

export interface ApiSuccessEnvelope<T = unknown> {
  data: T
  message?: string
  requestId?: string
}

export type ValidatedBody<T> = {
  data: T
}

export interface RouteHandlerContext {
  request: Request
  requestId: string
  startedAt: number
}

export type DbAccessPolicy = 'rls' | 'admin'
