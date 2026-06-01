/**
 * Admin Scrapers Status API
 * Returns scraper run history and statistics per mode
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

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

    // Fetch last 100 scrape logs ordered by most recent
    const { data: logs, error } = await supabase
      .from('scrape_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Group by job_name for statistics
    const statsByJob: Record<string, {
      lastRun: string | null
      totalRuns: number
      successCount: number
      errorCount: number
      totalItemsFound: number
      totalItemsNew: number
      totalItemsUpdated: number
      totalErrors: number
      avgDurationMs: number
      lastSuccess: string | null
      lastError: string | null
    }> = {}

    for (const log of (logs || [])) {
      const job = log.job_name || 'unknown'
      if (!statsByJob[job]) {
        statsByJob[job] = {
          lastRun: null, totalRuns: 0, successCount: 0, errorCount: 0,
          totalItemsFound: 0, totalItemsNew: 0, totalItemsUpdated: 0,
          totalErrors: 0, avgDurationMs: 0, lastSuccess: null, lastError: null,
        }
      }
      const s = statsByJob[job]
      s.totalRuns++
      if (log.completed_at && !log.errors) {
        s.successCount++
        if (!s.lastSuccess) s.lastSuccess = log.started_at
      } else {
        s.errorCount++
        if (!s.lastError) s.lastError = log.started_at
      }
      s.totalItemsFound += log.items_found || 0
      s.totalItemsNew += log.items_new || 0
      s.totalItemsUpdated += log.items_updated || 0
      s.totalErrors += log.errors || 0
      if (log.duration_ms) s.avgDurationMs += log.duration_ms
      if (!s.lastRun || log.started_at > s.lastRun) s.lastRun = log.started_at
    }

    // Compute averages
    for (const job of Object.keys(statsByJob)) {
      const s = statsByJob[job]
      s.avgDurationMs = s.totalRuns > 0 ? Math.round(s.avgDurationMs / s.totalRuns) : 0
    }

    // Build scraper modes info
    const SCRAPER_MODES = [
      { mode: 'states-cities', label: 'States & Cities', description: 'Refresh states and cities from CAIXA API', schedule: 'Daily 5:30am', isOnDemand: false },
      { mode: 'bid-periods', label: 'Bid Periods', description: 'Discover new bid periods per city', schedule: 'Daily 6am', isOnDemand: false },
      { mode: 'discover', label: 'Discover', description: 'Find all auction codes and link lots', schedule: 'Daily 7am', isOnDemand: false },
      { mode: 'active-lots', label: 'Active Lots', description: 'Fetch lots for active bid periods', schedule: 'Weekdays 8am/12pm/4pm', isOnDemand: false },
      { mode: 'results', label: 'Results', description: 'Fetch auction outcomes and catalog updates', schedule: 'Daily 8am', isOnDemand: false },
      { mode: 'insight', label: 'Insight', description: 'Generate marketing intelligence', schedule: 'Daily 9am', isOnDemand: false },
      { mode: 'enrich', label: 'Enrich', description: 'LLM enrichment for lot descriptions', schedule: 'Every 4 hours', isOnDemand: false },
      { mode: 'download-images', label: 'Download Images', description: 'Backfill images for all lots', schedule: 'Daily 3am', isOnDemand: false },
      { mode: 'health-check-images', label: 'Health Check Images', description: 'Validate image URLs, nullify broken ones', schedule: 'Weekly Sunday 4am', isOnDemand: false },
      { mode: 'refresh-images', label: 'Refresh Images', description: 'Re-download missing images', schedule: 'Weekly Sunday 5am', isOnDemand: false },
      { mode: 'dedup', label: 'Dedup', description: 'Find and remove duplicate lots', schedule: 'On-demand', isOnDemand: true },
      { mode: 'edital', label: 'Edital', description: 'Download and LLM-parse edital PDF', schedule: 'On-demand', isOnDemand: true },
      { mode: 'auctions', label: 'Auctions', description: 'Link lots to auction records', schedule: 'On-demand', isOnDemand: true },
      { mode: 'scrape-lots', label: 'Scrape Lots', description: 'City-by-city lot scraper (alt mode)', schedule: 'On-demand', isOnDemand: true },
      { mode: 'scrape-results', label: 'Scrape Results', description: 'Parse result PDFs for completed auctions', schedule: 'On-demand', isOnDemand: true },
      { mode: 're-scrape-missing', label: 'Re-scrape Missing', description: 'Re-scrape lots that had no images', schedule: 'On-demand', isOnDemand: true },
      { mode: 'reconstruct-urls', label: 'Reconstruct URLs', description: 'Reconstruct image URLs from contract numbers', schedule: 'On-demand', isOnDemand: true },
    ]

    const enrichedModes = SCRAPER_MODES.map(m => ({
      ...m,
      stats: statsByJob[m.mode] || null,
    }))

    return NextResponse.json({
      modes: enrichedModes,
      recentLogs: logs || [],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Scraper status GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}