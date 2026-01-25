/**
 * Morpho Markets Hook
 * 
 * Fetches Morpho Blue markets from subgraph with caching and error handling.
 * No API key required - uses public subgraph.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { fetchMorphoMarkets, type MorphoMarket } from '@/lib/morphoSubgraph';
import { getEnabledMorphoChains, getMorphoChainConfig, type MorphoChainConfig } from '@/lib/morphoConfig';

export interface UseMorphoMarketsResult {
  markets: MorphoMarket[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  refresh: () => void;
  selectedChainId: number | undefined;
  setSelectedChainId: (chainId: number | undefined) => void;
  availableChains: MorphoChainConfig[];
  debugReport: DebugReport;
}

export interface DebugReport {
  timestamp: string;
  selectedChainId: number | undefined;
  rpcConfigured: boolean;
  subgraphUrl: string | null;
  marketsLoadedCount: number;
  first3MarketIds: string[];
  lastError: string | null;
  fetchDurationMs: number | null;
}

// In-memory cache per chainId
const marketCache = new Map<number, { markets: MorphoMarket[]; timestamp: number }>();
const CACHE_TTL_MS = 60000; // 1 minute cache

// Track if a fetch is in progress to prevent duplicates
let fetchInProgress = false;

export function useMorphoMarkets(): UseMorphoMarketsResult {
  const [markets, setMarkets] = useState<MorphoMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>(8453); // Default to Base
  const [fetchDurationMs, setFetchDurationMs] = useState<number | null>(null);
  
  const isMountedRef = useRef(true);
  const fetchIdRef = useRef(0);
  
  // Memoize available chains to prevent unnecessary re-renders
  const availableChains = useMemo(() => getEnabledMorphoChains(), []);

  const fetchMarkets = useCallback(async (forceRefresh = false) => {
    // Prevent duplicate fetches
    if (fetchInProgress && !forceRefresh) {
      console.log('[Morpho] Fetch already in progress, skipping...');
      return;
    }
    
    fetchInProgress = true;
    const currentFetchId = ++fetchIdRef.current;

    setLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      // Determine which chains to fetch
      const chainsToFetch = selectedChainId 
        ? [getMorphoChainConfig(selectedChainId)].filter(Boolean) as MorphoChainConfig[]
        : availableChains;

      if (chainsToFetch.length === 0) {
        throw new Error('No enabled chains configured');
      }

      const allMarkets: MorphoMarket[] = [];

      for (const chain of chainsToFetch) {
        // Check cache first (unless force refresh)
        if (!forceRefresh) {
          const cached = marketCache.get(chain.chainId);
          if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            console.log(`[Morpho] Using cached markets for ${chain.label} (${cached.markets.length} markets)`);
            allMarkets.push(...cached.markets);
            continue;
          }
        }

        // Fetch from subgraph
        try {
          console.log(`[Morpho] Fetching fresh markets for ${chain.label}...`);
          const chainMarkets = await fetchMorphoMarkets({
            chainId: chain.chainId,
            first: 50,
            skip: 0,
          });

          // Update cache
          marketCache.set(chain.chainId, {
            markets: chainMarkets,
            timestamp: Date.now(),
          });

          allMarkets.push(...chainMarkets);
        } catch (chainError: any) {
          console.error(`[Morpho] Failed to fetch ${chain.label}:`, chainError.message);
          // Continue with other chains if one fails
          if (chainsToFetch.length === 1) {
            throw chainError; // Re-throw if this was the only chain
          }
        }
      }

      // Only update state if this is the latest fetch and component is still mounted
      if (currentFetchId === fetchIdRef.current && isMountedRef.current) {
        // Sort by TVL (total supply) descending
        allMarkets.sort((a, b) => b.totalSupply - a.totalSupply);

        setMarkets(allMarkets);
        setLastFetched(Date.now());
        setFetchDurationMs(Date.now() - startTime);
        setError(null);

        console.log(`[Morpho] ✓ Loaded ${allMarkets.length} markets in ${Date.now() - startTime}ms`);
      }
    } catch (err: any) {
      console.error('[Morpho] Failed to fetch markets:', err);
      if (currentFetchId === fetchIdRef.current && isMountedRef.current) {
        setError(err.message || 'Failed to fetch Morpho markets');
        setFetchDurationMs(Date.now() - startTime);
      }
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        fetchInProgress = false;
      }
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [selectedChainId, availableChains]);

  // Fetch on mount and when chain changes
  useEffect(() => {
    isMountedRef.current = true;
    fetchMarkets();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchMarkets]);

  // Generate debug report
  const debugReport: DebugReport = useMemo(() => ({
    timestamp: new Date().toISOString(),
    selectedChainId,
    rpcConfigured: selectedChainId ? !!getMorphoChainConfig(selectedChainId) : availableChains.length > 0,
    subgraphUrl: 'https://api.morpho.org/graphql',
    marketsLoadedCount: markets.length,
    first3MarketIds: markets.slice(0, 3).map(m => m.id),
    lastError: error,
    fetchDurationMs,
  }), [selectedChainId, availableChains, markets, error, fetchDurationMs]);

  const refresh = useCallback(() => {
    fetchInProgress = false; // Reset to allow force refresh
    fetchMarkets(true);
  }, [fetchMarkets]);

  return {
    markets,
    loading,
    error,
    lastFetched,
    refresh,
    selectedChainId,
    setSelectedChainId,
    availableChains,
    debugReport,
  };
}

// Re-export types
export type { MorphoMarket } from '@/lib/morphoSubgraph';
export type { MorphoChainConfig } from '@/lib/morphoConfig';
