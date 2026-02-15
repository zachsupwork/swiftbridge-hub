/**
 * Morpho Vaults Hook
 * 
 * Fetches Morpho vaults and vault positions across supported chains.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { 
  fetchMorphoVaults, 
  fetchMorphoVaultPositions,
  type MorphoVault,
  type VaultPosition,
} from '@/lib/morpho/vaultsClient';
import { getEnabledMorphoChains } from '@/lib/morpho/config';

export interface UseMorphoVaultsResult {
  vaults: MorphoVault[];
  vaultPositions: VaultPosition[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  selectedChainId: number | undefined;
  setSelectedChainId: (chainId: number | undefined) => void;
  totalDepositedUsd: number;
}

const vaultCache = new Map<number, { vaults: MorphoVault[]; timestamp: number }>();
const CACHE_TTL = 60000;

export function useMorphoVaults(): UseMorphoVaultsResult {
  const { address, isConnected } = useAccount();
  const [vaults, setVaults] = useState<MorphoVault[]>([]);
  const [vaultPositions, setVaultPositions] = useState<VaultPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>(undefined);
  
  const isMountedRef = useRef(true);
  const fetchIdRef = useRef(0);
  const enabledChains = useMemo(() => getEnabledMorphoChains(), []);

  const fetchAll = useCallback(async (force = false) => {
    const currentId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const chainsToFetch = selectedChainId
        ? enabledChains.filter(c => c.chainId === selectedChainId)
        : enabledChains;

      const allVaults: MorphoVault[] = [];

      // Fetch vaults from all chains in parallel
      const vaultResults = await Promise.allSettled(
        chainsToFetch.map(async chain => {
          if (!force) {
            const cached = vaultCache.get(chain.chainId);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
              return cached.vaults;
            }
          }
          const v = await fetchMorphoVaults({ chainId: chain.chainId, first: 50 });
          vaultCache.set(chain.chainId, { vaults: v, timestamp: Date.now() });
          return v;
        })
      );

      for (const r of vaultResults) {
        if (r.status === 'fulfilled') allVaults.push(...r.value);
      }

      // Fetch positions if connected
      let allPositions: VaultPosition[] = [];
      if (isConnected && address) {
        const posResults = await Promise.allSettled(
          chainsToFetch.map(chain =>
            fetchMorphoVaultPositions({ userAddress: address, chainId: chain.chainId })
          )
        );
        for (const r of posResults) {
          if (r.status === 'fulfilled') allPositions.push(...r.value);
        }
      }

      if (currentId === fetchIdRef.current && isMountedRef.current) {
        // Deduplicate by chainId+address
        const seen = new Set<string>();
        const dedupedVaults = allVaults.filter(v => {
          const key = `${v.chainId}:${v.address.toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Sort by TVL descending
        dedupedVaults.sort((a, b) => b.totalAssetsUsd - a.totalAssetsUsd);
        setVaults(dedupedVaults);
        setVaultPositions(allPositions);
      }
    } catch (err: unknown) {
      if (currentId === fetchIdRef.current && isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch vaults');
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [selectedChainId, enabledChains, isConnected, address]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchAll();
    return () => { isMountedRef.current = false; };
  }, [fetchAll]);

  const totalDepositedUsd = useMemo(
    () => vaultPositions.reduce((sum, p) => sum + p.assetsUsd, 0),
    [vaultPositions]
  );

  return {
    vaults,
    vaultPositions,
    loading,
    error,
    refresh: useCallback(() => fetchAll(true), [fetchAll]),
    selectedChainId,
    setSelectedChainId,
    totalDepositedUsd,
  };
}
