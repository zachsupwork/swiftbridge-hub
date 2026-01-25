/**
 * Lending Markets Hook
 * 
 * Fetches REAL Aave V3 markets from on-chain UiPoolDataProviderV3.
 * 
 * FEATURES:
 * - Direct static env var access (Vite production build compatible)
 * - Per-chain caching (30s TTL)
 * - Concurrency limiting (max 2 chains at once)
 * - Partial success handling (some chains can fail)
 * - Retry with exponential backoff
 * - Safe bigint conversions using formatUnits (no overflow)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPublicClient, http, formatUnits, type Chain, getAddress } from 'viem';
import { mainnet, arbitrum, optimism, polygon, base, avalanche } from 'viem/chains';
import { 
  UI_POOL_DATA_PROVIDER_ABI,
  getAaveAddresses,
  isAaveSupported,
  type AaveReserveData,
} from '@/lib/aaveAddressBook';
import { getChainConfig, SUPPORTED_CHAINS, type ChainConfig, testRpcHealth, getFallbackRpcs, maskRpcUrl } from '@/lib/chainConfig';

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

// Viem chain objects by chainId
const VIEM_CHAINS: Record<number, Chain> = {
  1: mainnet,
  42161: arbitrum,
  10: optimism,
  137: polygon,
  8453: base,
  43114: avalanche,
};

// Re-export chain helpers
export { SUPPORTED_CHAINS, getChainConfig, isAaveSupported as isEarnChainSupported };
export const SUPPORTED_CHAIN_IDS = SUPPORTED_CHAINS.map(c => c.chainId);

// Formatted chain list for UI components
export const LENDING_CHAINS = SUPPORTED_CHAINS.map(c => ({
  id: c.chainId,
  name: c.name,
  logo: c.logo,
  supported: true,
}));

// Token logo mapping for common assets
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
  const upperSymbol = symbol.toUpperCase().replace('.', '');
  return TOKEN_LOGOS[upperSymbol] || TOKEN_LOGOS[symbol.toUpperCase()] || 
    'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
};

// Error types for specific error handling
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

// Aave market URL base
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

const CACHE_TTL_MS = 30000; // 30 seconds
const marketCache = new Map<number, CacheEntry>();

function getCachedMarkets(chainId: number): LendingMarket[] | null {
  const entry = marketCache.get(chainId);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    marketCache.delete(chainId);
    return null;
  }
  
  return entry.markets;
}

function setCachedMarkets(chainId: number, markets: LendingMarket[]): void {
  marketCache.set(chainId, { markets, timestamp: Date.now() });
}

// ============================================
// CONCURRENCY LIMITING
// ============================================

const MAX_CONCURRENT = 2;

async function fetchWithConcurrencyLimit<T>(
  items: ChainConfig[],
  fetchFn: (config: ChainConfig) => Promise<T>
): Promise<T[]> {
  const results: T[] = [];
  const queue = [...items];
  const inProgress: Promise<void>[] = [];

  while (queue.length > 0 || inProgress.length > 0) {
    // Start new fetches up to limit
    while (inProgress.length < MAX_CONCURRENT && queue.length > 0) {
      const item = queue.shift()!;
      const promise = fetchFn(item)
        .then(result => {
          results.push(result);
        })
        .catch(error => {
          results.push(error as T);
        })
        .finally(() => {
          const index = inProgress.indexOf(promise);
          if (index > -1) inProgress.splice(index, 1);
        });
      inProgress.push(promise);
    }

    // Wait for at least one to complete
    if (inProgress.length > 0) {
      await Promise.race(inProgress);
    }
  }

  return results;
}

// ============================================
// FETCH WITH RETRY
// ============================================

async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  retries = 1,
  delayMs = 1000,
  context?: string
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // Log the actual error for debugging
    console.error(`[fetchWithRetry] Error (retries=${retries}):`, {
      context,
      message: error?.message?.substring(0, 500),
      shortMessage: error?.shortMessage?.substring(0, 200),
      name: error?.name,
    });
    
    if (retries > 0) {
      // Add jitter: 800-1200ms
      const jitter = Math.random() * 400 + 800;
      await new Promise(resolve => setTimeout(resolve, delayMs + jitter - 1000));
      return fetchWithRetry(fn, retries - 1, delayMs, context);
    }
    throw error;
  }
}

// ============================================
// SAFE BIGINT CONVERSION HELPERS
// ============================================

/**
 * Safely convert bigint to number using formatUnits to avoid overflow.
 * RAY = 1e27 for Aave interest rates
 */
function rayToPercent(rayValue: bigint): number {
  // formatUnits with 27 decimals converts RAY to a decimal string
  const decimalString = formatUnits(rayValue, 27);
  const percent = parseFloat(decimalString) * 100;
  return Number.isFinite(percent) ? percent : 0;
}

/**
 * Safely convert token amount bigint to number
 */
function toTokenAmount(value: bigint, decimals: number): number {
  const decimalString = formatUnits(value, decimals);
  const amount = parseFloat(decimalString);
  return Number.isFinite(amount) ? amount : 0;
}

/**
 * Safely get decimals as a number (should always be small)
 */
function getDecimals(value: bigint): number {
  // Decimals should be small (0-18 typically), safe to use Number()
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 && num <= 255 ? num : 18;
}

// ============================================
// MARKET FETCHING
// ============================================

/**
 * Fetch Aave V3 reserves data using UiPoolDataProviderV3 on-chain call
 * Includes fallback RPC logic: tries primary RPC, then falls back to public RPCs
 */
async function fetchAaveMarketsOnChain(chainConfig: ChainConfig): Promise<LendingMarket[]> {
  const { chainId, name, rpcUrl, logo } = chainConfig;
  
  // Check cache first
  const cached = getCachedMarkets(chainId);
  if (cached) {
    console.log(`[Earn] ${name}: Using cached markets (${cached.length} reserves)`);
    return cached;
  }
  
  // Get Aave addresses from address book
  const aaveAddresses = getAaveAddresses(chainId);
  
  if (!aaveAddresses) {
    const error = {
      type: 'unsupported_chain' as const,
      chainId,
      chainName: name,
      message: `Aave V3 not available on ${name}`,
    };
    console.error('[AAVE FETCH FAIL]', chainId, name, error);
    throw error;
  }

  // Build list of RPCs to try: primary first, then fallbacks
  const rpcsToTry: string[] = [];
  if (rpcUrl) {
    rpcsToTry.push(rpcUrl);
  }
  
  // Add fallback RPCs
  const fallbacks = getFallbackRpcs(chainId);
  rpcsToTry.push(...fallbacks.slice(0, 2)); // Max 2 fallbacks
  
  if (rpcsToTry.length === 0) {
    const error = {
      type: 'missing_rpc' as const,
      chainId,
      chainName: name,
      message: `No RPC available for ${name}`,
      missingEnvKey: chainConfig.rpcEnvKey,
    };
    console.error('[AAVE FETCH FAIL]', chainId, name, error);
    throw error;
  }

  // Use already checksummed addresses from chainConfig
  const checksummedProvider = chainConfig.aaveAddressesProvider;
  const checksummedUiProvider = chainConfig.aaveUiPoolDataProvider;

  // Log what we're about to try
  console.log(`[Earn] ${name} (${chainId}): Starting market fetch`, {
    step: '1-init',
    rpcSource: chainConfig.rpcSource,
    primaryRpc: maskRpcUrl(rpcsToTry[0]),
    fallbackCount: rpcsToTry.length - 1,
    UI_POOL_DATA_PROVIDER: checksummedUiProvider,
    POOL_ADDRESSES_PROVIDER: checksummedProvider,
  });

  const viemChain = VIEM_CHAINS[chainId];
  if (!viemChain) {
    const error = {
      type: 'unsupported_chain' as const,
      chainId,
      chainName: name,
      message: `Chain ${name} not configured in viem`,
    };
    console.error('[AAVE FETCH FAIL]', chainId, name, error);
    throw error;
  }

  // Try each RPC in order until one succeeds
  let lastError: any = null;
  
  for (let i = 0; i < rpcsToTry.length; i++) {
    const currentRpc = rpcsToTry[i];
    const isRetry = i > 0;
    
    if (isRetry) {
      console.log(`[Earn] ${name}: Retrying with fallback RPC ${i}/${rpcsToTry.length - 1}`);
      // Small delay before retry
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
    }
    
    try {
      // Create viem client with the current RPC URL
      const client = createPublicClient({
        chain: viemChain,
        transport: http(currentRpc, { timeout: 15000 }), // 15s timeout
      });
      
      const markets = await fetchMarketsWithClient(client, chainConfig, checksummedProvider, checksummedUiProvider);
      
      if (isRetry) {
        console.log(`[Earn] ${name}: ✓ Fallback RPC succeeded`);
      }
      
      return markets;
    } catch (error: any) {
      lastError = error;
      
      // Detailed error logging - very verbose for debugging
      const errorDetails = {
        rpcIndex: i + 1,
        rpcTotal: rpcsToTry.length,
        rpcHost: maskRpcUrl(currentRpc),
        message: error?.message?.substring(0, 500),
        name: error?.name,
        cause: error?.cause ? String(error.cause).substring(0, 200) : undefined,
        type: error?.type,
        shortMessage: error?.shortMessage?.substring(0, 200),
        details: error?.details?.substring(0, 200),
      };
      console.error(`[AAVE FETCH FAIL] ${chainId} ${name}:`, errorDetails);
      
      // Also log the raw error for debugging
      if (error?.message?.includes('Bytes') || error?.message?.includes('boolean') || error?.message?.includes('decode')) {
        console.error('[AAVE ABI DECODE ERROR]', name, error?.message?.substring(0, 1000));
      }
    }
  }
  
  // All RPCs failed - throw the last error
  console.error(`[AAVE] All RPCs failed for ${name}:`, lastError?.message?.substring(0, 300));
  throw lastError;
}

/**
 * Fetch markets using a specific viem client
 */
async function fetchMarketsWithClient(
  client: ReturnType<typeof createPublicClient>,
  chainConfig: ChainConfig,
  checksummedProvider: `0x${string}`,
  checksummedUiProvider: `0x${string}`
): Promise<LendingMarket[]> {
  const { chainId, name, logo } = chainConfig;
  
  console.log(`[Earn] ${name} (${chainId}): Calling getReservesData`, {
    step: '2-getReservesData',
    contract: checksummedUiProvider,
    provider: checksummedProvider,
  });
  
  try {
    // Call UiPoolDataProviderV3.getReservesData with checksummed addresses
    console.log(`[Earn] ${name}: About to call readContract...`);
    
    let result: [AaveReserveData[], unknown];
    try {
      result = await fetchWithRetry(async () => {
        const res = await (client.readContract as any)({
          address: checksummedUiProvider,
          abi: UI_POOL_DATA_PROVIDER_ABI,
          functionName: 'getReservesData',
          args: [checksummedProvider],
        });
        console.log(`[Earn] ${name}: readContract returned successfully, type:`, typeof res, Array.isArray(res));
        return res as [AaveReserveData[], unknown];
      }, 1, 1000, `getReservesData-${name}`);
    } catch (readError: any) {
      console.error(`[Earn] ${name}: readContract FAILED:`, readError?.message?.substring(0, 500));
      console.error(`[Earn] ${name}: readContract ERROR FULL:`, JSON.stringify(readError, Object.getOwnPropertyNames(readError || {})));
      throw readError;
    }

    console.log(`[Earn] ${name}: Result received, extracting reserves...`);
    const [reserves] = result;
    console.log(`[Earn] ${name}: Reserves extracted, count:`, reserves?.length, 'first reserve symbol:', reserves?.[0]?.symbol);
    
    if (!reserves || reserves.length === 0) {
      const error = {
        type: 'no_markets' as const,
        chainId,
        chainName: name,
        message: `No Aave V3 markets available on ${name}`,
      };
      console.error('[AAVE FETCH FAIL]', chainId, name, error);
      throw error;
    }

    console.log(`[Earn] ${name} (${chainId}): ✓ getReservesData returned ${reserves.length} reserves`, {
      step: '3-parse',
    });

    const aaveUiUrl = `https://app.aave.com/reserve-overview/?underlyingAsset=`;
    const marketName = AAVE_MARKET_NAMES[chainId] || '';

    // Map reserves to LendingMarket format with safe bigint conversions
    const markets = reserves
      .filter((r) => r.isActive && !r.isFrozen && !r.isPaused)
      .map((reserve) => {
        // Get decimals safely first
        const decimals = getDecimals(reserve.decimals);

        // Convert RAY rates to APY percentage using formatUnits (no overflow)
        const supplyAPY = rayToPercent(reserve.liquidityRate);
        const borrowAPY = rayToPercent(reserve.variableBorrowRate);

        // Calculate liquidity and debt using safe conversion
        const availableLiquidity = toTokenAmount(reserve.availableLiquidity, decimals);
        const totalScaledVariableDebt = toTokenAmount(reserve.totalScaledVariableDebt, decimals);
        
        // TVL = available + variable debt (no stable debt in this ABI version)
        const tvl = availableLiquidity + totalScaledVariableDebt;

        return {
          id: `aave-${chainId}-${reserve.underlyingAsset}`,
          protocol: 'aave' as const,
          chainId,
          chainName: name,
          chainLogo: logo,
          assetSymbol: reserve.symbol,
          assetName: reserve.name,
          assetAddress: reserve.underlyingAsset,
          assetLogo: getTokenLogo(reserve.symbol),
          supplyAPY,
          borrowAPY,
          isVariable: true,
          tvl: tvl > 0 ? tvl : null,
          availableLiquidity: availableLiquidity > 0 ? availableLiquidity : null,
          collateralEnabled: reserve.usageAsCollateralEnabled,
          decimals,
          marketId: reserve.underlyingAsset,
          protocolUrl: `${aaveUiUrl}${reserve.underlyingAsset}&marketName=${marketName}`,
        };
      });

    console.log(`[Earn] ${name} (${chainId}): ✓ Mapped ${markets.length} active markets`, {
      step: '4-complete',
      sample: markets.length > 0 ? {
        symbol: markets[0].assetSymbol,
        supplyAPY: markets[0].supplyAPY.toFixed(2) + '%',
        borrowAPY: markets[0].borrowAPY.toFixed(2) + '%',
      } : null,
    });

    // Cache the results
    setCachedMarkets(chainId, markets);
    
    return markets;
  } catch (error: any) {
    // VERBOSE ERROR LOGGING FOR DEBUGGING
    console.error(`[AAVE ERROR RAW]`, chainId, name, error);
    console.error(`[AAVE ERROR JSON]`, chainId, name, JSON.stringify(error, Object.getOwnPropertyNames(error || {})));
    
    // Check if it's already our error type
    if (typeof error === 'object' && error !== null && 'type' in error) {
      throw error;
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error(`[AAVE FETCH FAIL]`, chainId, name, {
      step: 'getReservesData',
      contract: checksummedUiProvider,
      message: errorMessage,
      stack: error?.stack?.substring(0, 500),
    });
    
    // Categorize the error more specifically
    let errorType: MarketFetchErrorType = 'contract_error';
    let detailedMessage = errorMessage;
    let httpStatus: number | undefined;

    if (errorMessage.includes('429')) {
      errorType = 'rate_limited';
      detailedMessage = `Rate limited on ${name}`;
      httpStatus = 429;
    } else if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT') || errorMessage.includes('abort')) {
      errorType = 'timeout';
      detailedMessage = `Timeout fetching ${name} markets`;
    } else if (errorMessage.includes('execution reverted')) {
      errorType = 'contract_error';
      detailedMessage = `Contract call reverted on ${name}`;
    } else if (errorMessage.includes('Bytes value') && errorMessage.includes('boolean')) {
      errorType = 'contract_error';
      detailedMessage = `ABI decode error on ${name} - struct field mismatch`;
    } else if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
      errorType = 'network_error';
      detailedMessage = `Network error on ${name}`;
    }
    
    throw {
      type: errorType,
      chainId,
      chainName: name,
      message: detailedMessage,
      failedAddress: checksummedUiProvider,
      httpStatus,
    } as MarketFetchError;
  }
}

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
  const [markets, setMarkets] = useState<LendingMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MarketFetchError | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [chainResults, setChainResults] = useState<ChainFetchResult[]>([]);
  const [partialFailures, setPartialFailures] = useState<ChainFailure[]>([]);
  
  const fetchInProgress = useRef(false);

  const fetchSingleChain = useCallback(async (chainConfig: ChainConfig): Promise<ChainFetchResult> => {
    try {
      const chainMarkets = await fetchAaveMarketsOnChain(chainConfig);
      return {
        chainId: chainConfig.chainId,
        chainName: chainConfig.name,
        success: true,
        markets: chainMarkets,
      };
    } catch (err) {
      const fetchError = err as MarketFetchError;
      return {
        chainId: chainConfig.chainId,
        chainName: chainConfig.name,
        success: false,
        markets: [],
        error: fetchError.message || 'Unknown error',
        errorType: fetchError.type,
        httpStatus: fetchError.httpStatus,
      };
    }
  }, []);

  const fetchAllMarkets = useCallback(async (isRetry = false, specificChainId?: number) => {
    // Prevent concurrent fetches
    if (fetchInProgress.current && !isRetry) {
      return;
    }
    fetchInProgress.current = true;

    // Always log for debugging (helps diagnose production issues)
    console.log('[Earn] Starting market fetch...', {
      selectedChainId: selectedChainId ?? 'all',
      specificChainId,
      isRetry,
      supportedChains: SUPPORTED_CHAINS.map(c => `${c.chainId}:${c.name}:${c.rpcSource}`).join(', '),
    });

    if (isRetry) {
      setIsRetrying(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setErrorMessage(null);

    try {
      let allMarkets: LendingMarket[] = [];
      const results: ChainFetchResult[] = [];
      const failures: ChainFailure[] = [];

      // Determine which chains to fetch
      let chainsToFetch: ChainConfig[];
      
      if (specificChainId !== undefined) {
        // Retry specific chain
        const chainConfig = getChainConfig(specificChainId);
        if (!chainConfig) {
          throw {
            type: 'unsupported_chain',
            chainId: specificChainId,
            message: `Chain ${specificChainId} is not supported.`,
          } as MarketFetchError;
        }
        chainsToFetch = [chainConfig];
        
        // Keep existing markets from other chains
        allMarkets = [...markets.filter(m => m.chainId !== specificChainId)];
        results.push(...chainResults.filter(r => r.chainId !== specificChainId));
      } else if (selectedChainId !== undefined) {
        // Single chain selected
        const chainConfig = getChainConfig(selectedChainId);
        if (!chainConfig) {
          throw {
            type: 'unsupported_chain',
            chainId: selectedChainId,
            message: `Chain ${selectedChainId} is not supported for Earn.`,
          } as MarketFetchError;
        }
        chainsToFetch = [chainConfig];
      } else {
        // All chains
        chainsToFetch = [...SUPPORTED_CHAINS];
      }

      // Fetch with concurrency limiting
      const fetchResults = await fetchWithConcurrencyLimit(chainsToFetch, fetchSingleChain);

      // Process results
      for (const result of fetchResults) {
        if (result && typeof result === 'object' && 'chainId' in result) {
          const chainResult = result as ChainFetchResult;
          results.push(chainResult);
          
          if (chainResult.success) {
            allMarkets.push(...chainResult.markets);
            console.log(`[Earn] ✓ ${chainResult.chainName}: ${chainResult.markets.length} markets loaded`);
          } else {
            failures.push({
              chainId: chainResult.chainId,
              chainName: chainResult.chainName,
              error: chainResult.error || 'Unknown error',
              errorType: chainResult.errorType || 'network_error',
              httpStatus: chainResult.httpStatus,
            });
            console.warn(`[Earn] ✗ ${chainResult.chainName}: ${chainResult.error}`);
          }
        }
      }

      // If ALL chains failed, show error
      if (allMarkets.length === 0 && failures.length > 0) {
        throw {
          type: 'network_error',
          message: 'Unable to fetch market data from any chain. Please check your connection and try again.',
          failedChains: failures,
        } as MarketFetchError;
      }

      // Set partial failures (non-blocking warning)
      setPartialFailures(failures);

      // Sort by TVL descending (popularity proxy)
      allMarkets.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
      setMarkets(allMarkets);
      setChainResults(results);
      setLastFetched(Date.now());

      console.log(`[Earn] Fetch complete: ${allMarkets.length} total markets from ${results.filter(r => r.success).length}/${results.length} chains`);

    } catch (err) {
      console.error('[Earn] Failed to fetch lending markets:', err);
      
      if (typeof err === 'object' && err !== null && 'type' in err) {
        const marketError = err as MarketFetchError;
        setError(marketError);
        setErrorMessage(getErrorMessage(marketError));
      } else {
        const genericError: MarketFetchError = {
          type: 'network_error',
          message: String(err),
        };
        setError(genericError);
        setErrorMessage('Failed to load Aave markets. Please try again.');
      }
      
      // Keep existing markets on retry failure
      if (!isRetry) {
        setMarkets([]);
      }
    } finally {
      setLoading(false);
      setIsRetrying(false);
      fetchInProgress.current = false;
    }
  }, [selectedChainId, markets, chainResults, fetchSingleChain]);

  useEffect(() => {
    fetchAllMarkets();
  }, [selectedChainId]); // Only refetch when selectedChainId changes

  const refresh = useCallback(() => {
    // Clear cache
    marketCache.clear();
    fetchAllMarkets(true);
  }, [fetchAllMarkets]);

  const refreshChain = useCallback((chainId: number) => {
    // Clear cache for this chain
    marketCache.delete(chainId);
    fetchAllMarkets(true, chainId);
  }, [fetchAllMarkets]);

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

// Generate user-friendly error messages
function getErrorMessage(error: MarketFetchError): string {
  switch (error.type) {
    case 'unsupported_chain':
      return `Aave V3 is not available on ${error.chainName || `chain ${error.chainId}`}. Please select a supported chain.`;
    
    case 'missing_rpc':
      return `Missing RPC configuration: ${error.missingEnvKey}. Please configure the RPC endpoint.`;
    
    case 'rpc_unavailable':
      return `Unable to connect to ${error.chainName || 'the network'}. The RPC endpoint is unavailable.`;
    
    case 'rate_limited':
      return `Rate limited on ${error.chainName || 'the network'}. Please wait a moment and try again.`;
    
    case 'timeout':
      return `Request timed out for ${error.chainName || 'the network'}. The RPC may be overloaded.`;
    
    case 'contract_error':
      return `Aave contracts not reachable on ${error.chainName || 'the network'}. ${error.message}`;
    
    case 'no_markets':
      return `No Aave V3 markets available on ${error.chainName || 'this chain'}.`;
    
    case 'network_error':
    default:
      return error.message || 'Failed to load Aave markets. Please try again.';
  }
}

// Legacy exports for backward compatibility
export function getPoolAddress(chainId: number): `0x${string}` | null {
  const addresses = getAaveAddresses(chainId);
  return addresses?.POOL || null;
}

export function getExplorerUrl(chainId: number, txHash: string): string {
  const config = getChainConfig(chainId);
  return config ? `${config.explorerUrl}${txHash}` : `https://etherscan.io/tx/${txHash}`;
}
