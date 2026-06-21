import { NextResponse } from 'next/server'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return NextResponse.json({ id, status: 'run_started', message: 'Scrape run has been triggered' })
}
