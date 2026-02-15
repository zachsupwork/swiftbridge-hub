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

// Trusted asset symbols – fallback if API doesn't provide whitelisted field
const TRUSTED_SYMBOLS = new Set([
  'ETH', 'WETH', 'wstETH', 'stETH', 'rETH', 'cbETH',
  'USDC', 'USDT', 'DAI', 'FRAX', 'LUSD', 'PYUSD',
  'WBTC', 'tBTC', 'cbBTC',
  'AAVE', 'LINK', 'CRV',
  'sDAI', 'GHO', 'USDe', 'sUSDe', 'weETH', 'ezETH', 'osETH', 'COMP', 'MKR', 'UNI',
]);

// Popular / blue-chip assets get a small TVL boost in sorting
const POPULAR_SYMBOLS = new Set(['ETH', 'WETH', 'USDC', 'USDT', 'DAI', 'WBTC', 'cbBTC']);
const POPULARITY_BOOST_USD = 50_000_000; // $50M virtual boost for sorting only

/**
 * A market is "trusted" if the API marks it as whitelisted,
 * or if both assets are well-known symbols (fallback).
 */
export function isMarketTrusted(market: MorphoMarket): boolean {
  // Prefer API whitelisted flag
  if (market.whitelisted) return true;
  // Fallback: check symbols
  const loanOk = TRUSTED_SYMBOLS.has(market.loanAsset.symbol);
  const collateralOk = !market.collateralAsset || TRUSTED_SYMBOLS.has(market.collateralAsset.symbol);
  return loanOk && collateralOk;
}

/** Clamp APY to a sane max (300%) to prevent API glitches dominating sort */
function clampApy(apy: number): number {
  if (!Number.isFinite(apy) || apy < 0) return 0;
  const normalized = apy > 0 && apy <= 1.5 ? apy * 100 : apy;
  return Math.min(normalized, 300);
}

/** Get effective TVL for sorting (with popularity boost for verified markets) */
function getSortTvl(market: MorphoMarket, trusted: boolean): number {
  const tvl = Number.isFinite(market.totalSupplyUsd) ? market.totalSupplyUsd : 0;
  if (!trusted) return tvl;
  const hasPopular = POPULAR_SYMBOLS.has(market.loanAsset.symbol) ||
    (market.collateralAsset && POPULAR_SYMBOLS.has(market.collateralAsset.symbol));
  return hasPopular ? tvl + POPULARITY_BOOST_USD : tvl;
}

/**
 * Sort markets: Verified first (by TVL desc, then APY desc), Unverified last.
 * Stable alphabetical tiebreaker.
 */
export function sortMarkets(markets: MorphoMarket[]): MorphoMarket[] {
  return [...markets].sort((a, b) => {
    const aTrusted = isMarketTrusted(a);
    const bTrusted = isMarketTrusted(b);
    // 1) Verified before unverified
    if (aTrusted !== bTrusted) return aTrusted ? -1 : 1;
    // 2) TVL descending (with popularity boost for verified)
    const aTvl = getSortTvl(a, aTrusted);
    const bTvl = getSortTvl(b, bTrusted);
    if (bTvl !== aTvl) return bTvl - aTvl;
    // 3) APY descending
    const aApy = clampApy(a.supplyApy);
    const bApy = clampApy(b.supplyApy);
    if (bApy !== aApy) return bApy - aApy;
    // 4) Alphabetical tiebreaker
    return a.loanAsset.symbol.localeCompare(b.loanAsset.symbol);
  });
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
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>(undefined); // Default: all enabled chains
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

      // Fetch from ALL chains in parallel (not sequentially)
      const fetchPromises = chainsToFetch.map(async (chain) => {
        // Check cache first (unless force refresh)
        if (!forceRefresh) {
          const cached = marketCache.get(chain.chainId);
          if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            console.log(`[Morpho] Using cached markets for ${chain.label} (${cached.markets.length} markets)`);
            return cached.markets;
          }
        }

        // Fetch from API
        console.log(`[Morpho] Fetching fresh markets for ${chain.label}...`);
        const chainMarkets = await fetchMorphoMarkets({
          chainId: chain.chainId,
        });

        // Update cache
        marketCache.set(chain.chainId, {
          markets: chainMarkets,
          timestamp: Date.now(),
        });

        return chainMarkets;
      });

      const results = await Promise.allSettled(fetchPromises);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const chain = chainsToFetch[i];
        if (result.status === 'fulfilled') {
          allMarkets.push(...result.value);
        } else {
          console.error(`[Morpho] Failed to fetch ${chain.label}:`, result.reason);
          if (chainsToFetch.length === 1) {
            throw result.reason;
          }
        }
      }

      // Only update state if this is the latest fetch and component is still mounted
      if (currentFetchId === fetchIdRef.current && isMountedRef.current) {
        // Defensive dedupe by chainId+uniqueKey across all chains
        const seen = new Set<string>();
        const deduped = allMarkets.filter(m => {
          const key = `${m.chainId}:${m.uniqueKey}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        if (deduped.length !== allMarkets.length) {
          console.warn(`[Morpho] Removed ${allMarkets.length - deduped.length} cross-chain duplicates`);
        }

        const sorted = sortMarkets(deduped);
        setMarkets(sorted);
        setLastFetched(Date.now());
        setFetchDurationMs(Date.now() - startTime);
        setError(null);

        console.log(`[Morpho] ✓ Loaded ${deduped.length} unique markets in ${Date.now() - startTime}ms`);
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
