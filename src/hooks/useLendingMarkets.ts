/**
 * Lending Markets Hook — Aave V3 Integration
 * 
 * Hybrid approach: Tries on-chain UiPoolDataProviderV3.getReservesData() first,
 * falls back to DeFi Llama API with proper borrow data matching.
 * Supports retry with fallback RPCs.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPublicClient, http, formatUnits, getAddress, erc20Abi } from 'viem';
import { resolveTokenLogo, resolveChainLogo } from '@/lib/logoResolver';
import { getTokens } from '@/lib/lifiClient';
import { fetchPrices } from '@/lib/prices';
import { mainnet, arbitrum, optimism, polygon, base, avalanche } from 'viem/chains';
import { SUPPORTED_CHAINS, getChainConfig, getFallbackRpcs, type ChainConfig } from '@/lib/chainConfig';
import { getAaveAddresses, UI_POOL_DATA_PROVIDER_ABI, type AaveReserveData, type AaveBaseCurrencyInfo } from '@/lib/aaveAddressBook';

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
// TOKEN LOGOS — delegated to global resolver
// ============================================

function getTokenLogo(symbol: string, address?: string, chainId?: number): string {
  return resolveTokenLogo({ symbol, address, chainId });
}

function getChainLogoUrl(chainId: number): string {
  return resolveChainLogo(chainId);
}

// ============================================
// VIEM CHAINS
// ============================================

const VIEM_CHAINS: Record<number, any> = {
  1: mainnet, 42161: arbitrum, 10: optimism, 137: polygon, 8453: base, 43114: avalanche,
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
// DEFI LLAMA FALLBACK (improved with borrow data)
// ============================================

const CHAIN_NAME_TO_ID: Record<string, number> = {
  'Ethereum': 1, 'Arbitrum': 42161, 'Optimism': 10, 'Polygon': 137, 'Base': 8453, 'Avalanche': 43114,
};

// Known non-borrowable assets (supply-only collateral)
const NON_BORROWABLE_SYMBOLS = new Set(['STETH', 'CBETH', 'RETH', 'WSTETH', 'OSETH', 'WEETH', 'EZETH', 'RSETH', 'SDAI', 'SUSDS', 'SUSDE']);

async function fetchFromDefiLlama(): Promise<LendingMarket[]> {
  console.log('[Earn] Falling back to DeFi Llama API...');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  
  try {
    const response = await fetch('https://yields.llama.fi/pools', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`DeFi Llama API returned ${response.status}`);
    
    const json = await response.json();
    const allAavePools = (json.data || json).filter(
      (p: any) => p.project === 'aave-v3' && p.chain in CHAIN_NAME_TO_ID && p.tvlUsd > 10000
    );

    // Fetch LiFi token metadata per chain for correct decimals
    const chainIds = [...new Set(allAavePools.map((p: any) => CHAIN_NAME_TO_ID[p.chain]).filter(Boolean))];
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
    
    // Build a map: chainId -> symbol -> borrow APY data
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

    // Deduplicate by chainId-symbol, preferring entry with highest TVL
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

    return Array.from(deduped.values()).map((pool: any) => {
      const chainId = Number(CHAIN_NAME_TO_ID[pool.chain]);
      const chainCfg = getChainConfig(chainId);
      const symbol = pool.symbol.split('-')[0].trim().toUpperCase();
      const tokenAddress = (pool.underlyingTokens?.[0] || '0x0000000000000000000000000000000000000000') as `0x${string}`;
      const supplyAPY = pool.apy ?? pool.apyBase ?? 0;
      
      // Look up borrow APY from the map
      const borrowKey = `${chainId}-${symbol}`;
      const borrowAPY = borrowDataMap.get(borrowKey) ?? Math.abs((pool.apyBaseBorrow ?? 0) + (pool.apyRewardBorrow ?? 0));
      
      const collateralEnabled = (pool.ltv ?? 0) > 0;
      const marketName = AAVE_MARKET_NAMES[chainId] || '';
      
      // Get correct decimals from LiFi token metadata
      const meta = tokenMetaMap.get(`${chainId}:${tokenAddress.toLowerCase()}`);
      const decimals = meta?.decimals ?? 18; // Fallback to 18 only if unknown
      
      const isBorrowable = !NON_BORROWABLE_SYMBOLS.has(symbol);
      
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
        tvl: pool.tvlUsd,
        totalSupplyUsd: pool.totalSupplyUsd || pool.tvlUsd || 0,
        totalBorrowUsd: pool.totalBorrowUsd || 0,
        availableLiquidity: pool.totalSupplyUsd && pool.totalBorrowUsd ? pool.totalSupplyUsd - pool.totalBorrowUsd : pool.tvlUsd,
        availableLiquidityUsd: pool.totalSupplyUsd && pool.totalBorrowUsd ? (pool.totalSupplyUsd - pool.totalBorrowUsd) : pool.tvlUsd,
        collateralEnabled,
        ltv: (pool.ltv ?? 0) * 100,
        liquidationThreshold: 0,
        liquidationBonus: 0,
        supplyCap: 0,
        borrowCap: 0,
        reserveFactor: 0,
        utilizationRate: pool.totalSupplyUsd ? ((pool.totalBorrowUsd || 0) / pool.totalSupplyUsd) * 100 : 0,
        priceUsd: 0,
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
        protocolUrl: `https://app.aave.com/reserve-overview/?underlyingAsset=${tokenAddress}&marketName=${marketName}`,
      } as LendingMarket;
    }).sort((a: LendingMarket, b: LendingMarket) => (b.tvl || 0) - (a.tvl || 0));
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ============================================
// ON-CHAIN FETCH PER CHAIN (with RPC retry)
// ============================================

function rayRateToAPY(rayRate: bigint): number {
  const ratePerSecond = Number(rayRate) / 1e27;
  const SECONDS_PER_YEAR = 31536000;
  if (ratePerSecond < 1e-12) return 0;
  const apr = ratePerSecond * SECONDS_PER_YEAR;
  return apr * 100;
}

async function tryFetchWithRpc(
  rpcUrl: string,
  chainConfig: ChainConfig,
  viemChain: any,
  aaveAddresses: { POOL_ADDRESSES_PROVIDER: string; UI_POOL_DATA_PROVIDER: string }
): Promise<any> {
  const client = createPublicClient({
    chain: viemChain,
    transport: http(rpcUrl, { timeout: 15_000 }),
  });

  const checksummedProvider = getAddress(aaveAddresses.POOL_ADDRESSES_PROVIDER);
  const checksummedUiProvider = getAddress(aaveAddresses.UI_POOL_DATA_PROVIDER);

  return await (client.readContract as any)({
    address: checksummedUiProvider,
    abi: UI_POOL_DATA_PROVIDER_ABI,
    functionName: 'getReservesData',
    args: [checksummedProvider],
  });
}

async function fetchChainReserves(chainConfig: ChainConfig): Promise<ChainFetchResult> {
  const { chainId, name, logo } = chainConfig;

  const aaveAddresses = getAaveAddresses(chainId);
  if (!aaveAddresses) {
    return { chainId, chainName: name, success: false, markets: [], error: 'No Aave addresses', errorType: 'unsupported_chain' };
  }

  const viemChain = VIEM_CHAINS[chainId];
  if (!viemChain) {
    return { chainId, chainName: name, success: false, markets: [], error: 'Chain not configured', errorType: 'unsupported_chain' };
  }

  // Build list of RPCs to try: primary first, then fallbacks
  const rpcsToTry: string[] = [];
  if (chainConfig.rpcUrl) rpcsToTry.push(chainConfig.rpcUrl);
  const fallbacks = getFallbackRpcs(chainId);
  for (const fb of fallbacks) {
    if (!rpcsToTry.includes(fb)) rpcsToTry.push(fb);
  }

  if (rpcsToTry.length === 0) {
    return { chainId, chainName: name, success: false, markets: [], error: 'No RPC URL', errorType: 'missing_rpc' };
  }

  let lastError = '';
  
  for (const rpcUrl of rpcsToTry) {
    try {
      const result = await tryFetchWithRpc(rpcUrl, chainConfig, viemChain, aaveAddresses);
      const [reserves, baseCurrencyInfo] = result;

      if (!reserves || reserves.length === 0) {
        lastError = 'No reserves returned';
        continue;
      }

      const marketRefUnit = Number(baseCurrencyInfo.marketReferenceCurrencyUnit);
      const marketRefPriceInUsd = Number(baseCurrencyInfo.marketReferenceCurrencyPriceInUsd) / 1e8;

      const markets: LendingMarket[] = [];

      for (const r of reserves) {
        if (!r.isActive) continue;

        const decimals = Number(r.decimals);
        const symbol = r.symbol || '???';
        
        const priceInRef = Number(r.priceInMarketReferenceCurrency) / marketRefUnit;
        const priceUsd = priceInRef * marketRefPriceInUsd;
        const availableLiq = Number(formatUnits(r.availableLiquidity, decimals));
        const availableLiqUsd = availableLiq * priceUsd;
        const totalScaledDebt = Number(formatUnits(r.totalScaledVariableDebt, decimals));
        const borrowIndex = Number(r.variableBorrowIndex) / 1e27;
        const totalBorrow = totalScaledDebt * borrowIndex;
        const totalBorrowUsd = totalBorrow * priceUsd;
        const totalSupply = availableLiq + totalBorrow;
        const totalSupplyUsd = totalSupply * priceUsd;
        const utilizationRate = totalSupply > 0 ? (totalBorrow / totalSupply) * 100 : 0;
        const supplyAPY = rayRateToAPY(r.liquidityRate);
        const borrowAPY = rayRateToAPY(r.variableBorrowRate);
        const ltv = Number(r.baseLTVasCollateral) / 100;
        const liquidationThreshold = Number(r.reserveLiquidationThreshold) / 100;
        const liquidationBonus = (Number(r.reserveLiquidationBonus) / 100) - 100;
        const reserveFactor = Number(r.reserveFactor) / 100;
        const collateralEnabled = r.usageAsCollateralEnabled && ltv > 0;
        const supplyCap = Number(r.supplyCap);
        const borrowCap = Number(r.borrowCap);
        const marketName = AAVE_MARKET_NAMES[chainId] || '';
        const assetAddr = r.underlyingAsset.toLowerCase();
        const protocolUrl = `https://app.aave.com/reserve-overview/?underlyingAsset=${assetAddr}&marketName=${marketName}`;

        markets.push({
          id: `aave-${chainId}-${r.underlyingAsset}`,
          protocol: 'aave',
          chainId,
          chainName: name,
          chainLogo: getChainLogoUrl(chainId),
          assetSymbol: symbol,
          assetName: r.name || symbol,
          assetAddress: r.underlyingAsset,
          assetLogo: getTokenLogo(symbol, r.underlyingAsset, chainId),
          decimals,
          supplyAPY,
          borrowAPY,
          isVariable: true,
          tvl: totalSupplyUsd,
          totalSupplyUsd,
          totalBorrowUsd,
          availableLiquidity: availableLiq,
          availableLiquidityUsd: availableLiqUsd,
          collateralEnabled,
          ltv,
          liquidationThreshold,
          liquidationBonus,
          supplyCap,
          borrowCap,
          reserveFactor,
          utilizationRate,
          priceUsd,
          aTokenAddress: r.aTokenAddress,
          variableDebtTokenAddress: r.variableDebtTokenAddress,
          isActive: r.isActive,
          isFrozen: r.isFrozen,
          isPaused: r.isPaused,
          borrowingEnabled: r.borrowingEnabled,
          liquidityIndex: r.liquidityIndex,
          variableBorrowIndex: r.variableBorrowIndex,
          eModeCategoryId: r.eModeCategoryId,
          marketId: r.underlyingAsset,
          protocolUrl,
        });
      }

      markets.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
      console.log(`[Earn] ✓ ${name}: ${markets.length} reserves loaded on-chain`);
      return { chainId, chainName: name, success: true, markets };

    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.warn(`[Earn] ${name}: RPC failed (${new URL(rpcUrl).hostname}): ${lastError.slice(0, 80)}`);
      // Try next RPC
    }
  }

  console.error(`[Earn] ✗ ${name}: All RPCs failed. Last error: ${lastError}`);
  return { chainId, chainName: name, success: false, markets: [], error: lastError, errorType: 'contract_error' };
}

// ============================================
// HOOK
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

export function useLendingMarkets(selectedChainId?: number): UseLendingMarketsResult {
  const [allMarkets, setAllMarkets] = useState<LendingMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MarketFetchError | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [chainResults, setChainResults] = useState<ChainFetchResult[]>([]);
  const [partialFailures, setPartialFailures] = useState<ChainFailure[]>([]);

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

      console.log('[Earn] Fetching Aave V3 reserves...');

      // Try on-chain first, with DeFi Llama as parallel fallback
      const onChainPromise = Promise.all(
        SUPPORTED_CHAINS.map(chain => fetchChainReserves(chain))
      );
      
      // Start DeFi Llama fetch in parallel as backup
      const llamaPromise = fetchFromDefiLlama().catch(err => {
        console.warn('[Earn] DeFi Llama pre-fetch failed:', err);
        return [] as LendingMarket[];
      });

      const [results, llamaMarkets] = await Promise.all([onChainPromise, llamaPromise]);

      setChainResults(results);

      const allMkts: LendingMarket[] = [];
      const failures: ChainFailure[] = [];
      const successfulChainIds = new Set<number>();

      for (const r of results) {
        if (r.success) {
          allMkts.push(...r.markets);
          successfulChainIds.add(r.chainId);
        } else if (r.error) {
          failures.push({
            chainId: r.chainId,
            chainName: r.chainName,
            error: r.error,
            errorType: r.errorType || 'contract_error',
          });
        }
      }

      // For chains that failed on-chain, fill in from DeFi Llama
      if (failures.length > 0 && llamaMarkets.length > 0) {
        for (const failure of failures) {
          const llamaForChain = llamaMarkets.filter(m => m.chainId === failure.chainId);
          if (llamaForChain.length > 0) {
            allMkts.push(...llamaForChain);
            successfulChainIds.add(failure.chainId);
            console.log(`[Earn] ✓ ${failure.chainName}: ${llamaForChain.length} markets from DeFi Llama fallback`);
          }
        }
      }

      // Update failures to only include chains that truly have no data
      const remainingFailures = failures.filter(f => !successfulChainIds.has(f.chainId));
      setPartialFailures(remainingFailures);

      let finalMarkets: LendingMarket[] = [];
      if (allMkts.length === 0 && llamaMarkets.length > 0) {
        finalMarkets = llamaMarkets;
        console.log(`[Earn] ✓ Full DeFi Llama fallback: ${llamaMarkets.length} markets`);
      } else if (allMkts.length > 0) {
        allMkts.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
        finalMarkets = allMkts;
        console.log(`[Earn] ✓ Total: ${allMkts.length} markets from ${successfulChainIds.size}/${SUPPORTED_CHAINS.length} chains`);
      } else {
        setError({ type: 'network_error', message: 'Unable to load market data' });
        setErrorMessage('Unable to load Aave V3 market data. Please try again.');
      }

      // Enrich markets missing prices via DefiLlama
      if (finalMarkets.length > 0) {
        const missingPriceTokens = finalMarkets
          .filter(m => m.priceUsd <= 0)
          .map(m => ({ chainId: m.chainId, address: m.assetAddress }));

        if (missingPriceTokens.length > 0) {
          try {
            const prices = await fetchPrices(missingPriceTokens);
            for (const m of finalMarkets) {
              if (m.priceUsd <= 0) {
                const key = `${m.chainId}:${m.assetAddress.toLowerCase()}`;
                const tp = prices.get(key);
                if (tp) {
                  m.priceUsd = tp.usdPrice;
                }
              }
            }
            console.log(`[Earn] ✓ Enriched ${missingPriceTokens.length} token prices from DefiLlama`);
          } catch (e) {
            console.warn('[Earn] Price enrichment failed:', e);
          }
        }

        setAllMarkets(finalMarkets);
        setLastFetched(Date.now());
        globalCache = { markets: finalMarkets, timestamp: Date.now() };
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
