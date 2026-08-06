/**
 * Proxy rotation module for CAIXA scraping.
 * Uses PROXY_URLS env var (comma-separated) — no DB dependency.
 * Evomi residential format: https://user:pass@gateway:port
 *
 * NOTE: ProxyAgent is imported lazily inside buildProxyAgent() to prevent
 * proxy-agent v8 from patching globalThis.fetch, which would break
 * LLM API calls in llm-gateway.js.
 */

import { URL } from 'url';
import { execFileSync } from 'child_process';

// Proxy pool — initialized from PROXY_URLS env var
let proxyIndex = 0;
let proxyPool = [];
let initialized = false;

export function setProxyPool(entries) {
  proxyPool = entries.map(e => typeof e === 'string' ? e : e.url);
  proxyIndex = 0;
  initialized = true;
  console.log(`[proxy] Pool set with ${proxyPool.length} proxy(ies): ${proxyPool.map(p => new URL(p).hostname).join(', ')}`);
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

function initProxyPool() {
  if (initialized) return;

  if (process.env.PROXY_URLS) {
    const urls = process.env.PROXY_URLS.split(',')
      .map(u => u.trim())
      .filter(Boolean);

    proxyPool = urls;
    console.log(`[proxy] Pool initialized with ${proxyPool.length} proxy(ies)`);
    for (const p of proxyPool) {
      const u = parseProxyUrl(p);
      console.log(`[proxy]   - ${u ? u.hostname : p}`);
    }
  } else {
    console.warn('[proxy] PROXY_URLS not set — using direct connection');
  }

  initialized = true;
}

async function curlFetch(url, proxyUrl, options = {}) {
  const u = parseProxyUrl(proxyUrl);
  const proxyHost = u?.hostname ?? proxyUrl;
  const proxyPort = u?.port ?? '80';
  const proxyScheme = u?.protocol === 'https:' ? 'https' : 'http';

  const args = ['-s', '--max-time', '90', '--proxy', `${proxyScheme}://${proxyHost}:${proxyPort}/`];

  if (u?.username && u?.password) {
    args.push('--proxy-user', `${u.username}:${u.password}`);
  }

  const headers = { ...options.headers };
  if (!headers['accept']) headers['accept'] = 'application/json';
  if (!headers['user-agent']) headers['user-agent'] = 'Mozilla/5.0';

  for (const [key, value] of Object.entries(headers)) {
    args.push('-H', `${key}: ${value}`);
  }

  args.push('-k', '--ipv4', url);

  try {
    const result = execFileSync('curl', args, { encoding: 'utf-8' });
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
    return {
      ok: false,
      status: 403,
      text: () => Promise.resolve(e.message),
      json: () => Promise.reject(e.message),
    };
  }
}

export async function proxiedFetch(url, options = {}) {
  initProxyPool();

  if (proxyPool.length === 0) {
    console.log(`[proxy] direct → ${url}`);
    return fetch(url, options);
  }

  const entry = proxyPool[proxyIndex % proxyPool.length];
  const u = parseProxyUrl(entry);
  console.log(`[proxy] ${u?.hostname ?? entry} → ${url}`);

  const curlRes = await curlFetch(url, entry, options);
  if (curlRes.ok) return curlRes;

  // Try next proxy in pool
  proxyIndex++;
  if (proxyIndex < proxyPool.length) {
    const nextEntry = proxyPool[proxyIndex % proxyPool.length];
    const nextU = parseProxyUrl(nextEntry);
    console.warn(`[proxy] ${u?.hostname ?? entry} failed (${curlRes.status}), trying ${nextU?.hostname ?? nextEntry}...`);
    const retryRes = await curlFetch(url, nextEntry, options);
    if (retryRes.ok) return retryRes;
  }

  throw new Error(`All proxies failed for ${url}`);
}
