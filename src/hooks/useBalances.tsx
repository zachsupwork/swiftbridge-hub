/**
 * Unified Balances Hook
 * 
 * Single source of truth for token balances across the app.
 * Wraps usePortfolioTotal and adds:
 * - Auto-refresh on page focus / visibility change
 * - Auto-refresh on wallet/chain changes
 * - Consistent API for all consumers (Portfolio, Swap, Earn)
 * - Balance lookup helpers
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { usePortfolioTotal, PortfolioTokenBalance } from './usePortfolioTotal';

export type { PortfolioTokenBalance } from './usePortfolioTotal';

export interface UseBalancesResult {
  /** All token balances across chains */
  tokenBalances: PortfolioTokenBalance[];
  /** Total USD value */
  totalUSD: number;
  /** Whether a fetch is in progress */
  isLoading: boolean;
  /** Whether a refresh (not initial load) is in progress */
  isRefreshing: boolean;
  /** Last successful update */
  lastUpdated: Date | null;
  /** Error message if fetch failed */
  error: string | null;
  /** Chain IDs being queried */
  chainIds: number[];
  /** Raw balances by chain */
  balancesByChain: Record<string, any[]>;
  /** Manual refresh trigger */
  refreshBalances: () => Promise<void>;
  /** Look up balance for a specific token on a specific chain */
  getBalance: (chainId: number, tokenAddress: string) => PortfolioTokenBalance | undefined;
  /** Get all balances for a token symbol across chains */
  getBalancesBySymbol: (symbol: string) => PortfolioTokenBalance[];
  /** Seconds since last update */
  secondsSinceUpdate: number | null;
}

/**
 * Unified balance hook for use across Portfolio, Swap, and Earn screens.
 * All consumers share the same cached data from usePortfolioTotal.
 */
export function useBalances(): UseBalancesResult {
  const { isConnected, chainId } = useAccount();
  const portfolio = usePortfolioTotal();
  const prevChainRef = useRef(chainId);
  const hadDataRef = useRef(false);

  // Track if we previously had data (for isRefreshing detection)
  if (portfolio.tokenBalances.length > 0) {
    hadDataRef.current = true;
  }

  const isRefreshing = portfolio.loading && hadDataRef.current;

  // Auto-refresh on page visibility change (user returns to tab)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isConnected) {
        // Only refresh if data is older than 30 seconds
        if (portfolio.lastUpdated) {
          const age = Date.now() - portfolio.lastUpdated.getTime();
          if (age > 30_000) {
            portfolio.refresh();
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isConnected, portfolio.lastUpdated, portfolio.refresh]);

  // Auto-refresh on chain change
  useEffect(() => {
    if (chainId && chainId !== prevChainRef.current && isConnected) {
      prevChainRef.current = chainId;
      // Small delay to let RPC catch up
      const timer = setTimeout(() => portfolio.refresh(), 1500);
      return () => clearTimeout(timer);
    }
  }, [chainId, isConnected, portfolio.refresh]);

  const getBalance = useCallback(
    (chainId: number, tokenAddress: string): PortfolioTokenBalance | undefined => {
      const addr = tokenAddress.toLowerCase();
      return portfolio.tokenBalances.find(
        (tb) =>
          tb.chainId === chainId &&
          tb.token.address.toLowerCase() === addr
      );
    },
    [portfolio.tokenBalances]
  );

  const getBalancesBySymbol = useCallback(
    (symbol: string): PortfolioTokenBalance[] => {
      const s = symbol.toUpperCase();
      return portfolio.tokenBalances.filter(
        (tb) => tb.token.symbol.toUpperCase() === s && tb.balance > 0
      );
    },
    [portfolio.tokenBalances]
  );

  const secondsSinceUpdate = portfolio.lastUpdated
    ? Math.round((Date.now() - portfolio.lastUpdated.getTime()) / 1000)
    : null;

  return {
    tokenBalances: portfolio.tokenBalances,
    totalUSD: portfolio.totalUSD,
    isLoading: portfolio.loading,
    isRefreshing,
    lastUpdated: portfolio.lastUpdated,
    error: portfolio.error,
    chainIds: portfolio.chainIds,
    balancesByChain: portfolio.balancesByChain,
    refreshBalances: portfolio.refresh,
    getBalance,
    getBalancesBySymbol,
    secondsSinceUpdate,
  };
}
