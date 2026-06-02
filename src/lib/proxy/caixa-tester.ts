/**
 * Tests a proxy against CAIXA's API to determine if it's blocked.
 * Makes a request to /busca/ufs through the proxy and checks if
 * it returns valid JSON with the expected state list.
 */

import { HttpsProxyAgent } from 'https-proxy-agent';

const CAIXA_TEST_URL = 'https://servicebus2.caixa.gov.br/vitrinedejoias/api/busca/ufs';

const CAIXA_HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
  origin: 'https://vitrinedejoias.caixa.gov.br',
  referer: 'https://vitrinedejoias.caixa.gov.br/',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
};

export interface ProxyTestResult {
  valid: boolean;
  durationMs: number;
  error?: string;
  responseCode?: number;
}

export async function testProxyAgainstCaixa(proxyUrl: string): Promise<ProxyTestResult> {
  const start = Date.now();
  try {
    const agent = new HttpsProxyAgent(proxyUrl);
    const res = await fetch(CAIXA_TEST_URL, {
      headers: CAIXA_HEADERS,
      agent,
      signal: AbortSignal.timeout(15000),
    });

    const durationMs = Date.now() - start;

    if (!res.ok) {
      return { valid: false, durationMs, error: `HTTP ${res.status}`, responseCode: res.status };
    }

    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { valid: false, durationMs, error: 'Non-JSON response', responseCode: res.status };
    }

    // Valid CAIXA response: array of objects with "sigla" field
    const isValid =
      Array.isArray(json) &&
      json.length > 0 &&
      typeof json[0] === 'object' &&
      json[0] !== null &&
      'sigla' in (json[0] as Record<string, unknown>);

    return {
      valid: isValid,
      durationMs,
      responseCode: res.status,
      error: isValid ? undefined : 'Invalid JSON structure (expected array of state objects with sigla field)',
    };
  } catch (e) {
    const err = e as Error & { code?: string };
    let errorMessage = err.message;
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      errorMessage = `Connection failed: ${err.code}`;
    } else if (err.name === 'TimeoutError') {
      errorMessage = 'Request timed out after 15s';
    }
    return { valid: false, durationMs: Date.now() - start, error: errorMessage };
  }
}