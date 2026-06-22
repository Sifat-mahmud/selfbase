import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-utils'

export async function GET(request: Request) {
  try {
    const userInfo = await getUserFromRequest(request)
    if (!userInfo) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    return NextResponse.json({
      user: userInfo,
    })
  } catch (err) {
    console.error('Me error:', err)
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
}
