/**
 * Proxy (Next.js 16: formerly middleware.ts)
 * Route protection and authentication checks
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

const protectedRoutes = ['/dashboard', '/watchlist', '/alertas', '/mapa', '/settings', '/copilot']
const adminRoutes = ['/admin']
const authRoutes = ['/login', '/register']

export async function proxy(request: NextRequest) {
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
            // This is fine - the cookie will be set on the client side
          }
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const pathname = request.nextUrl.pathname

  // Check if user is authenticated
  const isAuthenticated = !!session
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))

  // Redirect unauthenticated users from protected routes to login
  if (isProtectedRoute && !isAuthenticated) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect authenticated users from auth routes to dashboard
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // For admin routes, check user tier
  if (isAdminRoute && isAuthenticated) {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier')
        .eq('id', session.user.id)
        .single()

      const isAdmin = profile?.tier === 'war_room'

      if (!isAdmin) {
        // Non-admin users trying to access admin routes
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    } catch (error) {
      // If we can't verify admin status, redirect to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Check Copilot access (War Room tier only)
  if (pathname.startsWith('/copilot') && isAuthenticated) {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier')
        .eq('id', session.user.id)
        .single()

      const canAccessCopilot = profile?.tier === 'war_room'

      if (!canAccessCopilot) {
        // Redirect to settings with upgrade message
        return NextResponse.redirect(new URL('/settings/billing?upgrade=copilot', request.url))
      }
    } catch (error) {
      // If we can't verify tier, block access
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

// Configure which routes the proxy should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes that handle their own auth
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
