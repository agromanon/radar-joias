/**
 * Admin Users API
 * CRUD operations for user management with pagination and filtering
 */

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/admin/users - Create new user
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()

    // First, verify admin access using anon key
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

    const body = await request.json()
    const { email, password, name, tier } = body

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 })
    }

    // Create user in Supabase Auth (still using anon key for auth operations)
    const { data: authData, error: authError } = await authSupabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        }
      }
    })

    if (authError) {
      console.error('Auth signup error:', authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 400 })
    }

    // Create admin client with service role key for profile creation
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Create user profile with admin privileges
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email: authData.user.email!,
        name,
        tier: tier || 'free',
        company: null,
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name,
        tier: tier || 'free',
      }
    })
  } catch (error) {
    console.error('Users POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/admin/users - List users with pagination and filtering
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

    const searchParams = await request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = await searchParams.get('search') || ''
    const tier = await searchParams.get('tier') || ''

    // Build query
    let query = supabase
      .from('user_profiles')
      .select('*', { count: 'exact' })

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    if (tier && tier !== 'all') {
      query = query.eq('tier', tier)
    }

    // Get total count before pagination
    const { count: totalCount } = await query

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: users, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Users GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/users - Update user tier or profile
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies()

    // First, verify admin access using anon key
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

    const body = await request.json()
    const { userId, tier, name, company } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const updateData: any = {}
    if (tier) updateData.tier = tier
    if (name) updateData.name = name
    if (company !== undefined) updateData.company = company

    // Create admin client with service role key for updates
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ user: data })
  } catch (error) {
    console.error('Users PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/users - Delete user
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()

    // First, verify admin access using anon key
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

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Create admin client with service role key for privileged operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log('Attempting to delete user with id:', userId)

    // First, delete the user from Supabase Auth using admin API
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      console.error('Auth user deletion error:', authDeleteError)
      return NextResponse.json({ error: authDeleteError.message }, { status: 400 })
    }

    console.log('Auth user deleted successfully')

    // Note: Deleting from auth.users should cascade to user_profiles if foreign key is set up
    // If not, we also need to delete from user_profiles
    const { error: profileDeleteError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', userId)

    if (profileDeleteError) {
      console.error('Profile deletion error:', profileDeleteError)
      // Don't fail if profile already deleted by cascade
      if (!profileDeleteError.message.includes('duplicate')) {
        return NextResponse.json({ error: profileDeleteError.message }, { status: 400 })
      }
    }

    console.log('User deleted successfully from database')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Users DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
