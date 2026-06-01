/**
 * LLM Gateway
 * Routes LLM requests to the correct provider based on task_type from llm_providers DB table.
 * Falls back to env vars LLM_API_KEY / LLM_PROVIDER for direct access.
 */

import { createClient } from '@supabase/supabase-js';
import https from 'node:https';

let _supabaseAdmin = null;

function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabaseAdmin;
}

// Cache provider lookups per task_type for 60 seconds
const providerCache = new Map();
const CACHE_TTL = 60_000;

async function getActiveProvider(taskType) {
  const now = Date.now();
  const cached = providerCache.get(taskType);

  if (cached && (now - cached.ts) < CACHE_TTL) {
    return cached.provider;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('llm_providers')
    .select('*')
    .eq('task_type', taskType)
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;

  const provider = data;
  providerCache.set(taskType, { provider, ts: now });
  return provider;
}

function buildHeaders(provider) {
  if (provider.provider_type === 'anthropic') {
    return {
      'x-api-key': provider.api_key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    };
  }
  // openai_compatible
  return {
    'Authorization': `Bearer ${provider.api_key}`,
    'content-type': 'application/json',
  };
}

function buildBody(provider, systemPrompt, userMessage) {
  if (provider.provider_type === 'anthropic') {
    return {
      model: provider.model,
      max_tokens: provider.max_tokens ?? 4096,
      temperature: provider.temperature ?? 0.7,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    };
  }
  // OpenAI compatible
  return {
    model: provider.model,
    max_tokens: provider.max_tokens ?? 4096,
    temperature: provider.temperature ?? 0.7,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: userMessage },
    ],
  };
}

function getEndpoint(provider) {
  if (!provider.base_url) {
    return provider.provider_type === 'anthropic'
      ? 'https://api.anthropic.com/v1/messages'
      : 'https://api.openai.com/v1/chat/completions';
  }
  // Strip trailing /v1 or /v1/ from base before appending path to avoid double-v1 URLs
  const base = provider.base_url.replace(/\/v1\/?$/, '');

  if (provider.provider_type === 'anthropic') {
    return `${base}/v1/messages`;
  }
  return `${base}/v1/chat/completions`;
}

/**
 * Call LLM with the active provider for the given task type.
 * Falls back to env var LLM_API_KEY if no DB provider is configured.
 *
 * NOTE: LLM API calls bypass the proxy since these are paid API endpoints
 * that should not be routed through scraping proxies.
 */
export async function llmCall(taskType, systemPrompt, userMessage, fallbackModel = null) {
  let provider = await getActiveProvider(taskType);

  // Fallback to env var credentials if no DB provider
  if (!provider) {
    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey || apiKey === 'placeholder') {
      throw new Error(`No active LLM provider for task "${taskType}" and LLM_API_KEY is not set. Configure a provider in /admin/llm or set LLM_API_KEY in .env`);
    }
    const providerType = process.env.LLM_PROVIDER ?? 'anthropic';
    provider = {
      provider_type: providerType,
      model: fallbackModel ?? (providerType === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o'),
      api_key: apiKey,
      base_url: null,
      max_tokens: 4096,
      temperature: 0.7,
    };
  }

  const endpoint = getEndpoint(provider);
  const headers = buildHeaders(provider);
  const body = buildBody(provider, systemPrompt, userMessage);

  // Use https module directly to bypass proxy-agent's patched global fetch
  const url = new URL(endpoint);
  const bodyStr = JSON.stringify(body);
  const opts = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      ...headers,
      'Content-Length': Buffer.byteLength(bodyStr),
      'Accept': 'application/json',
    },
  };

  const response = await new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: data, json: () => JSON.parse(data) });
      });
    });
    req.on('error', reject);
    req.setTimeout(60_000, () => { req.destroy(); reject(new Error('LLM request timeout')); });
    req.write(bodyStr);
    req.end();
  });

  if (!response.ok) {
    throw new Error(`LLM call failed (${response.status}): ${response.body.substring(0, 500)}`);
  }

  let result;
  try {
    result = response.json();
  } catch (e) {
    throw new Error(`LLM response not valid JSON (${response.status}): ${response.body.substring(0, 500)}`);
  }

  // Parse response based on provider type
  if (provider.provider_type === 'anthropic') {
    return {
      content: result.content?.[0]?.text ?? '',
      raw: result,
      provider: provider.name ?? 'anthropic',
      model: provider.model,
    };
  }
  // OpenAI compatible
  return {
    content: result.choices?.[0]?.message?.content ?? '',
    raw: result,
    provider: provider.name ?? 'openai-compatible',
    model: provider.model,
  };
}

/**
 * Invalidate the provider cache (useful if you update providers at runtime)
 */
export function invalidateProviderCache() {
  providerCache.clear();
}

export { getActiveProvider, getEndpoint, buildHeaders, buildBody };