import { NextResponse } from 'next/server'
import { ZodError, type ZodSchema } from 'zod'

type ValidationResult<T> = { data: T } | { error: NextResponse }

const formatZodError = (error: ZodError) => {
  return {
    message: error.errors.map((err) => err.message).join(', '),
    details: error.flatten(),
  }
}

export async function readJson(request: Request): Promise<ValidationResult<unknown>> {
  try {
    const data = await request.json()
    return { data }
  } catch (error) {
    return {
      error: NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      ),
    }
  }
}

export function validateSchema<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  errorLabel = 'Invalid payload'
): ValidationResult<T> {
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return {
      error: NextResponse.json(
        {
          error: errorLabel,
          message: formatted.message,
          details: formatted.details,
        },
        { status: 400 }
      ),
    }
  }
  return { data: parsed.data }
}
