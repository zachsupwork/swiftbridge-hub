/**
 * Morpho Markets Hook
 * 
 * Fetches Morpho Blue markets from API with caching and error handling.
 * Trusted asset allowlist sorts unknown/spam tokens to the bottom.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { fetchMorphoMarkets } from '@/lib/morpho/apiClient';
import { getEnabledMorphoChains, getMorphoChainConfig } from '@/lib/morpho/config';
import type { MorphoMarket, MorphoChainConfig } from '@/lib/morpho/types';

// Trusted asset symbols – markets with BOTH assets in this list sort first
const TRUSTED_SYMBOLS = new Set([
  'ETH', 'WETH', 'wstETH', 'stETH', 'rETH', 'cbETH',
  'USDC', 'USDT', 'DAI', 'FRAX', 'LUSD', 'PYUSD',
  'WBTC', 'tBTC',
  'AAVE', 'LINK', 'CRV',
  // common wrapped/derivative variants
  'sDAI', 'GHO', 'USDe', 'sUSDe', 'weETH', 'ezETH', 'osETH', 'COMP', 'MKR', 'UNI',
]);

export function isMarketTrusted(market: MorphoMarket): boolean {
  const loanOk = TRUSTED_SYMBOLS.has(market.loanAsset.symbol);
  const collateralOk = !market.collateralAsset || TRUSTED_SYMBOLS.has(market.collateralAsset.symbol);
  return loanOk && collateralOk;
}

export interface DebugReport {
  timestamp: string;
  selectedChainId: number | undefined;
  chainsEnabled: string[];
  subgraphUrl: string;
  marketsLoadedCount: number;
  first3MarketIds: string[];
  lastError: string | null;
  fetchDurationMs: number | null;
}

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
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>(1); // Default to Ethereum
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

        // Fetch from API
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
        } catch (chainError: unknown) {
          const errorMessage = chainError instanceof Error ? chainError.message : 'Unknown error';
          console.error(`[Morpho] Failed to fetch ${chain.label}:`, errorMessage);
          // Continue with other chains if one fails
          if (chainsToFetch.length === 1) {
            throw chainError; // Re-throw if this was the only chain
          }
        }
      }

      // Only update state if this is the latest fetch and component is still mounted
      if (currentFetchId === fetchIdRef.current && isMountedRef.current) {
        // Sort: trusted first, then by APY desc, then by TVL desc
        allMarkets.sort((a, b) => {
          const aTrusted = isMarketTrusted(a);
          const bTrusted = isMarketTrusted(b);
          if (aTrusted !== bTrusted) return aTrusted ? -1 : 1;
          // Primary: APY descending (normalize small decimals)
          const aApy = a.supplyApy > 0 && a.supplyApy <= 1.5 ? a.supplyApy * 100 : a.supplyApy;
          const bApy = b.supplyApy > 0 && b.supplyApy <= 1.5 ? b.supplyApy * 100 : b.supplyApy;
          if (bApy !== aApy) return bApy - aApy;
          // Secondary: TVL descending
          return b.totalSupplyUsd - a.totalSupplyUsd;
        });

        setMarkets(allMarkets);
        setLastFetched(Date.now());
        setFetchDurationMs(Date.now() - startTime);
        setError(null);

        console.log(`[Morpho] ✓ Loaded ${allMarkets.length} markets in ${Date.now() - startTime}ms`);
      }
    } catch (err: unknown) {
      console.error('[Morpho] Failed to fetch markets:', err);
      if (currentFetchId === fetchIdRef.current && isMountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch Morpho markets';
        setError(errorMessage);
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
    chainsEnabled: availableChains.map(c => c.label),
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
export type { MorphoMarket, MorphoChainConfig } from '@/lib/morpho/types';
