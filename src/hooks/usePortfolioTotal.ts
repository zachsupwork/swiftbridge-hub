import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { getTokenBalances, TokenAmount, TokenBalancesResponse } from '@/lib/lifiClient';
import { fetchPrices, clearPriceCache } from '@/lib/prices';
import { SUPPORTED_CHAINS } from '@/lib/wagmiConfig';

// Testnet chain IDs to exclude from portfolio by default
const TESTNET_IDS = new Set([11155111]); // sepolia

// Build chain list dynamically from wagmi config, excluding testnets
const PORTFOLIO_CHAIN_IDS = SUPPORTED_CHAINS
  .map((c) => c.id as number)
  .filter((id) => !TESTNET_IDS.has(id));

export interface PortfolioTokenBalance {
  chainId: number;
  token: TokenAmount;
  balance: number;
  balanceFormatted: string;
  balanceUSD: number;
}

interface PortfolioState {
  totalUSD: number;
  loading: boolean;
  lastUpdated: Date | null;
  error: string | null;
  /** Raw balances keyed by chain — shared across consumers */
  balancesByChain: TokenBalancesResponse;
  /** Flat list of parsed token balances with USD values */
  tokenBalances: PortfolioTokenBalance[];
}

let cachedState: PortfolioState = {
  totalUSD: 0,
  loading: false,
  lastUpdated: null,
  error: null,
  balancesByChain: {},
  tokenBalances: [],
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function enrichWithPrices(tokenBalances: PortfolioTokenBalance[]): Promise<PortfolioTokenBalance[]> {
  // Collect tokens that are missing USD prices
  const needsPricing = tokenBalances.filter(
    (tb) => !tb.token.priceUSD || parseFloat(tb.token.priceUSD) === 0
  );

  if (needsPricing.length === 0) return tokenBalances;

  const priceMap = await fetchPrices(
    needsPricing.map((tb) => ({ chainId: tb.chainId, address: tb.token.address }))
  );

  return tokenBalances.map((tb) => {
    const existingPrice = parseFloat(tb.token.priceUSD || '0');
    if (existingPrice > 0) return tb;

    const key = `${tb.chainId}:${tb.token.address.toLowerCase()}`;
    const fetched = priceMap.get(key);
    if (!fetched) return tb;

    const newUSD = tb.balance * fetched.usdPrice;
    return {
      ...tb,
      token: { ...tb.token, priceUSD: String(fetched.usdPrice) },
      balanceUSD: newUSD,
    };
  });
}

function parseBalances(balancesByChain: TokenBalancesResponse): { tokenBalances: PortfolioTokenBalance[]; totalUSD: number } {
  const tokenBalances: PortfolioTokenBalance[] = [];
  let totalUSD = 0;

  for (const [chainIdStr, tokens] of Object.entries(balancesByChain)) {
    const chainId = parseInt(chainIdStr, 10);
    if (isNaN(chainId)) continue;

    for (const token of tokens) {
      const rawAmount = BigInt(token.amount || '0');
      if (rawAmount === 0n) continue;

      const decimals = typeof token.decimals === 'number' && token.decimals > 0 ? token.decimals : 18;
      const balance = parseFloat(formatUnits(rawAmount, decimals));
      const priceUSD = parseFloat(token.priceUSD || '0');
      const balanceUSD = balance * priceUSD;

      tokenBalances.push({
        chainId,
        token,
        balance,
        balanceFormatted: balance < 0.0001 ? balance.toFixed(8) : balance.toFixed(4),
        balanceUSD,
      });

      totalUSD += balanceUSD;
    }
  }

  // Sort by USD value descending; tokens without price go last but still show
  tokenBalances.sort((a, b) => {
    if (b.balanceUSD !== a.balanceUSD) return b.balanceUSD - a.balanceUSD;
    return b.balance - a.balance;
  });

  return { tokenBalances, totalUSD };
}

// Auto-refresh interval (90 seconds)
const AUTO_REFRESH_MS = 90_000;

/**
 * Shared hook that caches portfolio balances + totals across components.
 * Queries ALL supported chains (excluding testnets).
 * No duplicate API calls between Portfolio page and wallet dropdown.
 */
export function usePortfolioTotal() {
  const { address, isConnected } = useAccount();
  const [, rerender] = useState(0);
  const fetchingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const cb = () => rerender((n) => n + 1);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);

  const refresh = useCallback(async () => {
    if (!address || !isConnected || fetchingRef.current) return;
    fetchingRef.current = true;
    cachedState = { ...cachedState, loading: true, error: null };
    notify();

    try {
      if (import.meta.env.DEV) {
        console.log('[PortfolioTotal] Fetching for', address, 'on chains:', PORTFOLIO_CHAIN_IDS);
      }

      const balancesByChain = await getTokenBalances(address, PORTFOLIO_CHAIN_IDS);
      let { tokenBalances, totalUSD } = parseBalances(balancesByChain);

      // Enrich missing prices via DefiLlama
      tokenBalances = await enrichWithPrices(tokenBalances);
      totalUSD = tokenBalances.reduce((sum, t) => sum + t.balanceUSD, 0);

      // Re-sort after price enrichment
      tokenBalances.sort((a, b) => {
        if (b.balanceUSD !== a.balanceUSD) return b.balanceUSD - a.balanceUSD;
        return b.balance - a.balance;
      });

      if (import.meta.env.DEV) {
        console.log('[PortfolioTotal] Parsed:', tokenBalances.length, 'tokens, total $', totalUSD.toFixed(2));
      }

      const hasTokens = tokenBalances.length > 0;

      cachedState = {
        totalUSD,
        loading: false,
        lastUpdated: new Date(),
        error: hasTokens ? null : 'No token balances returned. The balances API may be temporarily unavailable.',
        balancesByChain,
        tokenBalances,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error fetching balances';
      console.error('[PortfolioTotal] Fetch failed:', msg);
      cachedState = { ...cachedState, loading: false, error: `Unable to load balances: ${msg}` };
    } finally {
      fetchingRef.current = false;
      notify();
    }
  }, [address, isConnected]);

  // Auto-fetch on connect if stale
  useEffect(() => {
    if (isConnected && address && !cachedState.lastUpdated) {
      refresh();
    }
  }, [isConnected, address, refresh]);

  // Auto-refresh interval
  useEffect(() => {
    if (isConnected && address) {
      intervalRef.current = setInterval(() => {
        refresh();
      }, AUTO_REFRESH_MS);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [isConnected, address, refresh]);

  // Clear on disconnect
  useEffect(() => {
    if (!isConnected) {
      cachedState = { totalUSD: 0, loading: false, lastUpdated: null, error: null, balancesByChain: {}, tokenBalances: [] };
      clearPriceCache();
      notify();
    }
  }, [isConnected]);

  return { ...cachedState, refresh, chainIds: PORTFOLIO_CHAIN_IDS };
}
