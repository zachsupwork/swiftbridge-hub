/**
 * BalancesProvider — single source of truth for token balances across the app.
 * Wraps useBalances() in a React context so all consumers share the same state.
 * 
 * Exposes:
 *  - balancesByChain: Record<number, TokenBalance[]>
 *  - getBalance(chainId, tokenAddress) -> PortfolioTokenBalance | undefined
 *  - allTokensList: merged deduplicated token list across chains
 *  - refreshBalances(), isLoading, isRefreshing, error, lastUpdated, etc.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useBalances, type UseBalancesResult, type PortfolioTokenBalance } from '@/hooks/useBalances';

/** Augmented context with convenience helpers */
export interface UnifiedBalancesContext extends UseBalancesResult {
  /** All tokens deduplicated by symbol (highest balance first) */
  allTokensList: PortfolioTokenBalance[];
  /** Structured balances keyed by chainId -> tokenAddress(lowercase) */
  balanceMap: Map<string, PortfolioTokenBalance>;
}

const BalancesContext = createContext<UnifiedBalancesContext | null>(null);

export function BalancesProvider({ children }: { children: ReactNode }) {
  const balances = useBalances();

  // Build a fast lookup map: "chainId:address" -> balance
  const balanceMap = useMemo(() => {
    const map = new Map<string, PortfolioTokenBalance>();
    for (const tb of balances.tokenBalances) {
      const key = `${tb.chainId}:${tb.token.address.toLowerCase()}`;
      map.set(key, tb);
    }
    return map;
  }, [balances.tokenBalances]);

  // Deduplicated token list across chains (grouped by symbol, highest balance first)
  const allTokensList = useMemo(() => {
    const seen = new Map<string, PortfolioTokenBalance>();
    for (const tb of balances.tokenBalances) {
      const sym = tb.token.symbol.toUpperCase();
      const existing = seen.get(sym);
      if (!existing || tb.balanceUSD > existing.balanceUSD) {
        seen.set(sym, tb);
      }
    }
    return Array.from(seen.values()).sort((a, b) => b.balanceUSD - a.balanceUSD);
  }, [balances.tokenBalances]);

  const ctx: UnifiedBalancesContext = useMemo(() => ({
    ...balances,
    allTokensList,
    balanceMap,
  }), [balances, allTokensList, balanceMap]);

  return (
    <BalancesContext.Provider value={ctx}>
      {children}
    </BalancesContext.Provider>
  );
}

/**
 * Use the shared balance context. Must be called inside <BalancesProvider>.
 * Falls back to direct useBalances() if no provider is found (safety net).
 */
export function useBalancesContext(): UnifiedBalancesContext {
  const ctx = useContext(BalancesContext);
  if (!ctx) {
    // Fallback: if someone forgot to wrap in provider, still works
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const balances = useBalances();
    return {
      ...balances,
      allTokensList: balances.tokenBalances,
      balanceMap: new Map(),
    };
  }
  return ctx;
}
