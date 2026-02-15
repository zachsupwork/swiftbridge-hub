/**
 * BalancesProvider — single source of truth for token balances across the app.
 * Wraps useBalances() in a React context so all consumers share the same state.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useBalances, type UseBalancesResult } from '@/hooks/useBalances';

const BalancesContext = createContext<UseBalancesResult | null>(null);

export function BalancesProvider({ children }: { children: ReactNode }) {
  const balances = useBalances();
  return (
    <BalancesContext.Provider value={balances}>
      {children}
    </BalancesContext.Provider>
  );
}

/**
 * Use the shared balance context. Must be called inside <BalancesProvider>.
 * Falls back to direct useBalances() if no provider is found (safety net).
 */
export function useBalancesContext(): UseBalancesResult {
  const ctx = useContext(BalancesContext);
  if (!ctx) {
    // Fallback: if someone forgot to wrap in provider, still works
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useBalances();
  }
  return ctx;
}
