/**
 * Admin Scraper Logs API
 * Fetches scraper execution logs for monitoring
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/admin/scrapers/logs - Get recent scraper logs
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch (error) {
              // In certain Edge Runtime environments, cookies cannot be set
            }
          },
        },
      }
    )

    // Debug: Check what cookies are available
    console.log('=== ADMIN SCRAPERS LOGS API DEBUG ===')
    console.log('All cookies from cookieStore:', cookieStore.getAll())

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    // Debug logging
    console.log('Session exists:', !!session)
    console.log('Session error:', sessionError)
    console.log('Session data:', session ? { user: session.user.id, email: session.user.email } : null)

    if (sessionError) {
      console.error('Session error:', sessionError)
    }

    if (!session) {
      console.log('❌ No session found - returning 401')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', session.user.id)
      .single()

    if (!profile || profile.tier !== 'war_room') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 })
    }

    // Fetch last 10 scraper logs, ordered by most recent
    const { data: logs, error } = await supabase
      .from('scraper_logs')
      .select('*')
      .order('ran_at', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Group by auctioneer and get the most recent run for each
    const auctioneers = new Map<string, any>()
    logs.forEach((log: any) => {
      if (!auctioneers.has(log.auctioneer)) {
        auctioneers.set(log.auctioneer, log)
      }
    })

    const uniqueLogs = Array.from(auctioneers.values())

    return NextResponse.json({
      logs: uniqueLogs,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Scraper logs GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
