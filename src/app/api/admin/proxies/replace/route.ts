/**
 * POST /api/admin/proxies/replace
 * Request replacement for blocked proxies via WebShare API.
 * Body: { proxyIds?: number[] } — if not provided, replaces all blocked proxies.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createReplacement, pollReplacement, listProxies } from '@/lib/proxy/webshare'
import {
  getBlockedProxies,
  getBlockedProxyIds,
  upsertProxy,
  markProxiesReplacing,
  markProxiesPending,
  getPoolStats,
} from '@/lib/proxy/pool'

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

    const { proxyIds } = await request.json().catch(() => ({ proxyIds: null }))

    // Get proxies to replace
    let blocked = proxyIds && proxyIds.length > 0
      ? (await getBlockedProxies()).filter(p => proxyIds.includes(p.id))
      : await getBlockedProxies();

    if (blocked.length === 0) {
      return NextResponse.json({ replaced: 0, message: 'No blocked proxies to replace' })
    }

    const startTime = Date.now();

    // Mark as replacing
    await markProxiesReplacing(blocked.map(p => p.id));

    // Request replacement from WebShare
    const ipAddresses = blocked.map(p => p.proxy_address);
    const replacement = await createReplacement({
      to_replace: { type: 'ip_address', ip_addresses: ipAddresses },
      replace_with: { type: 'any', count: blocked.length },
    });

    // Poll until completed
    const finalReplacement = await pollReplacement(replacement.id);

    if (finalReplacement.state === 'failed') {
      // Reset proxies back to blocked
      await markProxiesPending(blocked.map(p => p.id));
      return NextResponse.json({
        error: `Replacement failed: ${finalReplacement.error}`,
        replacementId: replacement.id,
        state: finalReplacement.state,
      }, { status: 502 })
    }

    // Fetch the new proxies that were added
    // After replacement, WebShare rotates in new IPs — we need to re-fetch from WebShare
    const newProxies = await listProxies();
    const newIps = new Set(ipAddresses);
    const addedProxies = newProxies.filter(p => !newIps.has(p.proxy_address));

    // Add new proxies to pool as pending
    let addedCount = 0;
    for (const p of addedProxies) {
      await upsertProxy({
        id: String(p.id),
        proxy_address: p.proxy_address,
        port: p.port,
        username: p.username,
        password: p.password,
      });
      addedCount++;
    }

    // Reset old blocked proxies (they may be available again in WebShare pool)
    await markProxiesPending(blocked.map(p => p.id));

    const stats = await getPoolStats();

    return NextResponse.json({
      replaced: blocked.length,
      newProxiesAdded: addedCount,
      replacementId: replacement.id,
      state: finalReplacement.state,
      proxiesRemoved: finalReplacement.proxies_removed,
      proxiesAdded: finalReplacement.proxies_added,
      stats,
      durationMs: Date.now() - startTime,
    })
  } catch (error) {
    console.error('Proxies replace error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}