/**
 * POST /api/lots/[id]/analyze
 * Premium tool-calling agent for lot analysis (costs 1 credit)
 *
 * The agent has access to tools for querying market data:
 * - find_similar_sold_lots: finds comparable sold lots
 * - get_price_statistics: gets price stats for a category/karat
 * - get_auctioneer_history: gets auctioneer performance data
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import https from 'node:https'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  )
}

const ANALYZE_COST = 1

// ============================================================
// TOOLS — each tool returns data the LLM can reason over
// ============================================================

async function findSimilarSoldLots(supabase: any, params: { karat?: string; category?: string; limit?: number }) {
  const { karat, category, limit = 5 } = params
  let query = supabase
    .from('lots')
    .select('id, de_contrato, winning_bid_value, peso_lote, sg_uf, karat, cities(name)')
    .eq('was_sold', true)
    .not('winning_bid_value', 'is', null)
    .limit(limit)
    .order('first_seen_at', { ascending: false })

  if (karat) query = query.eq('karat', karat)
  if (category) query = query.ilike('category', `%${category}%`)

  const { data, error } = await query
  if (error || !data?.length) return { found: false, lots: [], message: 'No similar sold lots found' }

  const stats = data.map((l: any) => l.winning_bid_value)
  return {
    found: true,
    lots: data.map((l: any) => ({
      description: l.de_contrato?.substring(0, 60),
      price: l.winning_bid_value,
      weight: l.peso_lote,
      location: `${(l.cities as any)?.name ?? '—'}, ${l.sg_uf}`,
    })),
    price_range: { min: Math.min(...stats), max: Math.max(...stats), avg: stats.reduce((a: number, b: number) => a + b, 0) / stats.length },
    message: `Found ${data.length} similar sold lots`,
  }
}

async function getPriceStatistics(supabase: any, params: { karat?: string; state?: string }) {
  const { karat, state } = params
  let query = supabase
    .from('lots')
    .select('winning_bid_value, valor')
    .eq('was_sold', true)
    .not('winning_bid_value', 'is', null)

  if (karat) query = query.eq('karat', karat)
  if (state) query = query.eq('sg_uf', state)

  const { data, error } = await query
  if (error || !data?.length) return { available: false, message: 'No price data available' }

  const prices = data.map((l: any) => l.winning_bid_value).filter(Boolean)
  const sorted = [...prices].sort((a, b) => a - b)
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)]

  return {
    available: true,
    count: prices.length,
    median,
    average: prices.reduce((a: number, b: number) => a + b, 0) / prices.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
    message: `Based on ${prices.length} sales`,
  }
}

async function getAuctioneerHistory(supabase: any, centralizerName: string | null) {
  if (!centralizerName) return { available: false, message: 'No auctioneer data available' }

  const { data, error } = await supabase
    .from('auctions')
    .select('auction_code, total_lots_sold, avg_winning_bid, min_winning_bid, max_winning_bid, result_date')
    .ilike('centralizer_unit', `%${centralizerName}%`)
    .not('total_lots_sold', 'is', null)
    .order('result_date', { ascending: false })
    .limit(5)

  if (error || !data?.length) return { available: false, message: `No history for auctioneer: ${centralizerName}` }

  return {
    available: true,
    auctions: data.map((a: any) => ({
      code: a.auction_code,
      date: a.result_date,
      lots_sold: a.total_lots_sold,
      avg_price: a.avg_winning_bid,
    })),
    message: `Found ${data.length} auctions by this auctioneer`,
  }
}

// Tool definitions for the LLM
const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'find_similar_sold_lots',
      description: 'Find recently sold lots similar to the one being analyzed. Use this to get market reference prices. Parameters: karat (optional), category (optional), limit (optional, default 5)',
      parameters: {
        type: 'object',
        properties: {
          karat: { type: 'string', description: 'Gold karatage, e.g. "18k", "14k"' },
          category: { type: 'string', description: 'Category type, e.g. "ouro", "prata", "relogio"' },
          limit: { type: 'integer', description: 'Max results to return (default 5)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_price_statistics',
      description: 'Get aggregate price statistics for a karat or location. Use to understand market ranges. Parameters: karat (optional), state (optional)',
      parameters: {
        type: 'object',
        properties: {
          karat: { type: 'string', description: 'Gold karatage' },
          state: { type: 'string', description: 'State UF code, e.g. "SP", "RJ"' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_auctioneer_history',
      description: 'Get historical performance data for an auctioneer/centralizer. Use to assess auctioneer reliability and pricing patterns.',
      parameters: {
        type: 'object',
        properties: {
          centralizer_name: { type: 'string', description: 'The centralizer/auctioneer name' },
        },
      },
    },
  },
]

const TOOL_MAP: Record<string, Function> = {
  find_similar_sold_lots: findSimilarSoldLots,
  get_price_statistics: getPriceStatistics,
  get_auctioneer_history: getAuctioneerHistory,
}

// ============================================================
// LLM CALL with function calling support
// ============================================================

async function llmCallWithTools(
  supabase: any,
  messages: any[],
  tools: any[],
  model: string = 'deepseek-chat'
) {
  // Get provider from DB or use env fallback
  const adminClient = createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) as string,
    (process.env.SUPABASE_SERVICE_ROLE_KEY) as string
  )

  const { data: provider } = await adminClient
    .from('llm_providers')
    .select('*')
    .eq('task_type', 'enrich')
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .limit(1)
    .single()

  const apiKey = provider?.api_key ?? process.env.LLM_API_KEY
  const baseUrl = provider?.base_url ?? 'https://api.deepseek.com'
  const modelName = provider?.model ?? model

  const body = {
    model: modelName,
    messages,
    tools,
    tool_choice: 'auto',
    temperature: 0.3,
    max_tokens: 2048,
  }

  const url = new URL(`${baseUrl.replace(/\/v1\/?$/, '')}/v1/chat/completions`)
  const bodyStr = JSON.stringify(body)

  const response = await new Promise<any>((resolve, reject) => {
    const opts = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }
    const req = https.request(opts, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300, status: res.statusCode ?? 0, body: data }))
    })
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })

  if (!response.ok) {
    throw new Error(`LLM call failed (${response.status}): ${response.body.substring(0, 300)}`)
  }

  return JSON.parse(response.body)
}

// ============================================================
// Credits helpers
// ============================================================

async function getUserCredits(supabase: any, userId: string) {
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('id, credits_remaining')
    .eq('user_id', userId)
    .maybeSingle()

  return { credits: sub?.credits_remaining ?? 0, subscriptionId: sub?.id ?? null }
}

async function deductCredit(supabase: any, userId: string, subscriptionId: string | null, lotId: string) {
  if (subscriptionId) {
    const newCredits = Math.max(0, (await getUserCredits(supabase, userId)).credits - ANALYZE_COST)
    await supabase
      .from('user_subscriptions')
      .update({ credits_remaining: newCredits })
      .eq('id', subscriptionId)
  }

  await supabase.from('credit_ledger').insert({
    user_id: userId,
    subscription_id: subscriptionId,
    amount: ANALYZE_COST,
    operation_type: 'debit',
    description: `Lot analysis: ${lotId}`,
  })

  return (await getUserCredits(supabase, userId)).credits
}

// ============================================================
// Main route
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lotId } = await params
    const supabase = await createServerClient()

    // Get user (optional auth for now — allow unauthenticated with a message)
    const authHeader = request.headers.get('authorization')
    let userId: string | null = null
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id ?? null
    }

    // Get lot details
    const { data: lot, error: lotError } = await supabase
      .from('lots')
      .select('*, cities(name, states(uf)), auctions(auction_code, centralizer_unit)')
      .eq('id', lotId)
      .maybeSingle()

    if (lotError || !lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 })
    }

    // Check credits if user is logged in
    let remainingCredits: number | null = null
    if (userId) {
      const adminClient = getAdminClient()
      const { credits, subscriptionId } = await getUserCredits(adminClient, userId)
      if (credits < ANALYZE_COST) {
        return NextResponse.json({
          error: 'Insufficient credits',
          credits_required: ANALYZE_COST,
          credits_available: credits,
          upgrade_url: '/pricing',
          message: 'You need more credits. Upgrade your plan for monthly credits.',
        }, { status: 402 })
      }
      remainingCredits = await deductCredit(adminClient, userId, subscriptionId, lotId)
    }

    // Build system prompt with tool descriptions
    const systemPrompt = `You are an expert jewelry and auction analyst for Brazilian CAIXA jewelry auctions.

You have access to tools to query live market data. Use them to provide evidence-based analysis.

For each lot, your analysis should cover:
1. **Item Assessment**: Metal type, karatage, weight, gemstone status
2. **Risk Flags**: Any conditions that reduce value (enchimento, low karat, damage, etc.)
3. **Market Context**: Compare against similar sold lots and price statistics
4. **Bid Recommendation**: Suggested strategy based on market data and starting price
5. **Red Flags**: Signs of overpricing, missing info, or concerns

Be specific. Use the tool data to back your recommendations.`

    // Initial user message with lot data
    const auction = (lot.auctions as any)
    const userMessage = `Analyze this lot:

**Lot**: ${lot.de_contrato ?? 'N/A'}
**Starting Bid**: R$ ${lot.valor ?? 0}
**Weight**: ${lot.peso_lote ?? 'Not specified'}
**Karat**: ${lot.karat ?? 'Not specified'}
**Category**: ${lot.category ?? 'Not specified'}
**Location**: ${(lot.cities as any)?.name ?? '—'}, ${lot.sg_uf}
**Centralizer**: ${lot.centralizer_name ?? auction?.centralizer_unit ?? '—'}
**Auction**: ${auction?.auction_code ?? lot.co_leilao}

**Condition Flags**:
${lot.has_enchimento ? '⚠️ ENCHIMENTO (fillers) — may inflate weight, affects gold purity' : ''}
${lot.has_low_karat ? '⚠️ Low karat gold (below 18k)' : ''}
${lot.has_unvalued_stones ? '⚠️ Gemstones not valued by auctioneer' : ''}
${lot.is_watch_stopped ? '⚠️ Watch is stopped/not working' : ''}
${lot.is_broken ? '⚠️ Item is broken' : ''}
${lot.is_incomplete ? '⚠️ Item is incomplete/missing parts' : ''}
${lot.is_damaged ? '⚠️ Item has damage' : ''}
${lot.has_mixed_metals ? '⚠️ Mixed metals' : ''}
${lot.is_folheado ? '⚠️ Gold plated (folheado) — not solid gold' : ''}
${lot.has_rhodium_plating ? '⚠️ Rhodium plated' : ''}
${lot.is_coin ? '⚠️ Coin — verify authenticity' : ''}
${lot.is_bar ? '⚠️ Bar — verify authenticity' : ''}
${lot.is_watch ? '⚠️ Watch included' : ''}
${lot.is_montblanc_pen ? '⚠️ Montblanc pen' : ''}

Use your tools to find similar sold lots and price statistics to support your analysis.`

    // Agent loop: call LLM, execute tools, repeat until done
    const MAX_TURNS = 5
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ]

    let finalText = ''
    let turns = 0

    while (turns < MAX_TURNS) {
      turns++
      const response = await llmCallWithTools(supabase, messages, TOOL_DEFINITIONS)

      const choice = response.choices?.[0]
      const msg = choice?.message

      if (!msg) break

      // If no tool calls, this is the final response
      if (!msg.tool_calls?.length) {
        finalText = msg.content ?? ''
        break
      }

      // Add assistant message with tool calls
      messages.push(msg)

      // Execute each tool call and add results
      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name
        const toolArgs = JSON.parse(tc.function.arguments || '{}')
        const toolFn = TOOL_MAP[toolName]

        if (!toolFn) {
          messages.push({ role: 'tool', tool_call_id: tc.id, content: `Error: Unknown tool ${toolName}` })
          continue
        }

        try {
          let result
          if (toolName === 'find_similar_sold_lots') {
            result = await toolFn(supabase, toolArgs)
          } else if (toolName === 'get_price_statistics') {
            result = await toolFn(supabase, toolArgs)
          } else if (toolName === 'get_auctioneer_history') {
            result = await toolFn(supabase, toolArgs.centralizer_name)
          }

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          })
        } catch (e: any) {
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: `Error: ${e.message}`,
          })
        }
      }
    }

    if (!finalText) {
      finalText = 'Analysis completed but no response generated.'
    }

    return NextResponse.json({
      analysis: finalText,
      turns_used: turns,
      credits_remaining: remainingCredits,
    })

  } catch (error: any) {
    console.error('Lot analyze error:', error)
    return NextResponse.json({
      error: 'Analysis failed',
      details: error.message,
    }, { status: 500 })
  }
}