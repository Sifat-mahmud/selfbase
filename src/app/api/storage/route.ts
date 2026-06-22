import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serverErrorResponse } from '@/lib/api-utils'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const STORAGE_ROOT = '/home/z/my-project/storage'

// GET /api/storage - list all storage files
export async function GET() {
  try {
    const files = await db.storageFile.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(files)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch storage files' }, { status: 500 })
  }
}

// POST /api/storage - upload a file (multipart/form-data or JSON)
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      const name = (formData.get('name') as string | null) || file?.name || `file-${Date.now()}`
      const originalName = (formData.get('originalName') as string | null) || file?.name || name
      const bucket = (formData.get('bucket') as string | null) || 'default'
      const path = (formData.get('path') as string | null) || `/${bucket}/${name}`
      const mimeType = (formData.get('mimeType') as string | null) || file?.type || 'application/octet-stream'
      const sizeBytes = Number(formData.get('sizeBytes') ?? file?.size ?? 0)
      const isPublicRaw = formData.get('isPublic')
      const isPublic = isPublicRaw === 'true' || isPublicRaw === true

      // Persist file to disk if present
      if (file) {
        const dir = join(STORAGE_ROOT, bucket)
        if (!existsSync(dir)) {
          try { mkdirSync(dir, { recursive: true }) } catch { /* ignore */ }
        }
        const buffer = Buffer.from(await file.arrayBuffer())
        try {
          writeFileSync(join(dir, name), buffer)
        } catch {
          // Non-fatal — we still record the metadata
        }
      }

      const created = await db.storageFile.create({
        data: {
          name,
          originalName,
          path,
          bucket,
          mimeType,
          sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : 0,
          isPublic,
        },
      })
      return NextResponse.json(created, { status: 201 })
    }

    // JSON body fallback (metadata-only upload)
    const body = await req.json()
    const data: Record<string, unknown> = { ...body }
    if (typeof data.isPublic === 'string') data.isPublic = data.isPublic === 'true'
    if (typeof data.sizeBytes === 'string') data.sizeBytes = Number(data.sizeBytes)
    const file = await db.storageFile.create({ data: data as never })
    return NextResponse.json(file, { status: 201 })
  } catch (error) {
    return serverErrorResponse(error)
  }
}
