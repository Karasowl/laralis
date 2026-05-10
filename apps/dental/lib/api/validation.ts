import type { NextResponse } from 'next/server'
import type { ZodSchema } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'
import type { ValidatedBody } from './types'

type ValidationResult<T> = { data: T } | { error: NextResponse }

export async function readJsonBody<T = unknown>(request: Request): Promise<ValidationResult<T>> {
  const result = await readJson(request)
  if ('error' in result) return result
  return { data: result.data as T }
}

export function parseWithSchema<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  errorLabel = 'Invalid payload'
): ValidationResult<T> {
  return validateSchema(schema, payload, errorLabel)
}

export type { ValidatedBody }
