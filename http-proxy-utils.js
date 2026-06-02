/**
 * Proxy rotation module
 * Supports:
 *  - Manual proxy list (PROXY_URLS env var, comma-separated)
 *  - WebShare rotating proxy with IP auth via curl fallback
 *
 * NOTE: ProxyAgent is imported lazily inside buildProxyAgent() to prevent
 * proxy-agent v8 from patching globalThis.fetch, which would break
 * LLM API calls in llm-gateway.js.
 */

import { URL } from 'url';
import { execFileSync } from 'child_process';

// Proxy pool — initialized lazily on first call to getProxyUrl()
let proxyIndex = 0;
let proxyPool = [];
let initialized = false;
let dbInitialized = false;

// Exported for external control (e.g. scraper loading from DB)
export function setProxyPool(entries) {
  // Support both array of strings (backwards compat) and array of {id, url} objects
  proxyPool = entries.map(e => typeof e === 'string' ? e : { id: e.id, url: e.url });
  proxyIndex = 0;
  initialized = true;
  dbInitialized = true;
  if (proxyPool.length === 0) {
    console.warn('[proxy] Proxy pool empty — direct connection');
  } else {
    console.log(`[proxy] Pool set with ${proxyPool.length} proxy(ies)`);
    for (const p of proxyPool) {
      const entry = typeof p === 'string' ? p : p.url;
      const u = parseProxyUrl(entry);
      console.log(`[proxy]   - ${u ? u.hostname : entry}`);
    }
  }
}

export function getProxyPool() {
  return proxyPool;
}

function parseProxyUrl(raw) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

async function initDbProxyPool() {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );
    const { data } = await supabase
      .from('working_proxies')
      .select('id, proxy_address, port, username, password')
      .eq('status', 'active')
      .eq('caixa_works', true)
      .order('last_used_at', { ascending: true, nullsFirst: true });

    if (!data || data.length === 0) {
      console.warn('[proxy] No active working proxies in DB — direct connection');
      return;
    }

    proxyPool = data.map(p => ({
      id: p.id,
      url: p.username && p.password
        ? `http://${p.username}:${p.password}@${p.proxy_address}:${p.port}`
        : `http://${p.proxy_address}:${p.port}`,
    }));

    console.log(`[proxy] DB pool loaded with ${proxyPool.length} working proxy(ies)`);
    for (const p of proxyPool) {
      console.log(`[proxy]   - id=${p.id} ${p.url}`);
    }
  } catch (e) {
    console.warn(`[proxy] Failed to load DB pool: ${e.message} — direct connection`);
  }
}

// Mark a proxy as failed in DB (called on 403/error at runtime)
async function markProxyFailed(proxyId) {
  if (!proxyId) return;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );
    // Get current failure_count
    const { data } = await supabase
      .from('working_proxies')
      .select('failure_count')
      .eq('id', proxyId)
      .single();

    const newCount = (data?.failure_count ?? 0) + 1;
    const isNowBlocked = newCount >= 3;

    await supabase
      .from('working_proxies')
      .update({
        failure_count: newCount,
        status: isNowBlocked ? 'blocked' : 'active',
        caixa_works: false,
        last_failure_at: new Date().toISOString(),
      })
      .eq('id', proxyId);

    console.warn(`[proxy] Marked proxy id=${proxyId} failed (count=${newCount}, blocked=${isNowBlocked})`);
  } catch (e) {
    console.warn(`[proxy] Failed to mark proxy ${proxyId} as failed: ${e.message}`);
  }
}

function initProxyPool() {
  if (initialized) return;
  proxyPool = [];

  // If SUPABASE_URL is available, prefer DB pool over PROXY_URLS
  // (DB pool is tested against CAIXA, PROXY_URLS is unvalidated)
  const hasDbCredentials = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (hasDbCredentials && !process.env.PROXY_URLS_FORCE) {
    if (!process.env.PROXY_URLS || process.env.PROXY_URLS === 'http://p.webshare.io:9999/') {
      // No PROXY_URLS or rotating proxy — will load from DB in ensureProxyPool()
      console.warn('[proxy] Will use DB proxy pool (SUPABASE_URL available, PROXY_URLS skipped)');
      initialized = true;
      return;
    }
  }

  if (process.env.PROXY_URLS) {
    const urls = process.env.PROXY_URLS.split(',')
      .map(u => u.trim())
      .filter(Boolean);

    for (const url of urls) {
      // Skip WebShare token format
      if (url.includes('_') && !url.startsWith('http://') && !url.startsWith('https://')) {
        continue;
      }
      proxyPool.push(url);
    }

    if (proxyPool.length === 0) {
      console.warn('No proxies configured — direct connection');
    } else {
      console.log(`Proxy pool initialized with ${proxyPool.length} proxy(ies)`);
      for (const p of proxyPool) {
        const u = parseProxyUrl(p);
        console.log(`  - ${u ? u.hostname : p}`);
      }
    }
  } else {
    console.warn('[proxy] PROXY_URLS not set — scraper should call setProxyPool() before use');
  }
}

async function buildProxyAgent(proxyUrl) {
  if (!proxyUrl) return null;
  const { ProxyAgent } = await import('proxy-agent');
  return new ProxyAgent(proxyUrl);
}

// ============================================================
// FETCH WITH PROXY (used by scraper for CAIXA API calls)
// Uses curl as fallback when proxy-agent returns 403
// ============================================================

const MAX_PROXY_RETRIES = 3;

async function curlFetch(url, proxyUrl, options = {}) {
  const u = parseProxyUrl(proxyUrl);
  const proxyHost = u?.hostname ?? proxyUrl;
  const proxyPort = u?.port ?? '80';

  const args = ['-s', '--max-time', '30', '--proxy', `http://${proxyHost}:${proxyPort}/`];

  // If credentials embedded in URL (http://user:pass@host:port/), pass to curl
  if (u?.username && u?.password) {
    args.push('--proxy-user', `${u.username}:${u.password}`);
  }

  const headers = { ...options.headers };
  if (!headers['accept']) headers['accept'] = 'application/json';
  if (!headers['user-agent']) headers['user-agent'] = 'Mozilla/5.0';

  for (const [key, value] of Object.entries(headers)) {
    args.push('-H', `${key}: ${value}`);
  }

  // -k: skip SSL verification (CAIXA uses self-signed cert)
  // --ipv4: avoid IPv6 issues
  args.push('-k', '--ipv4', url);

  try {
    const result = execFileSync('curl', args, { encoding: 'utf-8' });
    // Check if response is HTML (CAIXA blocking page or proxy error)
    const trimmed = result.trim();
    const isHtml = trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML');
    if (isHtml) {
      return {
        ok: false,
        status: 403,
        text: () => Promise.resolve(trimmed),
        json: () => Promise.reject(new Error('HTML response (blocked)')),
      };
    }
    // Verify it's actually JSON before claiming success
    try {
      JSON.parse(trimmed);
    } catch {
      return {
        ok: false,
        status: 502,
        text: () => Promise.resolve(trimmed.substring(0, 200)),
        json: () => Promise.reject(new Error('Non-JSON response')),
      };
    }
    return {
      ok: true,
      status: 200,
      text: () => Promise.resolve(result),
      json: () => Promise.resolve(JSON.parse(trimmed)),
    };
  } catch (e) {
    // Non-zero exit code from curl = failure
    return {
      ok: false,
      status: 403,
      text: () => Promise.resolve(e.message),
      json: () => Promise.reject(e.message),
    };
  }
}

// Lazy DB load — only used if no PROXY_URLS env var and scraper didn't call setProxyPool()
async function ensureProxyPool() {
  if (dbInitialized) return;
  if (!initialized) {
    initProxyPool(); // may early-return if DB path is preferred
  }
  if (proxyPool.length > 0) {
    initialized = true;
    return; // got proxies from PROXY_URLS
  }
  // proxyPool empty — load from DB
  await initDbProxyPool();
  initialized = true;
  dbInitialized = true;
}

export async function proxiedFetch(url, options = {}) {
  await ensureProxyPool();

  if (proxyPool.length === 0) {
    return fetch(url, options);
  }

  let lastError;
  let triedCount = 0;

  // Try each proxy in sequence until one works
  while (triedCount < proxyPool.length) {
    const idx = proxyIndex % proxyPool.length;
    const entry = proxyPool[idx];
    // Support both old format (string) and new format ({id, url})
    const proxyUrl = typeof entry === 'string' ? entry : entry.url;
    const proxyId = typeof entry === 'object' ? entry.id : null;
    const u = parseProxyUrl(proxyUrl);
    console.log(`  [proxy] ${u?.hostname ?? proxyUrl} → ${url}`);

    try {
      // Try proxy-agent first
      const agent = await buildProxyAgent(proxyUrl);
      const fetchOptions = {
        ...options,
        ...(agent ? { agent } : {}),
      };

      const res = await fetch(url, fetchOptions);

      if (res.status === 403 || res.status === 429) {
        console.warn(`  [proxy] ${u?.hostname ?? proxyUrl} returned ${res.status}, trying next...`);
        if (proxyId) await markProxyFailed(proxyId);
        proxyIndex++; // mark this one as bad, move to next
        triedCount++;
        continue;
      }

      return res;
    } catch (e) {
      lastError = e;
      console.warn(`  [proxy] ${u?.hostname ?? proxyUrl} failed: ${e.message}, trying next...`);
      if (proxyId) await markProxyFailed(proxyId);
      proxyIndex++; // mark this one as bad, move to next
      triedCount++;
    }
  }

  throw lastError ?? new Error('All proxies failed');
}