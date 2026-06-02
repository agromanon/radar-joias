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
export function setProxyPool(urls) {
  proxyPool = urls.filter(Boolean);
  proxyIndex = 0;
  initialized = true;
  dbInitialized = true;
  if (proxyPool.length === 0) {
    console.warn('[proxy] Proxy pool empty — direct connection');
  } else {
    console.log(`[proxy] Pool set with ${proxyPool.length} proxy(ies)`);
    for (const p of proxyPool) {
      const u = parseProxyUrl(p);
      console.log(`[proxy]   - ${u ? u.hostname : p}`);
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
      .select('proxy_address, port, username, password')
      .eq('status', 'active')
      .eq('caixa_works', true)
      .order('last_used_at', { ascending: true, nullsFirst: true });

    if (!data || data.length === 0) {
      console.warn('[proxy] No active working proxies in DB — direct connection');
      return;
    }

    proxyPool = data.map(p => {
      if (p.username && p.password) {
        return `http://${p.username}:${p.password}@${p.proxy_address}:${p.port}`;
      }
      return `http://${p.proxy_address}:${p.port}`;
    });

    console.log(`[proxy] DB pool loaded with ${proxyPool.length} working proxy(ies)`);
    for (const p of proxyPool) {
      const u = parseProxyUrl(p);
      console.log(`[proxy]   - ${u ? u.hostname : p}`);
    }
  } catch (e) {
    console.warn(`[proxy] Failed to load DB pool: ${e.message} — direct connection`);
  }
}

function initProxyPool() {
  if (initialized) return;
  initialized = true;
  proxyPool = [];

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
    // No PROXY_URLS env var — async init from DB will be done by scraper calling setProxyPool()
    // For synchronous first call, fall back to direct connection until scraper sets pool
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
  if (dbInitialized || initialized) return; // already loaded via env or setProxyPool
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
  for (let attempt = 0; attempt < MAX_PROXY_RETRIES; attempt++) {
    const proxyUrl = proxyPool[(proxyIndex + attempt) % proxyPool.length];
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

      // If 403 from p.webshare.io, fall back to curl
      if (res.status === 403 && u?.hostname === 'p.webshare.io') {
        console.warn(`  [proxy] p.webshare.io returned 403, trying curl fallback...`);
        const curlRes = await curlFetch(url, proxyUrl, options);
        if (curlRes.ok) return curlRes;
        if (attempt < MAX_PROXY_RETRIES - 1) {
          proxyIndex++;
          continue;
        }
        return curlRes;
      }

      if ((res.status === 403 || res.status === 429) && attempt < MAX_PROXY_RETRIES - 1) {
        console.warn(`  [proxy] ${u?.hostname ?? proxyUrl} returned ${res.status}, trying next proxy...`);
        proxyIndex++;
        continue;
      }

      return res;
    } catch (e) {
      lastError = e;

      // If proxy-agent fails with network error and it's p.webshare.io, try curl
      if (u?.hostname === 'p.webshare.io') {
        console.warn(`  [proxy] proxy-agent failed for p.webshare.io: ${e.message}, trying curl...`);
        try {
          const curlRes = await curlFetch(url, proxyUrl, options);
          if (curlRes.ok) return curlRes;
          if (attempt < MAX_PROXY_RETRIES - 1) {
            proxyIndex++;
            continue;
          }
          return curlRes;
        } catch (curlErr) {
          lastError = curlErr;
        }
      }

      if (attempt < MAX_PROXY_RETRIES - 1) {
        console.warn(`  [proxy] ${u?.hostname ?? proxyUrl} failed: ${e.message}, trying next proxy...`);
        proxyIndex++;
      }
    }
  }

  throw lastError ?? new Error('All proxies failed');
}