import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function DELETE() {
  return NextResponse.json(
    {
      error: 'Deprecated account deletion route',
      message: 'Use /api/auth/delete-account with OTP verification.'
    },
    { status: 410 }
  )
}
