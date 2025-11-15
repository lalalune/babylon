import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  _ctx: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    { error: 'Signal endpoint is not available.' },
    { status: 410 }
  )
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  return GET(req, ctx)
}

