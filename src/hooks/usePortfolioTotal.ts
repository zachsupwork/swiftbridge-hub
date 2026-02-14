import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { getTokenBalances, TokenAmount, TokenBalancesResponse } from '@/lib/lifiClient';

const MAIN_CHAIN_IDS = [1, 10, 137, 42161, 8453];

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
  /** Raw balances keyed by chain — shared across consumers */
  balancesByChain: TokenBalancesResponse;
  /** Flat list of parsed token balances with USD values */
  tokenBalances: PortfolioTokenBalance[];
}

let cachedState: PortfolioState = {
  totalUSD: 0,
  loading: false,
  lastUpdated: null,
  balancesByChain: {},
  tokenBalances: [],
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
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

      const balance = parseFloat(formatUnits(rawAmount, token.decimals));
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

  // Sort by USD value descending, tokens without price go last but still show
  tokenBalances.sort((a, b) => {
    if (b.balanceUSD !== a.balanceUSD) return b.balanceUSD - a.balanceUSD;
    return b.balance - a.balance;
  });

  return { tokenBalances, totalUSD };
}

/**
 * Shared hook that caches portfolio balances + totals across components.
 * No duplicate API calls between Portfolio page and wallet dropdown.
 */
export function usePortfolioTotal() {
  const { address, isConnected } = useAccount();
  const [, rerender] = useState(0);
  const fetchingRef = useRef(false);

  useEffect(() => {
    const cb = () => rerender((n) => n + 1);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);

  const refresh = useCallback(async () => {
    if (!address || !isConnected || fetchingRef.current) return;
    fetchingRef.current = true;
    cachedState = { ...cachedState, loading: true };
    notify();

    try {
      const balancesByChain = await getTokenBalances(address, MAIN_CHAIN_IDS);
      const { tokenBalances, totalUSD } = parseBalances(balancesByChain);

      if (import.meta.env.DEV) {
        console.log('[PortfolioTotal] Parsed:', tokenBalances.length, 'tokens, total $', totalUSD.toFixed(2));
      }

      cachedState = {
        totalUSD,
        loading: false,
        lastUpdated: new Date(),
        balancesByChain,
        tokenBalances,
      };
    } catch (e) {
      console.error('[PortfolioTotal] Fetch failed:', e);
      cachedState = { ...cachedState, loading: false };
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

  // Clear on disconnect
  useEffect(() => {
    if (!isConnected) {
      cachedState = { totalUSD: 0, loading: false, lastUpdated: null, balancesByChain: {}, tokenBalances: [] };
      notify();
    }
  }, [isConnected]);

  return { ...cachedState, refresh };
}
