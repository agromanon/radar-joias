/**
 * Proxy rotation module
 * Supports:
 *  - Manual proxy list (PROXY_URLS env var, comma-separated)
 *  - WebShare via PROXY_SERVICE=webshare + PROXY_URLS=token (fetches individual proxies from API)
 *  - WebShare rotating proxy with IP auth: PROXY_URLS=http://p.webshare.io:PORT/
 *
 * NOTE: ProxyAgent is imported lazily inside buildProxyAgent() to prevent
 * proxy-agent v8 from patching globalThis.fetch, which would break
 * LLM API calls in llm-gateway.js.
 */

import { URL } from 'url';

// Proxy pool — initialized lazily on first call to getProxyUrl()
let proxyIndex = 0;
let proxyPool = [];
let initialized = false;

function parseProxyUrl(raw) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

async function initProxyPool() {
  if (initialized) return;
  initialized = true;
  proxyPool = [];

  if (!process.env.PROXY_URLS) return;

  const urls = process.env.PROXY_URLS.split(',')
    .map(u => u.trim())
    .filter(Boolean);

  for (const url of urls) {
    // Skip WebShare token format (user_pass) which is handled below
    if (url.includes('_') && !url.startsWith('http://') && !url.startsWith('https://')) {
      continue;
    }
    proxyPool.push(url);
  }

  // WebShare token → individual proxy list from API
  if (process.env.PROXY_SERVICE === 'webshare' && process.env.PROXY_URLS) {
    const token = process.env.PROXY_URLS.trim();
    if (!token.startsWith('http://') && !token.startsWith('https://')) {
      try {
        const apiRes = await fetch('https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page_size=100', {
          headers: { 'Authorization': `Token ${token}` },
        });
        if (apiRes.ok) {
          const data = await apiRes.json();
          for (const p of data.results ?? []) {
            if (p.valid) {
              proxyPool.push(`http://${p.username}:${p.password}@${p.proxy_address}:${p.port}/`);
            }
          }
        } else {
          console.warn(`  WebShare API returned ${apiRes.status}`);
        }
      } catch (e) {
        console.warn(`  WebShare API error: ${e.message}`);
      }
    }
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
}

async function buildProxyAgent(proxyUrl) {
  if (!proxyUrl) return null;
  const { ProxyAgent } = await import('proxy-agent');
  return new ProxyAgent(proxyUrl);
}

// ============================================================
// FETCH WITH PROXY (used by scraper for CAIXA API calls)
// ============================================================

const MAX_PROXY_RETRIES = 3;

export async function proxiedFetch(url, options = {}) {
  await initProxyPool();

  if (proxyPool.length === 0) {
    return fetch(url, options);
  }

  let lastError;
  for (let attempt = 0; attempt < MAX_PROXY_RETRIES; attempt++) {
    const proxyUrl = proxyPool[(proxyIndex + attempt) % proxyPool.length];
    const agent = await buildProxyAgent(proxyUrl);

    const fetchOptions = {
      ...options,
      ...(agent ? { agent } : {}),
    };

    const u = parseProxyUrl(proxyUrl);
    console.log(`  [proxy] ${u?.hostname ?? proxyUrl} → ${url}`);

    try {
      const res = await fetch(url, fetchOptions);

      if ((res.status === 403 || res.status === 429) && attempt < MAX_PROXY_RETRIES - 1) {
        const u2 = parseProxyUrl(proxyUrl);
        console.warn(`  [proxy] ${u2?.hostname ?? proxyUrl} returned ${res.status}, trying next proxy...`);
        proxyIndex++;
        continue;
      }

      return res;
    } catch (e) {
      lastError = e;
      if (attempt < MAX_PROXY_RETRIES - 1) {
        console.warn(`  [proxy] ${u?.hostname ?? proxyUrl} failed: ${e.message}, trying next proxy...`);
        proxyIndex++;
      }
    }
  }

  throw lastError ?? new Error('All proxies failed');
}