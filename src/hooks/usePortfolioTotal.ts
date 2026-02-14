import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { getTokenBalances, TokenAmount } from '@/lib/lifiClient';

const MAIN_CHAIN_IDS = [1, 10, 137, 42161, 8453];

interface PortfolioState {
  totalUSD: number;
  loading: boolean;
  lastUpdated: Date | null;
}

let cachedState: PortfolioState = { totalUSD: 0, loading: false, lastUpdated: null };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

/**
 * Shared hook that caches portfolio total across components
 * to avoid duplicate API calls between Portfolio page and wallet dropdown.
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
      const balances = await getTokenBalances(address, MAIN_CHAIN_IDS);
      let total = 0;
      for (const tokens of Object.values(balances)) {
        for (const token of tokens) {
          const raw = BigInt(token.amount || '0');
          if (raw === 0n) continue;
          const bal = parseFloat(formatUnits(raw, token.decimals));
          const price = parseFloat(token.priceUSD || '0');
          total += bal * price;
        }
      }
      cachedState = { totalUSD: total, loading: false, lastUpdated: new Date() };
    } catch {
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
      cachedState = { totalUSD: 0, loading: false, lastUpdated: null };
      notify();
    }
  }, [isConnected]);

  return { ...cachedState, refresh };
}
