"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/lib/supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  tier: "free" | "pro" | "war_room";
  company?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from database
  const fetchUserProfile = async (supabaseUser: SupabaseUser | null) => {
    if (!supabaseUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", supabaseUser.id)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
        setUser(null);
      } else if (data) {
        setUser(data as UserProfile);
      } else {
        // Profile doesn't exist yet (trigger hasn't fired)
        // Wait a moment and try again
        setTimeout(() => fetchUserProfile(supabaseUser), 500);
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUserProfile(session?.user ?? null);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchUserProfile(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    console.log("=== SIGNOUT START ===");
    console.log("Supabase client:", supabase);

    try {
      // Check if Supabase client exists
      if (!supabase || !supabase.auth) {
        console.error("Supabase client not initialized!");
        window.location.href = "/login";
        return;
      }

      console.log("Calling supabase.auth.signOut()...");
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Error signing out:", error);
        // Force redirect even if signout fails
        window.location.href = "/login";
        return;
      }

      console.log("SignOut successful, clearing state...");
      // Clear any local state
      setUser(null);
      setLoading(false);

      console.log("Redirecting to /login...");
      // Redirect to login
      window.location.href = "/login";
    } catch (err) {
      console.error("Unexpected error during sign out:", err);
      // Force redirect as fallback
      console.log("Force redirecting to /login...");
      window.location.href = "/login";
    }

    console.log("=== SIGNOUT END ===");
  };

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await fetchUserProfile(session?.user ?? null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useUser() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useUser must be used within an AuthProvider");
  }
  return context;
}
