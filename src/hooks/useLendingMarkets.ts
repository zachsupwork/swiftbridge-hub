/**
 * Lending Markets Hook — Aave V3 Integration
 *
 * PRIMARY source: DeFi Llama API (always used, no getReservesData).
 * This avoids all UiPoolDataProvider ABI decode failures.
 * Prices are enriched via DeFi Llama coin prices API.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAddress } from 'viem';
import { resolveTokenLogo, resolveChainLogo } from '@/lib/logoResolver';
import { getTokens } from '@/lib/lifiClient';
import { fetchPrices } from '@/lib/prices';
import { SUPPORTED_CHAINS, getChainConfig, type ChainConfig } from '@/lib/chainConfig';

// ============================================
// TYPES
// ============================================

export interface LendingMarket {
  id: string;
  protocol: 'aave';
  chainId: number;
  chainName: string;
  chainLogo: string;
  assetSymbol: string;
  assetName: string;
  assetAddress: `0x${string}`;
  assetLogo: string;
  decimals: number;
  supplyAPY: number;
  borrowAPY: number;
  isVariable: boolean;
  tvl: number | null;
  totalSupplyUsd: number;
  totalBorrowUsd: number;
  availableLiquidity: number | null;
  availableLiquidityUsd: number;
  collateralEnabled: boolean;
  ltv: number;
  liquidationThreshold: number;
  liquidationBonus: number;
  supplyCap: number;
  borrowCap: number;
  reserveFactor: number;
  utilizationRate: number;
  priceUsd: number;
  aTokenAddress: `0x${string}`;
  variableDebtTokenAddress: `0x${string}`;
  isActive: boolean;
  isFrozen: boolean;
  isPaused: boolean;
  borrowingEnabled: boolean;
  liquidityIndex: bigint;
  variableBorrowIndex: bigint;
  eModeCategoryId: number;
  marketId: string;
  protocolUrl: string;
}

// Re-export chain helpers
export { SUPPORTED_CHAINS, getChainConfig };
export const SUPPORTED_CHAIN_IDS = SUPPORTED_CHAINS.map(c => c.chainId);

export const LENDING_CHAINS = SUPPORTED_CHAINS.map(c => ({
  id: c.chainId,
  name: c.name,
  logo: c.logo,
  supported: true,
}));

// ============================================
// TOKEN / CHAIN LOGOS
// ============================================

function getTokenLogo(symbol: string, address?: string, chainId?: number): string {
  return resolveTokenLogo({ symbol, address, chainId });
}

function getChainLogoUrl(chainId: number): string {
  return resolveChainLogo(chainId);
}

// ============================================
// ERROR TYPES
// ============================================

export type MarketFetchErrorType =
  | 'unsupported_chain' | 'missing_rpc' | 'rpc_unavailable'
  | 'contract_error' | 'network_error' | 'no_markets'
  | 'partial_failure' | 'rate_limited' | 'timeout';

export interface MarketFetchError {
  type: MarketFetchErrorType;
  chainId?: number;
  chainName?: string;
  message: string;
  failedChains?: ChainFailure[];
}

export interface ChainFailure {
  chainId: number;
  chainName: string;
  error: string;
  errorType: MarketFetchErrorType;
}

export interface ChainFetchResult {
  chainId: number;
  chainName: string;
  success: boolean;
  markets: LendingMarket[];
  error?: string;
  errorType?: MarketFetchErrorType;
}

// ============================================
// CACHE
// ============================================

interface CacheEntry {
  markets: LendingMarket[];
  timestamp: number;
}

const CACHE_TTL_MS = 60_000;
let globalCache: CacheEntry | null = null;

// ============================================
// CONSTANTS
// ============================================

const CHAIN_NAME_TO_ID: Record<string, number> = {
  'Ethereum': 1, 'Arbitrum': 42161, 'Optimism': 10, 'Polygon': 137, 'Base': 8453, 'Avalanche': 43114,
};

const AAVE_MARKET_NAMES: Record<number, string> = {
  1: 'proto_mainnet_v3',
  42161: 'proto_arbitrum_v3',
  10: 'proto_optimism_v3',
  137: 'proto_polygon_v3',
  8453: 'proto_base_v3',
  43114: 'proto_avalanche_v3',
};

// Known non-borrowable assets (supply-only collateral)
const NON_BORROWABLE_SYMBOLS = new Set([
  'STETH', 'CBETH', 'RETH', 'WSTETH', 'OSETH', 'WEETH', 'EZETH', 'RSETH', 'SDAI', 'SUSDS', 'SUSDE'
]);

// ============================================
// DEFI LLAMA — PRIMARY MARKETS SOURCE
// ============================================

async function fetchFromDefiLlama(): Promise<LendingMarket[]> {
  console.log('[Earn] Fetching markets from DeFi Llama API...');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch('https://yields.llama.fi/pools', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`DeFi Llama API returned ${response.status}`);

    const json = await response.json();
    const allAavePools = (json.data || json).filter(
      (p: any) => p.project === 'aave-v3' && p.chain in CHAIN_NAME_TO_ID && p.tvlUsd > 10000
    );

    if (allAavePools.length === 0) throw new Error('No Aave V3 pools returned from DeFi Llama');

    // Fetch LiFi token metadata per chain for correct decimals
    const chainIds = [...new Set(allAavePools.map((p: any) => CHAIN_NAME_TO_ID[p.chain]).filter(Boolean))] as number[];
    const tokenMetaMap = new Map<string, { decimals: number; symbol: string; name: string; logoURI?: string }>();

    await Promise.all(chainIds.map(async (cid: number) => {
      try {
        const tokens = await getTokens(cid);
        for (const t of tokens) {
          tokenMetaMap.set(`${cid}:${t.address.toLowerCase()}`, {
            decimals: t.decimals,
            symbol: t.symbol,
            name: t.name,
            logoURI: t.logoURI,
          });
        }
      } catch (e) {
        console.warn(`[Earn] LiFi token fetch failed for chain ${cid}:`, e);
      }
    }));

    // Build borrow APY map: chainId-symbol → best borrow APY
    const borrowDataMap = new Map<string, number>();
    for (const pool of allAavePools) {
      const chainId = Number(CHAIN_NAME_TO_ID[pool.chain]);
      const symbol = pool.symbol.split('-')[0].trim().toUpperCase();
      const borrowAPY = Math.abs((pool.apyBaseBorrow ?? 0) + (pool.apyRewardBorrow ?? 0));
      if (borrowAPY > 0) {
        const key = `${chainId}-${symbol}`;
        if (!borrowDataMap.has(key) || borrowDataMap.get(key)! < borrowAPY) {
          borrowDataMap.set(key, borrowAPY);
        }
      }
    }

    // Deduplicate by chainId-symbol, preferring highest TVL
    const deduped = new Map<string, any>();
    for (const pool of allAavePools) {
      const chainId = Number(CHAIN_NAME_TO_ID[pool.chain]);
      const symbol = pool.symbol.split('-')[0].trim().toUpperCase();
      const key = `${chainId}-${symbol}`;
      const existing = deduped.get(key);
      if (!existing || (pool.tvlUsd || 0) > (existing.tvlUsd || 0)) {
        deduped.set(key, pool);
      }
    }

    const markets: LendingMarket[] = Array.from(deduped.values()).map((pool: any) => {
      const chainId = Number(CHAIN_NAME_TO_ID[pool.chain]);
      const chainCfg = getChainConfig(chainId);
      const symbol = pool.symbol.split('-')[0].trim().toUpperCase();
      const rawTokenAddress = (pool.underlyingTokens?.[0] || '0x0000000000000000000000000000000000000000') as string;
      // Checksum the address
      let tokenAddress: `0x${string}`;
      try {
        tokenAddress = getAddress(rawTokenAddress) as `0x${string}`;
      } catch {
        tokenAddress = rawTokenAddress as `0x${string}`;
      }
      const supplyAPY = pool.apy ?? pool.apyBase ?? 0;
      const borrowKey = `${chainId}-${symbol}`;
      const borrowAPY = borrowDataMap.get(borrowKey) ?? Math.abs((pool.apyBaseBorrow ?? 0) + (pool.apyRewardBorrow ?? 0));
      const collateralEnabled = (pool.ltv ?? 0) > 0;
      const marketName = AAVE_MARKET_NAMES[chainId] || '';
      const meta = tokenMetaMap.get(`${chainId}:${tokenAddress.toLowerCase()}`);
      const decimals = meta?.decimals ?? 18;
      const isBorrowable = !NON_BORROWABLE_SYMBOLS.has(symbol);
      const tvl = pool.tvlUsd ?? 0;
      const totalSupplyUsd = pool.totalSupplyUsd || tvl;
      const totalBorrowUsd = pool.totalBorrowUsd || 0;
      const availableLiquidityUsd = Math.max(0, totalSupplyUsd - totalBorrowUsd);
      const utilizationRate = totalSupplyUsd > 0 ? (totalBorrowUsd / totalSupplyUsd) * 100 : 0;

      return {
        id: `aave-${chainId}-${pool.pool}`,
        protocol: 'aave' as const,
        chainId,
        chainName: chainCfg?.name || pool.chain,
        chainLogo: getChainLogoUrl(chainId),
        assetSymbol: symbol,
        assetName: meta?.name || symbol,
        assetAddress: tokenAddress,
        assetLogo: getTokenLogo(symbol, tokenAddress, chainId),
        decimals,
        supplyAPY,
        borrowAPY,
        isVariable: true,
        tvl,
        totalSupplyUsd,
        totalBorrowUsd,
        availableLiquidity: availableLiquidityUsd,
        availableLiquidityUsd,
        collateralEnabled,
        ltv: (pool.ltv ?? 0) * 100,
        liquidationThreshold: 0,
        liquidationBonus: 0,
        supplyCap: 0,
        borrowCap: 0,
        reserveFactor: 0,
        utilizationRate,
        priceUsd: 0, // enriched below
        aTokenAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`,
        variableDebtTokenAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`,
        isActive: true,
        isFrozen: false,
        isPaused: false,
        borrowingEnabled: isBorrowable,
        liquidityIndex: 0n,
        variableBorrowIndex: 0n,
        eModeCategoryId: 0,
        marketId: tokenAddress,
        protocolUrl: `https://app.aave.com/reserve-overview/?underlyingAsset=${tokenAddress.toLowerCase()}&marketName=${marketName}`,
      } as LendingMarket;
    });

    markets.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
    console.log(`[Earn] ✓ DeFi Llama: ${markets.length} Aave V3 markets`);
    return markets;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ============================================
// HOOK TYPES
// ============================================

export interface UseLendingMarketsResult {
  markets: LendingMarket[];
  loading: boolean;
  error: MarketFetchError | null;
  errorMessage: string | null;
  refresh: () => void;
  refreshChain: (chainId: number) => void;
  chains: typeof LENDING_CHAINS;
  lastFetched: number;
  isRetrying: boolean;
  chainResults: ChainFetchResult[];
  partialFailures: ChainFailure[];
}

// ============================================
// HOOK
// ============================================

export function useLendingMarkets(selectedChainId?: number): UseLendingMarketsResult {
  const [allMarkets, setAllMarkets] = useState<LendingMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MarketFetchError | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [chainResults, setChainResults] = useState<ChainFetchResult[]>([]);
  const [partialFailures] = useState<ChainFailure[]>([]);

  const fetchInProgress = useRef(false);

  const fetchMarkets = useCallback(async (isRetry = false) => {
    if (fetchInProgress.current && !isRetry) return;
    fetchInProgress.current = true;

    if (isRetry) setIsRetrying(true);
    else setLoading(true);
    setError(null);
    setErrorMessage(null);

    try {
      // Check cache
      if (!isRetry && globalCache && Date.now() - globalCache.timestamp < CACHE_TTL_MS) {
        setAllMarkets(globalCache.markets);
        setLastFetched(globalCache.timestamp);
        setLoading(false);
        fetchInProgress.current = false;
        return;
      }

      // Fetch from DeFi Llama (primary, always)
      let markets: LendingMarket[] = [];
      try {
        markets = await fetchFromDefiLlama();
      } catch (llamaErr) {
        console.error('[Earn] DeFi Llama fetch failed:', llamaErr);
        setError({ type: 'network_error', message: 'Unable to load market data from DeFi Llama' });
        setErrorMessage('Unable to load Aave V3 market data. Please try again.');
        return;
      }

      // Enrich prices for all markets
      if (markets.length > 0) {
        try {
          const missingPriceTokens = markets.map(m => ({ chainId: m.chainId, address: m.assetAddress }));
          const prices = await fetchPrices(missingPriceTokens);
          for (const m of markets) {
            const key = `${m.chainId}:${m.assetAddress.toLowerCase()}`;
            const tp = prices.get(key);
            if (tp) m.priceUsd = tp.usdPrice;
          }
          console.log(`[Earn] ✓ Enriched prices for ${markets.length} markets`);
        } catch (e) {
          console.warn('[Earn] Price enrichment failed:', e);
        }

        // Build chainResults for UI
        const chainIdSet = [...new Set(markets.map(m => m.chainId))];
        const results: ChainFetchResult[] = chainIdSet.map(cid => ({
          chainId: cid,
          chainName: getChainConfig(cid)?.name || String(cid),
          success: true,
          markets: markets.filter(m => m.chainId === cid),
        }));
        setChainResults(results);

        setAllMarkets(markets);
        setLastFetched(Date.now());
        globalCache = { markets, timestamp: Date.now() };
        console.log(`[Earn] ✓ Total: ${markets.length} markets across ${chainIdSet.length} chains`);
      } else {
        setError({ type: 'no_markets', message: 'No markets returned' });
        setErrorMessage('No Aave V3 markets found. Please try again.');
      }
    } catch (err) {
      console.error('[Earn] Fatal error:', err);
      setError({ type: 'network_error', message: 'Unexpected error' });
      setErrorMessage('Unexpected error. Please try again.');
    } finally {
      setLoading(false);
      setIsRetrying(false);
      fetchInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  const markets = selectedChainId
    ? allMarkets.filter(m => m.chainId === selectedChainId)
    : allMarkets;

  const refresh = useCallback(() => {
    globalCache = null;
    fetchMarkets(true);
  }, [fetchMarkets]);

  const refreshChain = useCallback((_chainId: number) => {
    globalCache = null;
    fetchMarkets(true);
  }, [fetchMarkets]);

  return {
    markets,
    loading,
    error,
    errorMessage,
    refresh,
    refreshChain,
    chains: LENDING_CHAINS,
    lastFetched,
    isRetrying,
    chainResults,
    partialFailures,
  };
}

// Legacy exports
export function getPoolAddress(chainId: number): `0x${string}` | null {
  const config = getChainConfig(chainId);
  return config?.aavePool || null;
}

export function getExplorerUrl(chainId: number, txHash: string): string {
  const config = getChainConfig(chainId);
  return config ? `${config.explorerUrl}${txHash}` : `https://etherscan.io/tx/${txHash}`;
}

export { isAaveSupported as isEarnChainSupported } from '@/lib/aaveAddressBook';
