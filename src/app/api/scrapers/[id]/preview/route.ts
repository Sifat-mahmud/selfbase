import { NextResponse } from 'next/server'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return NextResponse.json({ id, status: 'preview_started', message: 'Preview scrape has been triggered' })
}
