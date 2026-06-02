/**
 * POST /api/admin/proxies/refresh
 * Fetch all WebShare proxies, test each against CAIXA, update pool.
 * Body: { forceRetest?: boolean }
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { listProxies } from '@/lib/proxy/webshare'
import {
  upsertProxy,
  getPoolStats,
  getAllProxies,
  recordProxySuccess,
  recordProxyFailure,
  logProxyTest,
} from '@/lib/proxy/pool'
import { testProxyAgainstCaixa } from '@/lib/proxy/caixa-tester'

const CAIXA_TEST_URL = 'https://servicebus2.caixa.gov.br/vitrinedejoias/api/busca/ufs';
const TEST_INTERVAL_MS = 2000;

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

    const { forceRetest = false } = await request.json().catch(() => ({}))

    const startTime = Date.now();

    // 1. Fetch all proxies from WebShare
    let webshareProxies: Awaited<ReturnType<typeof listProxies>> = [];
    try {
      webshareProxies = await listProxies();
    } catch (e) {
      return NextResponse.json({ error: `WebShare API error: ${e}` }, { status: 502 })
    }

    // 2. Upsert all proxies into pool (don't overwrite status)
    for (const p of webshareProxies) {
      await upsertProxy({
        id: String(p.id),
        proxy_address: p.proxy_address,
        port: p.port,
        username: p.username,
        password: p.password,
      });
    }

    // 3. Get all proxies from pool to test
    const allProxies = await getAllProxies();
    const toTest = forceRetest
      ? allProxies
      : allProxies.filter(p => !p.caixa_tested_at || p.status === 'pending');

    // 4. Test each against CAIXA
    let newlyActive = 0;
    let newlyBlocked = 0;
    const testedIds: number[] = [];

    for (const proxy of toTest) {
      const proxyUrl = proxy.proxy_url;
      const result = await testProxyAgainstCaixa(proxyUrl);

      await logProxyTest(proxy.id, CAIXA_TEST_URL, result);

      if (result.valid) {
        await recordProxySuccess(proxy.id);
        newlyActive++;
      } else {
        const becameBlocked = await recordProxyFailure(proxy.id);
        if (becameBlocked) newlyBlocked++;
      }

      testedIds.push(proxy.id);
      // Rate limit: wait between tests
      await new Promise(r => setTimeout(r, TEST_INTERVAL_MS));
    }

    const stats = await getPoolStats();

    return NextResponse.json({
      refreshed: stats.total,
      fetchedFromWebShare: webshareProxies.length,
      tested: testedIds.length,
      newlyActive,
      newlyBlocked,
      durationMs: Date.now() - startTime,
    })
  } catch (error) {
    console.error('Proxies refresh error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}