import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface FunctionItem {
  name: string; description?: string | null; code?: string; runtime?: string
  triggerType?: string; triggerConfig?: Record<string, unknown>
  envVars?: Record<string, unknown>; timeoutMs?: number; memoryMb?: number
  isActive?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const items: FunctionItem[] = body.items || []
    const mode: 'append' | 'replace' = body.mode || 'append'
    let imported = 0, skipped = 0
    const errors: string[] = []

    for (const item of items) {
      try {
        if (!item.name) { errors.push('Function item missing "name" field'); continue }
        const existing = await db.sbFunction.findFirst({ where: { name: item.name } })
        if (existing) {
          if (mode === 'append') { skipped++; continue }
          await db.sbFunction.delete({ where: { id: existing.id } })
        }

        await db.sbFunction.create({
          data: {
            name: item.name,
            description: item.description || null,
            code: item.code || '// Your function code here\nmodule.exports.handler = async (input) => { return { ok: true }; }',
            runtime: item.runtime || 'javascript',
            triggerType: item.triggerType || 'http',
            triggerConfig: JSON.stringify(item.triggerConfig || {}),
            envVars: JSON.stringify(item.envVars || {}),
            timeoutMs: item.timeoutMs || 30000,
            memoryMb: item.memoryMb || 128,
            isActive: item.isActive !== undefined ? item.isActive : true,
          },
        })
        imported++
      } catch (err) {
        errors.push(`Function "${item.name}": ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return NextResponse.json({ imported, skipped, errors })
  } catch (err) {
    console.error('[API] Failed to import functions:', err)
    return NextResponse.json({ error: 'Failed to import functions' }, { status: 500 })
  }
}
