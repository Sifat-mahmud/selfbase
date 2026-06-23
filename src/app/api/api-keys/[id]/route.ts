import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth-utils'

// Delete/revoke an API key
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id } = await params

  const key = await db.apiKey.findFirst({
    where: { id, userId: user.id },
  })

  if (!key) {
    return NextResponse.json({ error: 'API key not found' }, { status: 404 })
  }

  await db.appToken.deleteMany({ where: { apiKeyId: id } })
  await db.apiKey.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
