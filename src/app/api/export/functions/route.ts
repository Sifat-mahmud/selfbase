import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const functions = await db.sbFunction.findMany({ orderBy: { createdAt: 'desc' } })

    const items = functions.map(f => ({
      name: f.name,
      description: f.description,
      code: f.code,
      runtime: f.runtime,
      triggerType: f.triggerType,
      triggerConfig: (() => { try { return JSON.parse(f.triggerConfig || '{}') } catch { return {} } })(),
      envVars: (() => { try { return JSON.parse(f.envVars || '{}') } catch { return {} } })(),
      timeoutMs: f.timeoutMs,
      memoryMb: f.memoryMb,
      isActive: f.isActive,
    }))

    return NextResponse.json({
      selfbase_format: '1.0',
      type: 'functions',
      exported_at: new Date().toISOString(),
      items,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to export functions' }, { status: 500 })
  }
}
