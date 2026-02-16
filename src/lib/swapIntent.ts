/**
 * Swap Intent Store
 * 
 * Shared state for cross-feature swap navigation.
 * Any feature (Earn, Portfolio, Vaults) can open a swap drawer
 * pre-configured with the exact token the user needs.
 * 
 * Uses a simple pub/sub pattern — no external dependencies.
 */

export interface SwapIntent {
  intentType: 'acquire_token' | 'swap_from';
  /** Target token the user wants to end up with */
  targetChainId: number;
  targetTokenAddress: string;
  targetSymbol: string;
  /** Suggested amount (optional) */
  suggestedAmount?: string;
  /** Source preference */
  sourceChainId?: number;
  sourceTokenAddress?: string;
  sourceSymbol?: string;
  /** Where to return after swap completes */
  returnTo?: {
    view: 'earn' | 'portfolio' | 'vaults';
    tab?: string;
    marketId?: string;
    context?: string;
  };
}

type Listener = () => void;

let currentIntent: SwapIntent | null = null;
let isDrawerOpen = false;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(l => l());
}

export function openSwapIntent(intent: SwapIntent) {
  currentIntent = intent;
  isDrawerOpen = true;
  notify();
}

export function closeSwapIntent() {
  isDrawerOpen = false;
  notify();
}

export function clearSwapIntent() {
  currentIntent = null;
  isDrawerOpen = false;
  notify();
}

export function getSwapIntent(): SwapIntent | null {
  return currentIntent;
}

export function isSwapDrawerOpen(): boolean {
  return isDrawerOpen;
}

export function subscribeSwapIntent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
