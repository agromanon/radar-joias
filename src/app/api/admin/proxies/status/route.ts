/**
 * GET /api/admin/proxies/status
 * Returns pool statistics and all proxies.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getPoolStats, getAllProxies } from '@/lib/proxy/pool'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
            catch {}
          },
        },
      }
    )

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles').select('tier').eq('id', session.user.id).single()

    if (!profile || profile.tier !== 'war_room')
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 })

    const [stats, proxies] = await Promise.all([getPoolStats(), getAllProxies()])

    return NextResponse.json({ stats, proxies })
  } catch (error) {
    console.error('Proxies status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}