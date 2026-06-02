/**
 * Proxy pool management — backed by Supabase.
 * Manages the working_proxies table: tracks status, tests against CAIXA,
 * handles replacement workflow.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BLOCKED_FAILURE_THRESHOLD = 3;

export interface PoolProxy {
  id: number;
  proxy_address: string;
  port: number;
  username: string | null;
  password: string | null;
  proxy_url: string;
  status: 'pending' | 'active' | 'blocked' | 'replacing';
  caixa_works: boolean | null;
  caixa_tested_at: string | null;
  failure_count: number;
  webshare_proxy_id: string | null;
  last_used_at: string | null;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export interface PoolStats {
  total: number;
  active: number;
  blocked: number;
  replacing: number;
  pending: number;
}

// Build proxy_url from components
function buildProxyUrl(address: string, port: number, username: string | null, password: string | null): string {
  if (username && password) {
    return `http://${username}:${password}@${address}:${port}`;
  }
  return `http://${address}:${port}`;
}

// Get the next available working proxy for use by scraper
export async function getWorkingProxy(): Promise<PoolProxy | null> {
  // Pick the least recently used active proxy that's confirmed working
  const { data } = await supabase
    .from('working_proxies')
    .select('*')
    .eq('status', 'active')
    .eq('caixa_works', true)
    .order('last_used_at', { ascending: true, nullsFirst: true })
    .limit(1)
    .single();

  if (!data) return null;

  // Build full proxy_url
  const proxy_url = buildProxyUrl(data.proxy_address, data.port, data.username, data.password);

  // Increment usage counters
  await supabase
    .from('working_proxies')
    .update({
      last_used_at: new Date().toISOString(),
      use_count: (data.use_count ?? 0) + 1,
    })
    .eq('id', data.id);

  return { ...data, proxy_url };
}

// Record a successful CAIXA test
export async function recordProxySuccess(proxyId: number) {
  await supabase
    .from('working_proxies')
    .update({
      failure_count: 0,
      last_failure_at: null,
      status: 'active',
      caixa_works: true,
      caixa_tested_at: new Date().toISOString(),
    })
    .eq('id', proxyId);
}

// Record a failed CAIXA test
export async function recordProxyFailure(proxyId: number) {
  const { data } = await supabase
    .from('working_proxies')
    .select('failure_count')
    .eq('id', proxyId)
    .single();

  const newCount = (data?.failure_count ?? 0) + 1;
  const isNowBlocked = newCount >= BLOCKED_FAILURE_THRESHOLD;

  await supabase
    .from('working_proxies')
    .update({
      failure_count: newCount,
      status: isNowBlocked ? 'blocked' : 'active',
      caixa_works: false,
      caixa_tested_at: new Date().toISOString(),
    })
    .eq('id', proxyId);

  return isNowBlocked;
}

// Get pool statistics
export async function getPoolStats(): Promise<PoolStats> {
  const { data } = await supabase.from('working_proxies').select('status');

  const counts = { pending: 0, active: 0, blocked: 0, replacing: 0 };
  for (const row of data ?? []) {
    if (row.status in counts) counts[row.status as keyof typeof counts]++;
  }

  return {
    total: (data?.length ?? 0),
    ...counts,
  };
}

// Get all proxies
export async function getAllProxies(): Promise<PoolProxy[]> {
  const { data } = await supabase
    .from('working_proxies')
    .select('*')
    .order('created_at', { ascending: false });

  return (data ?? []).map(row => ({
    ...row,
    proxy_url: buildProxyUrl(row.proxy_address, row.port, row.username, row.password),
  }));
}

// Upsert a single proxy from WebShare into the pool
export async function upsertProxy(proxy: {
  id: string;
  proxy_address: string;
  port: number;
  username: string;
  password: string;
}) {
  await supabase
    .from('working_proxies')
    .upsert(
      {
        webshare_proxy_id: proxy.id,
        proxy_address: proxy.proxy_address,
        port: proxy.port,
        username: proxy.username,
        password: proxy.password,
      },
      {
        onConflict: 'proxy_address,port',
        ignoreDuplicates: false, // update on conflict so we get new IP info
      }
    );
}

// Mark proxies as replacing
export async function markProxiesReplacing(proxyIds: number[]) {
  await supabase
    .from('working_proxies')
    .update({ status: 'replacing' })
    .in('id', proxyIds);
}

// Mark proxies as pending (reset after replacement completes)
export async function markProxiesPending(proxyIds: number[]) {
  await supabase
    .from('working_proxies')
    .update({
      status: 'pending',
      failure_count: 0,
      caixa_works: null,
      caixa_tested_at: null,
    })
    .in('id', proxyIds);
}

// Log a test result
export async function logProxyTest(
  proxyId: number,
  testUrl: string,
  result: { valid: boolean; durationMs: number; error?: string; responseCode?: number }
) {
  await supabase.from('proxy_test_log').insert({
    proxy_id: proxyId,
    test_url: testUrl,
    response_valid: result.valid,
    response_code: result.responseCode,
    error_message: result.error,
    duration_ms: result.durationMs,
  });
}

// Get blocked proxy IDs (for replacement)
export async function getBlockedProxyIds(): Promise<number[]> {
  const { data } = await supabase
    .from('working_proxies')
    .select('id')
    .eq('status', 'blocked');
  return (data ?? []).map(r => r.id);
}

// Get blocked proxy details
export async function getBlockedProxies(): Promise<PoolProxy[]> {
  const { data } = await supabase
    .from('working_proxies')
    .select('*')
    .eq('status', 'blocked')
    .order('last_failure_at', { ascending: false });

  return (data ?? []).map(row => ({
    ...row,
    proxy_url: buildProxyUrl(row.proxy_address, row.port, row.username, row.password),
  }));
}