/**
 * Admin Plans API
 * Tier configuration and plan management
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// Plan configurations (stored in code, could be moved to database)
const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'BRL',
    interval: 'monthly',
    features: [
      '50 lotes por mês',
      'Busca básica',
      'Sem Radar Copilot',
    ],
    limits: {
      lotsPerMonth: 50,
      copilotAccess: false,
      advancedFilters: false,
      watchlistLimit: 20,
    },
  },
  pro: {
    id: 'pro',
    name: 'Engineering B2B',
    price: 149,
    currency: 'BRL',
    interval: 'monthly',
    features: [
      'Lotes ilimitados',
      'Análise de editais',
      'Score de risco',
      'Filtros avançados',
      'Watchlist ilimitada',
      'Sem Radar Copilot',
    ],
    limits: {
      lotsPerMonth: -1, // unlimited
      copilotAccess: false,
      advancedFilters: true,
      watchlistLimit: -1,
    },
  },
  war_room: {
    id: 'war_room',
    name: 'War Room',
    price: 599,
    currency: 'BRL',
    interval: 'monthly',
    features: [
      'Tudo do Pro',
      'Radar Copilot completo',
      'Multi-usuários',
      'API access',
      'Suporte prioritário',
      'Relatórios personalizados',
    ],
    limits: {
      lotsPerMonth: -1,
      copilotAccess: true,
      advancedFilters: true,
      watchlistLimit: -1,
      apiAccess: true,
      prioritySupport: true,
    },
  },
} as const

// GET /api/admin/plans - List all plans
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
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

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', session.user.id)
      .single()

    if (!profile || profile.tier !== 'war_room') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 })
    }

    return NextResponse.json({
      plans: Object.values(PLANS),
    })
  } catch (error) {
    console.error('Plans GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/plans - Update plan configuration
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
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

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', session.user.id)
      .single()

    if (!profile || profile.tier !== 'war_room') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 })
    }

    const body = await request.json()
    const { planId, price, features } = body

    if (!planId || !(planId in PLANS)) {
      return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 })
    }

    // In a real implementation, this would update a database table
    // For now, we'll just return the updated plan configuration
    const plan = PLANS[planId as keyof typeof PLANS]

    const updatedPlan = {
      ...plan,
      ...(price !== undefined && { price }),
      ...(features && { features }),
    }

    // TODO: Store in database
    // await supabase.from('plans').upsert({ id: planId, ...updatedPlan })

    return NextResponse.json({
      plan: updatedPlan,
      message: 'Plan updated successfully',
    })
  } catch (error) {
    console.error('Plans PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/admin/plans/:id - Get specific plan
export async function GET_PLAN(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
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

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', session.user.id)
      .single()

    if (!profile || profile.tier !== 'war_room') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 })
    }

    const { id } = await params

    if (!(id in PLANS)) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    return NextResponse.json({
      plan: PLANS[id as keyof typeof PLANS],
    })
  } catch (error) {
    console.error('Plan GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
