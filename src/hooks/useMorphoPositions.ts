/**
 * Morpho Positions Hook
 * 
 * Fetches user's Morpho Blue positions across supported chains.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { fetchMorphoPositions, type UserPosition } from '@/lib/morpho/apiClient';
import { getEnabledMorphoChains } from '@/lib/morpho/config';
import type { MorphoChainConfig } from '@/lib/morpho/types';

export interface MorphoPositionWithHealth extends UserPosition {
  healthFactor: number | null;
  isHealthy: boolean;
}

export interface UseMorphoPositionsResult {
  positions: MorphoPositionWithHealth[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  totalSupplyUsd: number;
  totalBorrowUsd: number;
  totalCollateralUsd: number;
}

// In-memory cache
const positionCache = new Map<string, { positions: MorphoPositionWithHealth[]; timestamp: number }>();
const CACHE_TTL_MS = 30000; // 30 second cache for positions

export function useMorphoPositions(): UseMorphoPositionsResult {
  const { address, isConnected } = useAccount();
  const [positions, setPositions] = useState<MorphoPositionWithHealth[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isMountedRef = useRef(true);
  const fetchIdRef = useRef(0);
  
  const enabledChains = useMemo(() => getEnabledMorphoChains(), []);

  const fetchPositions = useCallback(async (forceRefresh = false) => {
    if (!address || !isConnected) {
      setPositions([]);
      return;
    }

    const cacheKey = address.toLowerCase();
    
    // Check cache first
    if (!forceRefresh) {
      const cached = positionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        console.log(`[Morpho] Using cached positions for ${address.slice(0, 8)}...`);
        setPositions(cached.positions);
        return;
      }
    }

    const currentFetchId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    try {
      console.log(`[Morpho] Fetching positions for ${address.slice(0, 8)}...`);
      
      const allPositions: MorphoPositionWithHealth[] = [];

      // Fetch positions from all enabled chains in parallel
      const results = await Promise.allSettled(
        enabledChains.map(chain =>
          fetchMorphoPositions({
            userAddress: address,
            chainId: chain.chainId,
            first: 100,
          })
        )
      );

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const chain = enabledChains[i];
        
        if (result.status === 'fulfilled') {
          // Add health factor calculation for each position
          const positionsWithHealth = result.value.map(p => {
            // Simple health factor: if no borrow, health is infinite (represented as null)
            // If borrow exists, calculate based on collateral value vs borrow value
            let healthFactor: number | null = null;
            let isHealthy = true;

            if (p.borrowAssetsUsd > 0 && p.market) {
              // Health = (collateralValue * LLTV) / borrowValue
              const maxBorrowable = p.collateralUsd * (p.market.lltv / 100);
              healthFactor = maxBorrowable / p.borrowAssetsUsd;
              isHealthy = healthFactor > 1;
            }

            return {
              ...p,
              healthFactor,
              isHealthy,
            };
          });

          allPositions.push(...positionsWithHealth);
        } else {
          console.warn(`[Morpho] Failed to fetch positions for ${chain.label}:`, result.reason);
        }
      }

      // Only update state if this is the latest fetch and component is still mounted
      if (currentFetchId === fetchIdRef.current && isMountedRef.current) {
        // Sort by USD value (supply + collateral) descending
        allPositions.sort((a, b) => 
          (b.supplyAssetsUsd + b.collateralUsd) - (a.supplyAssetsUsd + a.collateralUsd)
        );

        // Update cache
        positionCache.set(cacheKey, {
          positions: allPositions,
          timestamp: Date.now(),
        });

        setPositions(allPositions);
        console.log(`[Morpho] ✓ Found ${allPositions.length} positions across ${enabledChains.length} chains`);
      }
    } catch (err: unknown) {
      console.error('[Morpho] Failed to fetch positions:', err);
      if (currentFetchId === fetchIdRef.current && isMountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch positions';
        setError(errorMessage);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [address, isConnected, enabledChains]);

  // Fetch on mount and when address changes
  useEffect(() => {
    isMountedRef.current = true;
    fetchPositions();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchPositions]);

  const refresh = useCallback(() => {
    fetchPositions(true);
  }, [fetchPositions]);

  // Calculate totals
  const totals = useMemo(() => {
    let totalSupplyUsd = 0;
    let totalBorrowUsd = 0;
    let totalCollateralUsd = 0;

    for (const pos of positions) {
      totalSupplyUsd += pos.supplyAssetsUsd;
      totalBorrowUsd += pos.borrowAssetsUsd;
      totalCollateralUsd += pos.collateralUsd;
    }

    return { totalSupplyUsd, totalBorrowUsd, totalCollateralUsd };
  }, [positions]);

  return {
    positions,
    loading,
    error,
    refresh,
    ...totals,
  };
}
