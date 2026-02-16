/**
 * React hook for the swap intent store.
 */

import { useSyncExternalStore, useCallback } from 'react';
import {
  openSwapIntent,
  closeSwapIntent,
  clearSwapIntent,
  getSwapIntent,
  isSwapDrawerOpen,
  subscribeSwapIntent,
  type SwapIntent,
} from '@/lib/swapIntent';

export type { SwapIntent } from '@/lib/swapIntent';

function getSnapshot() {
  return { intent: getSwapIntent(), isOpen: isSwapDrawerOpen() };
}

// Stable reference for SSR
const serverSnapshot = { intent: null as SwapIntent | null, isOpen: false };

export function useSwapIntent() {
  const state = useSyncExternalStore(
    subscribeSwapIntent,
    getSnapshot,
    () => serverSnapshot
  );

  const open = useCallback((intent: SwapIntent) => openSwapIntent(intent), []);
  const close = useCallback(() => closeSwapIntent(), []);
  const clear = useCallback(() => clearSwapIntent(), []);

  return {
    intent: state.intent,
    isOpen: state.isOpen,
    openSwapIntent: open,
    closeSwapIntent: close,
    clearSwapIntent: clear,
  };
}
