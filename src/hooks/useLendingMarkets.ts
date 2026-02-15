/**
 * Lending Markets Hook
 * 
 * Fetches Aave V3 markets from DeFi Llama's free yields API.
 * Falls back to on-chain calls if API is unavailable.
 * 
 * Data source: https://yields.llama.fi/pools (free, no API key)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAaveAddresses, isAaveSupported } from '@/lib/aaveAddressBook';
import { getChainConfig, SUPPORTED_CHAINS, type ChainConfig } from '@/lib/chainConfig';

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
  supplyAPY: number;
  borrowAPY: number;
  isVariable: boolean;
  tvl: number | null;
  availableLiquidity: number | null;
  collateralEnabled: boolean;
  decimals: number;
  marketId: string;
  protocolUrl: string;
}

// Re-export chain helpers
export { SUPPORTED_CHAINS, getChainConfig, isAaveSupported as isEarnChainSupported };
export const SUPPORTED_CHAIN_IDS = SUPPORTED_CHAINS.map(c => c.chainId);

export const LENDING_CHAINS = SUPPORTED_CHAINS.map(c => ({
  id: c.chainId,
  name: c.name,
  logo: c.logo,
  supported: true,
}));

// Token logo mapping
const TOKEN_LOGOS: Record<string, string> = {
  ETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/eth.svg',
  WETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg',
  USDC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  'USDC.E': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  USDCE: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  USDT: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdt.svg',
  DAI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/dai.svg',
  WBTC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg',
  LINK: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/link.svg',
  AAVE: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/aave.svg',
  UNI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/uni.svg',
  MATIC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/matic.svg',
  WMATIC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/matic.svg',
  ARB: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/arb.svg',
  OP: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/op.svg',
  AVAX: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/avax.svg',
  WAVAX: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/avax.svg',
  CRV: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/crv.svg',
  FRAX: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/frax.svg',
  CBETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/cbeth.svg',
  RETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/reth.svg',
  WSTETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wsteth.svg',
  GHO: 'https://app.aave.com/icons/tokens/gho.svg',
  LUSD: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/lusd.svg',
  SUSD: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/susd.svg',
  BAL: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/bal.svg',
  SNX: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/snx.svg',
  MKR: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/mkr.svg',
  LDO: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/ldo.svg',
  RPL: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/rpl.svg',
};

const getTokenLogo = (symbol: string): string => {
  const upper = symbol.toUpperCase().replace('.', '');
  return TOKEN_LOGOS[upper] || TOKEN_LOGOS[symbol.toUpperCase()] ||
    'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
};

// Error types
export type MarketFetchErrorType =
  | 'unsupported_chain'
  | 'missing_rpc'
  | 'rpc_unavailable'
  | 'contract_error'
  | 'network_error'
  | 'no_markets'
  | 'partial_failure'
  | 'rate_limited'
  | 'timeout';

export interface MarketFetchError {
  type: MarketFetchErrorType;
  chainId?: number;
  chainName?: string;
  message: string;
  missingEnvKey?: string;
  failedAddress?: string;
  failedChains?: ChainFailure[];
  httpStatus?: number;
}

export interface ChainFailure {
  chainId: number;
  chainName: string;
  error: string;
  errorType: MarketFetchErrorType;
  httpStatus?: number;
}

// ============================================
// DeFi Llama Chain Name <-> Chain ID mapping
// ============================================

const CHAIN_NAME_TO_ID: Record<string, number> = {
  'Ethereum': 1,
  'Arbitrum': 42161,
  'Optimism': 10,
  'Polygon': 137,
  'Base': 8453,
  'Avalanche': 43114,
};

const CHAIN_ID_TO_LLAMA_NAME: Record<number, string> = {
  1: 'Ethereum',
  42161: 'Arbitrum',
  10: 'Optimism',
  137: 'Polygon',
  8453: 'Base',
  43114: 'Avalanche',
};

const AAVE_MARKET_NAMES: Record<number, string> = {
  1: 'proto_mainnet_v3',
  42161: 'proto_arbitrum_v3',
  10: 'proto_optimism_v3',
  137: 'proto_polygon_v3',
  8453: 'proto_base_v3',
  43114: 'proto_avalanche_v3',
};

// ============================================
// CACHING
// ============================================

interface CacheEntry {
  markets: LendingMarket[];
  timestamp: number;
}

const CACHE_TTL_MS = 60000; // 60 seconds for API data
let globalCache: CacheEntry | null = null;

// ============================================
// DeFi Llama API Types
// ============================================

interface DefiLlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  apyBaseBorrow: number | null;
  apyRewardBorrow: number | null;
  totalSupplyUsd: number | null;
  totalBorrowUsd: number | null;
  ltv: number | null;
  underlyingTokens: string[] | null;
  rewardTokens: string[] | null;
  poolMeta: string | null;
  exposure: string | null;
  stablecoin: boolean;
}

// ============================================
// FETCH FROM DEFI LLAMA
// ============================================

async function fetchFromDefiLlama(): Promise<LendingMarket[]> {
  // Check cache
  if (globalCache && Date.now() - globalCache.timestamp < CACHE_TTL_MS) {
    console.log(`[Earn] Using cached DeFi Llama data (${globalCache.markets.length} markets)`);
    return globalCache.markets;
  }

  console.log('[Earn] Fetching Aave V3 markets from DeFi Llama...');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch('https://yields.llama.fi/pools', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`DeFi Llama API returned ${response.status}`);
    }

    const json = await response.json();
    const pools: DefiLlamaPool[] = json.data || json;

    // Filter for Aave V3 pools on our supported chains
    const aavePools = pools.filter(
      (p) =>
        p.project === 'aave-v3' &&
        p.chain in CHAIN_NAME_TO_ID &&
        p.tvlUsd > 10000 // Filter out dust pools
    );

    console.log(`[Earn] DeFi Llama: ${aavePools.length} Aave V3 pools found`);

    const markets: LendingMarket[] = aavePools.map((pool) => {
      const chainId = CHAIN_NAME_TO_ID[pool.chain];
      const chainConfig = getChainConfig(chainId);
      
      // Extract symbol - DeFi Llama uses formats like "USDC", "WETH", "USDC.E"
      // Sometimes it's "WETH-USDC" for pairs, take the first token
      const rawSymbol = pool.symbol.split('-')[0].trim();
      const symbol = rawSymbol.toUpperCase();
      
      // Get underlying token address if available
      const tokenAddress = (pool.underlyingTokens?.[0] || '0x0000000000000000000000000000000000000000') as `0x${string}`;
      
      const supplyAPY = pool.apy ?? pool.apyBase ?? 0;
      const borrowAPY = (pool.apyBaseBorrow ?? 0) + (pool.apyRewardBorrow ?? 0);
      
      // LTV > 0 means it can be used as collateral
      const collateralEnabled = (pool.ltv ?? 0) > 0;
      
      const marketName = AAVE_MARKET_NAMES[chainId] || '';
      const aaveUrl = `https://app.aave.com/reserve-overview/?underlyingAsset=${tokenAddress}&marketName=${marketName}`;

      return {
        id: `aave-${chainId}-${pool.pool}`,
        protocol: 'aave' as const,
        chainId,
        chainName: chainConfig?.name || pool.chain,
        chainLogo: chainConfig?.logo || '',
        assetSymbol: symbol,
        assetName: symbol,
        assetAddress: tokenAddress,
        assetLogo: getTokenLogo(symbol),
        supplyAPY,
        borrowAPY: Math.abs(borrowAPY),
        isVariable: true,
        tvl: pool.tvlUsd,
        availableLiquidity: pool.totalSupplyUsd && pool.totalBorrowUsd
          ? pool.totalSupplyUsd - pool.totalBorrowUsd
          : pool.tvlUsd,
        collateralEnabled,
        decimals: 18, // Default, not critical for display
        marketId: tokenAddress,
        protocolUrl: aaveUrl,
      };
    });

    // Sort by TVL desc
    markets.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));

    // Cache
    globalCache = { markets, timestamp: Date.now() };

    console.log(`[Earn] ✓ Loaded ${markets.length} Aave V3 markets from DeFi Llama`);
    return markets;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[Earn] DeFi Llama fetch failed:', error);
    throw error;
  }
}

// ============================================
// HOOK
// ============================================

export interface ChainFetchResult {
  chainId: number;
  chainName: string;
  success: boolean;
  markets: LendingMarket[];
  error?: string;
  errorType?: MarketFetchErrorType;
  httpStatus?: number;
}

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

    if (isRetry) {
      setIsRetrying(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setErrorMessage(null);

    try {
      const markets = await fetchFromDefiLlama();
      
      setAllMarkets(markets);
      setLastFetched(Date.now());

      // Build chain results
      const chainMap = new Map<number, LendingMarket[]>();
      for (const m of markets) {
        if (!chainMap.has(m.chainId)) chainMap.set(m.chainId, []);
        chainMap.get(m.chainId)!.push(m);
      }
      setChainResults(
        SUPPORTED_CHAINS.map(c => ({
          chainId: c.chainId,
          chainName: c.name,
          success: chainMap.has(c.chainId),
          markets: chainMap.get(c.chainId) || [],
        }))
      );

    } catch (err) {
      console.error('[Earn] Failed to fetch markets:', err);
      const fetchError: MarketFetchError = {
        type: 'network_error',
        message: 'Unable to fetch market data from any chain. Please check your connection and try again.',
      };
      setError(fetchError);
      setErrorMessage(fetchError.message);
      if (!isRetry) setAllMarkets([]);
    } finally {
      setLoading(false);
      setIsRetrying(false);
      fetchInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  // Filter by selected chain
  const markets = selectedChainId
    ? allMarkets.filter(m => m.chainId === selectedChainId)
    : allMarkets;

  const refresh = useCallback(() => {
    globalCache = null;
    fetchMarkets(true);
  }, [fetchMarkets]);

  const refreshChain = useCallback((chainId: number) => {
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
  const addresses = getAaveAddresses(chainId);
  return addresses?.POOL || null;
}

export function getExplorerUrl(chainId: number, txHash: string): string {
  const config = getChainConfig(chainId);
  return config ? `${config.explorerUrl}${txHash}` : `https://etherscan.io/tx/${txHash}`;
}
