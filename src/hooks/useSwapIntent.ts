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

// Cache snapshot so useSyncExternalStore gets a stable reference
let cachedIntent: SwapIntent | null = null;
let cachedIsOpen = false;
let cachedSnapshot = { intent: cachedIntent, isOpen: cachedIsOpen };

function getSnapshot() {
  const intent = getSwapIntent();
  const isOpen = isSwapDrawerOpen();
  if (intent !== cachedIntent || isOpen !== cachedIsOpen) {
    cachedIntent = intent;
    cachedIsOpen = isOpen;
    cachedSnapshot = { intent, isOpen };
  }
  return cachedSnapshot;
}

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
