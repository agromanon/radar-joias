"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface WatchlistContextType {
  count: number;
  refreshCount: () => Promise<void>;
  isLoading: boolean;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCount = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/watchlist');
      if (response.ok) {
        const data = await response.json();
        setCount(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Error fetching watchlist count:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCount();

    // Refresh every 30 seconds as fallback
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const value: WatchlistContextType = {
    count,
    refreshCount: fetchCount,
    isLoading,
  };

  return (
    <WatchlistContext.Provider value={value}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const context = useContext(WatchlistContext);
  if (context === undefined) {
    throw new Error('useWatchlist must be used within a WatchlistProvider');
  }
  return context;
}
