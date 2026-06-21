import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    return NextResponse.json({
      status: 'embedding_started',
      tableId: body.tableId,
      message: 'Embedding generation has been queued',
    })
  } catch {
    return NextResponse.json({ error: 'Failed to start embedding' }, { status: 500 })
  }
}
