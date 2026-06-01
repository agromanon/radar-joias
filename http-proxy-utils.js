/**
 * Proxy rotation module
 * Supports:
 *  - Manual proxy list (PROXY_URLS env var, comma-separated)
 *  - WebShare via PROXY_SERVICE=webshare + PROXY_URLS=token
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

function initProxyPool() {
  if (initialized) return;
  initialized = true;
  proxyPool = [];

  // Manual proxy list — skip WebShare token values (they're handled by PROXY_SERVICE below)
  if (process.env.PROXY_URLS) {
    const isWebShareToken = (u) =>
      u.includes('_') && !u.startsWith('http://') && !u.startsWith('https://');
    const urls = process.env.PROXY_URLS.split(',')
      .map(u => u.trim())
      .filter(Boolean)
      .filter(u => !isWebShareToken(u));
    proxyPool.push(...urls);
  }

  // WebShare token → proxy URL
  if (process.env.PROXY_SERVICE === 'webshare') {
    const token = process.env.PROXY_URLS?.trim();
    if (token && !token.startsWith('http')) {
      const parts = token.split('_');
      const username = parts[0];
      const password = parts.slice(1).join('_');
      if (username && password) {
        proxyPool.push(`http://${username}:${password}@proxy.webshare.io:80`);
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

function parseProxyUrl(raw) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function getProxyUrl() {
  initProxyPool();
  if (proxyPool.length === 0) return null;
  const url = proxyPool[proxyIndex % proxyPool.length];
  proxyIndex++;
  return url;
}

async function buildProxyAgent(proxyUrl) {
  if (!proxyUrl) return null;
  const { ProxyAgent } = await import('proxy-agent');
  return new ProxyAgent(proxyUrl);
}

// ============================================================
// FETCH WITH PROXY (used by scraper for CAIXA API calls)
// ============================================================

export async function proxiedFetch(url, options = {}) {
  const proxyUrl = getProxyUrl();
  const agent = await buildProxyAgent(proxyUrl);

  const fetchOptions = {
    ...options,
    ...(agent ? { agent } : {}),
  };

  if (proxyUrl) {
    const u = parseProxyUrl(proxyUrl);
    console.log(`  [proxy] ${u?.hostname ?? proxyUrl} → ${url}`);
  }

  return fetch(url, fetchOptions);
}