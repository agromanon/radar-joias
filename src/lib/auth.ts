import { createServerClient } from "./supabase-server";
import type { UserProfile } from "@/hooks/useUser";

/**
 * Get the current authenticated user from the request
 * This is used in API routes to authenticate users
 *
 * DEV MODE: Returns a mock user when no real authentication exists
 * This allows UI development without full Supabase setup
 */
export async function getServerUser(): Promise<UserProfile | null> {
  try {
    // Use server-side Supabase client
    const supabase = await createServerClient();

    // Get the session from Supabase
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      // DEV MODE: Return mock user for UI development
      // Remove this block when implementing real authentication
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️  Using mock user in development mode - implement real Supabase Auth for production');
        return {
          id: 'mock-user-id',
          name: 'Development User',
          email: 'dev@example.com',
          avatar_url: undefined,
          tier: 'war_room', // Full access for development
          company: 'Dev Company'
        } as UserProfile;
      }
      return null;
    }

    // Fetch user profile
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      console.error("Error fetching user profile:", error);
      return null;
    }

    return data as UserProfile;
  } catch (error) {
    console.error("Error in getServerUser:", error);
    return null;
  }
}

/**
 * Check if user has required tier
 * @param user - The user profile
 * @param requiredTier - Minimum required tier
 * @returns true if user has required tier or higher
 */
export function hasRequiredTier(
  user: UserProfile | null,
  requiredTier: "free" | "pro" | "war_room"
): boolean {
  if (!user) return false;

  const tierHierarchy = { free: 0, pro: 1, war_room: 2 };
  return tierHierarchy[user.tier] >= tierHierarchy[requiredTier];
}

/**
 * Protect API routes by tier
 * Throws an error if user doesn't have required tier
 */
export function requireTier(
  user: UserProfile | null,
  requiredTier: "free" | "pro" | "war_room"
): void {
  if (!user) {
    throw new Error("Unauthorized - user not found");
  }

  if (!hasRequiredTier(user, requiredTier)) {
    throw new Error(
      `Forbidden - ${requiredTier} tier or higher required`
    );
  }
}

/**
 * Check if user can access Radar Copilot
 * War Room tier only
 */
export function canAccessCopilot(user: UserProfile | null): boolean {
  return hasRequiredTier(user, "war_room");
}

/**
 * Check if user can access AI features (edict analysis)
 * Pro and War Room tiers
 */
export function canAccessAI(user: UserProfile | null): boolean {
  return hasRequiredTier(user, "pro");
}

/**
 * Calculate lot access limit based on tier
 * Free: 50 lots/month, Pro: unlimited, War Room: unlimited
 */
export function getLotAccessLimit(user: UserProfile | null): number {
  if (!user) return 0;

  switch (user.tier) {
    case "free":
      return 50;
    case "pro":
    case "war_room":
      return -1; // Unlimited
    default:
      return 50;
  }
}
