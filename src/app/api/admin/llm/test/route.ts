/**
 * Test LLM Provider Connection
 * POST /api/admin/llm/test
 */

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()

    // Verify admin access
    const authSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch (error) {
              // Ignore
            }
          },
        },
      }
    )

    const { data: { session } } = await authSupabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await authSupabase
      .from('user_profiles')
      .select('tier')
      .eq('id', session.user.id)
      .single()

    if (!profile || profile.tier !== 'war_room') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 })
    }

    const body = await request.json()
    const { providerId } = body

    if (!providerId) {
      return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 })
    }

    // Get provider configuration
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: provider } = await supabaseAdmin
      .from('llm_providers')
      .select('*')
      .eq('id', providerId)
      .single()

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    // Test connection based on provider type
    const testResult = await testLLMConnection(provider)

    return NextResponse.json({
      success: testResult.success,
      provider: provider.name,
      result: testResult
    })

  } catch (error: any) {
    console.error('LLM test error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

async function testLLMConnection(provider: any): Promise<any> {
  const { provider_type, base_url, model, api_key } = provider

  try {
    if (provider_type === 'anthropic') {
      // Test Anthropic API (including MiniMax which is Anthropic-compatible)
      const baseUrl = base_url || 'https://api.anthropic.com'

      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': api_key,
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      })

      if (response.ok) {
        const data = await response.json()
        return {
          success: true,
          message: 'Connection successful',
          model: data.model,
          usage: data.usage
        }
      } else {
        const error = await response.text()
        return {
          success: false,
          message: 'API request failed',
          status: response.status,
          error: error
        }
      }

    } else if (provider_type === 'openai_compatible') {
      // Test OpenAI-compatible API
      const baseUrl = base_url || 'https://api.openai.com/v1'
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${api_key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10
        })
      })

      if (response.ok) {
        const data = await response.json()
        return {
          success: true,
          message: 'Connection successful',
          model: data.model,
          usage: data.usage
        }
      } else {
        const error = await response.text()
        return {
          success: false,
          message: 'API request failed',
          status: response.status,
          error: error
        }
      }
    }

    return {
      success: false,
      message: 'Unknown provider type'
    }

  } catch (error: any) {
    return {
      success: false,
      message: 'Connection error',
      error: error.message
    }
  }
}
