import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // In production, this would call the actual LLM provider
    return NextResponse.json({
      response: `This is a simulated response. In production, this would call the configured LLM provider with your prompt.`,
      model: body.model || 'gpt-4o',
      tokens: { prompt: 50, completion: 30, total: 80 },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to process chat' }, { status: 500 })
  }
}
