/**
 * Auth Client Library
 * Centralized Supabase Auth operations for client-side components
 */

import { createBrowserClient } from '@supabase/ssr'

/**
 * Create a browser Supabase client for client-side auth operations
 */
function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * Sign in with email and password
 * @param email User email
 * @param password User password
 * @returns Promise with signIn response or error
 */
export async function signIn(email: string, password: string) {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return {
      success: false,
      error: error.message,
      code: error.name,
    }
  }

  return {
    success: true,
    data,
  }
}

/**
 * Sign up with email, password, and name
 * Creates user account and user profile
 * @param email User email
 * @param password User password (min 6 chars)
 * @param name User display name
 * @returns Promise with signUp response or error
 */
export async function signUp(email: string, password: string, name: string) {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  })

  if (error) {
    return {
      success: false,
      error: error.message,
      code: error.name,
    }
  }

  // Profile is automatically created by the database trigger handle_new_user()
  return {
    success: true,
    data,
  }
}

/**
 * Sign out current user
 * @returns Promise with success status or error
 */
export async function signOut() {
  const supabase = createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  return {
    success: true,
  }
}

/**
 * Send password reset email
 * @param email User email
 * @returns Promise with success status or error
 */
export async function resetPassword(email: string) {
  const supabase = createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/settings/security`,
  })

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  return {
    success: true,
  }
}

/**
 * Sign in with Google OAuth
 * Redirects to Google OAuth consent screen
 */
export async function signInWithGoogle() {
  const supabase = createClient()

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  return {
    success: true,
  }
}

/**
 * Sign in with Apple OAuth
 * Redirects to Apple OAuth consent screen
 */
export async function signInWithApple() {
  const supabase = createClient()

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  return {
    success: true,
  }
}

/**
 * Update user profile in database
 * @param userId User ID from auth
 * @param data Profile data to update
 * @returns Promise with success status or error
 */
export async function updateProfile(
  userId: string,
  data: {
    name?: string
    company?: string
    avatar_url?: string
  }
) {
  const supabase = createClient()

  const { error } = await supabase
    .from('user_profiles')
    .update(data)
    .eq('id', userId)

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  return {
    success: true,
  }
}

/**
 * Get current session
 * @returns Current session or null
 */
export async function getSession() {
  const supabase = createClient()

  const { data: { session } } = await supabase.auth.getSession()

  return session
}

/**
 * Get current user from session
 * @returns Current user or null
 */
export async function getCurrentUser() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  return user
}
