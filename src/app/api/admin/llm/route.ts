/**
 * Admin LLM Providers API
 * CRUD operations for LLM provider management
 */

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/admin/llm - List all providers
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()

    // Verify admin access using anon key
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
              // In certain Edge Runtime environments, cookies cannot be set
            }
          },
        },
      }
    )

    const { data: { session } } = await authSupabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await authSupabase
      .from('user_profiles')
      .select('tier')
      .eq('id', session.user.id)
      .single()

    if (!profile || profile.tier !== 'war_room') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 })
    }

    // Use service role key for reading providers
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: providers, error } = await supabaseAdmin
      .from('llm_providers')
      .select('*')
      .order('priority', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ providers })
  } catch (error) {
    console.error('LLM providers GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/llm - Create new provider
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
    const { name, provider_type, base_url, model, api_key, is_active, is_fallback, priority, max_tokens, temperature, task_type } = body

    if (!name || !provider_type || !model || !api_key) {
      return NextResponse.json({ error: 'Name, provider type, model, and API key are required' }, { status: 400 })
    }

    if (task_type && !['enrich', 'edital', 'results', 'chat'].includes(task_type)) {
      return NextResponse.json({ error: 'task_type must be one of: enrich, edilal, results, chat' }, { status: 400 })
    }

    // Use service role key for creating provider
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabaseAdmin
      .from('llm_providers')
      .insert({
        name,
        provider_type,
        base_url: base_url || null,
        model,
        api_key,
        is_active: is_active ?? true,
        is_fallback: is_fallback ?? false,
        priority: priority ?? 0,
        max_tokens: max_tokens || 4096,
        temperature: temperature || 0.7,
        task_type: task_type || 'enrich',
      })
      .select()
      .single()

    if (error) {
      console.error('LLM provider creation error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ provider: data })
  } catch (error) {
    console.error('LLM providers POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/llm - Update provider
export async function PATCH(request: NextRequest) {
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
    const { providerId, ...updateData } = body

    if (!providerId) {
      return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 })
    }

    if (updateData.task_type && !['enrich', 'edital', 'results', 'chat'].includes(updateData.task_type)) {
      return NextResponse.json({ error: 'task_type must be one of: enrich, edilal, results, chat' }, { status: 400 })
    }

    // Use service role key for updating provider
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabaseAdmin
      .from('llm_providers')
      .update(updateData)
      .eq('id', providerId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ provider: data })
  } catch (error) {
    console.error('LLM providers PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/llm - Delete provider
export async function DELETE(request: NextRequest) {
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

    // Use service role key for deleting provider
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabaseAdmin
      .from('llm_providers')
      .delete()
      .eq('id', providerId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('LLM providers DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
