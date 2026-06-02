/**
 * WebShare API client for proxy pool management.
 * API docs: https://apidocs.webshare.io/
 */

const WEBSHARE_BASE = 'https://proxy.webshare.io/api/v2';

function authHeaders() {
  const token = process.env.WEBSHARE_API_TOKEN;
  if (!token) throw new Error('WEBSHARE_API_TOKEN env var is not set');
  return { 'Authorization': `Token ${token}` };
}

export interface WebShareProxy {
  id: string;
  username: string;
  password: string;
  proxy_address: string;
  port: number;
  valid: boolean;
  last_verification: string;
  country_code: string;
  city_name: string;
  created_at: string;
}

export interface WebShareReplacement {
  id: number;
  state: 'validating' | 'validated' | 'processing' | 'completed' | 'failed';
  to_replace: { type: string; ip_addresses?: string[]; ip_ranges?: string[] };
  replace_with: Array<{ type: string; country_code?: string; count: number }>;
  dry_run: boolean;
  proxies_removed: number;
  proxies_added: number;
  reason: string;
  error_code: string | null;
  error: string | null;
  created_at: string;
  dry_run_completed_at: string | null;
  completed_at: string | null;
}

export async function listProxies(page = 1): Promise<WebShareProxy[]> {
  const res = await fetch(
    `${WEBSHARE_BASE}/proxy/list/?mode=direct&page_size=100&page=${page}`,
    { headers: authHeaders() }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WebShare list proxies failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.results ?? [];
}

export async function createReplacement(opts: {
  to_replace: { type: 'ip_address'; ip_addresses: string[] };
  replace_with: { type: 'any'; count: number };
  dry_run?: boolean;
}): Promise<WebShareReplacement> {
  const res = await fetch(`${WEBSHARE_BASE}/proxy/replacement/`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ dry_run: false, ...opts }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WebShare create replacement failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function getReplacementStatus(id: number): Promise<WebShareReplacement> {
  const res = await fetch(`${WEBSHARE_BASE}/proxy/replacement/${id}/`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WebShare get replacement failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function pollReplacement(id: number, timeoutMs = 300000): Promise<WebShareReplacement> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const replacement = await getReplacementStatus(id);
    if (replacement.state === 'completed' || replacement.state === 'failed') {
      return replacement;
    }
    // Wait 5 seconds before polling again
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error(`Replacement ${id} timed out after ${timeoutMs}ms`);
}