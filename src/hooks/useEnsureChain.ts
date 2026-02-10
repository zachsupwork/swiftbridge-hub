/**
 * useEnsureChain – wagmi v2 safe chain validation hook.
 * 
 * Uses useAccount().chainId (NOT connector.getChainId()) for active chain.
 * Uses RainbowKit openChainModal() for switching — never programmatic switchChain.
 */

import { useAccount } from 'wagmi';
import { useCallback, useMemo } from 'react';

interface EnsureChainResult {
  /** The wallet's current chain id (undefined if not connected) */
  activeChainId: number | undefined;
  /** Whether the wallet is connected */
  isConnected: boolean;
  /** Whether the wallet is on the required chain (true if no requiredChainId) */
  isCorrectChain: boolean;
  /** Human-readable error if not connected or wrong chain */
  errorMessage: string | null;
}

/**
 * @param requiredChainId - If provided, checks wallet is on this chain.
 */
export function useEnsureChain(requiredChainId?: number): EnsureChainResult {
  const { chainId, isConnected } = useAccount();

  return useMemo(() => {
    if (!isConnected) {
      return {
        activeChainId: undefined,
        isConnected: false,
        isCorrectChain: false,
        errorMessage: 'Please connect your wallet.',
      };
    }

    const isCorrectChain = requiredChainId == null || chainId === requiredChainId;

    return {
      activeChainId: chainId,
      isConnected: true,
      isCorrectChain,
      errorMessage: isCorrectChain
        ? null
        : `Please switch to the correct network in your wallet.`,
    };
  }, [chainId, isConnected, requiredChainId]);
}
