/**
 * POST /api/admin/scrapers/trigger
 * Trigger an on-demand scraper mode.
 * For cron-based modes: records intent and calls Coolify webhook if configured.
 * For immediate modes: runs the scraper inline (not recommended for long-running tasks).
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const ON_DEMAND_MODES = ['dedup', 'edital', 'auctions', 'scrape-lots', 'scrape-results', 're-scrape-missing', 'reconstruct-urls']

export async function POST(request: NextRequest) {
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

    const { mode, auction_code } = await request.json()

    if (!mode) return NextResponse.json({ error: 'mode is required' }, { status: 400 })

    // Validate mode
    const validModes = [...ON_DEMAND_MODES, 'states-cities', 'bid-periods', 'discover', 'active-lots', 'results', 'insight', 'enrich', 'download-images', 'health-check-images', 'refresh-images']
    if (!validModes.includes(mode)) {
      return NextResponse.json({ error: `Invalid mode. Valid: ${validModes.join(', ')}` }, { status: 400 })
    }

    // Log the trigger request
    const { error: logError } = await supabase
      .from('scrape_log')
      .insert({
        job_name: mode,
        started_at: new Date().toISOString(),
        items_found: 0,
        items_new: 0,
        items_updated: 0,
        errors: 0,
      })

    if (logError) console.error('Failed to log trigger:', logError)

    // Try to call Coolify webhook if configured
    const coolifyWebhookUrl = process.env.COOLIFY_WEBHOOK_URL
    if (coolifyWebhookUrl) {
      try {
        const webhookUrl = `${coolifyWebhookUrl}?mode=${mode}${auction_code ? `&auction_code=${encodeURIComponent(auction_code)}` : ''}`
        const response = await fetch(webhookUrl, { method: 'POST', signal: AbortSignal.timeout(10000) })
        if (!response.ok) {
          console.error(`Coolify webhook failed: ${response.status}`)
        }
      } catch (e) {
        console.error('Failed to call Coolify webhook:', e)
      }
    }

    return NextResponse.json({
      success: true,
      mode,
      triggered_at: new Date().toISOString(),
      coolify_webhook_called: !!coolifyWebhookUrl,
    })
  } catch (error) {
    console.error('Scraper trigger POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}