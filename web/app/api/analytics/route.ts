import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'


export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    // Basic validation
    if (!body || typeof body.event !== 'string') {
      return NextResponse.json({ error: 'invalid' }, { status: 400 })
    }
    // For now, just log to server console. Later this could write to a table or external sink.
    console.log('[analytics]', body)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    console.error('analytics POST error', e)
    return new NextResponse(null, { status: 204 })
  }
}

