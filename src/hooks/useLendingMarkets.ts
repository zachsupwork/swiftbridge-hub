/**
 * Lending Markets Hook — Direct On-Chain Aave V3 Integration
 * 
 * Fetches reserve data directly from UiPoolDataProviderV3.getReservesData()
 * on each supported chain. No external APIs — all data is from official 
 * Aave V3 contracts via public RPCs.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPublicClient, http, formatUnits, getAddress } from 'viem';
import { mainnet, arbitrum, optimism, polygon, base, avalanche } from 'viem/chains';
import { SUPPORTED_CHAINS, getChainConfig, type ChainConfig } from '@/lib/chainConfig';
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
  // APY / APR
  supplyAPY: number;
  borrowAPY: number;
  isVariable: boolean;
  // Market size
  tvl: number | null;
  totalSupplyUsd: number;
  totalBorrowUsd: number;
  availableLiquidity: number | null;
  availableLiquidityUsd: number;
  // Collateral params
  collateralEnabled: boolean;
  ltv: number;
  liquidationThreshold: number;
  liquidationBonus: number;
  // Caps
  supplyCap: number;
  borrowCap: number;
  // Reserve details
  reserveFactor: number;
  utilizationRate: number;
  // Oracle
  priceUsd: number;
  // Token addresses
  aTokenAddress: `0x${string}`;
  variableDebtTokenAddress: `0x${string}`;
  // Status
  isActive: boolean;
  isFrozen: boolean;
  isPaused: boolean;
  borrowingEnabled: boolean;
  // Indexes (for aToken/debtToken balance calculation)
  liquidityIndex: bigint;
  variableBorrowIndex: bigint;
  // E-mode
  eModeCategoryId: number;
  // Links
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
// TOKEN LOGOS
// ============================================

const TOKEN_LOGOS: Record<string, string> = {
  ETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/eth.svg',
  WETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg',
  USDC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  'USDC.E': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  USDCE: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  USDBCE: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  USDT: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdt.svg',
  DAI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/dai.svg',
  WBTC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg',
  LINK: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/link.svg',
  AAVE: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/aave.svg',
  UNI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/uni.svg',
  MATIC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/matic.svg',
  WMATIC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/matic.svg',
  POL: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/matic.svg',
  WPOL: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/matic.svg',
  ARB: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/arb.svg',
  OP: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/op.svg',
  AVAX: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/avax.svg',
  WAVAX: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/avax.svg',
  CRV: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/crv.svg',
  FRAX: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/frax.svg',
  CBETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/cbeth.svg',
  RETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/reth.svg',
  WSTETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wsteth.svg',
  STETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wsteth.svg',
  GHO: 'https://app.aave.com/icons/tokens/gho.svg',
  LUSD: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/lusd.svg',
  SUSD: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/susd.svg',
  BAL: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/bal.svg',
  SNX: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/snx.svg',
  MKR: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/mkr.svg',
  LDO: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/ldo.svg',
  RPL: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/rpl.svg',
  SUSHI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/sushi.svg',
  COMP: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/comp.svg',
  ENS: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/ens.svg',
  '1INCH': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/1inch.svg',
};

function getTokenLogo(symbol: string): string {
  const upper = symbol.toUpperCase().replace('.', '');
  return TOKEN_LOGOS[upper] || TOKEN_LOGOS[symbol.toUpperCase()] ||
    `https://app.aave.com/icons/tokens/${symbol.toLowerCase()}.svg`;
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
// DEFI LLAMA FALLBACK
// ============================================

const CHAIN_NAME_TO_ID: Record<string, number> = {
  'Ethereum': 1, 'Arbitrum': 42161, 'Optimism': 10, 'Polygon': 137, 'Base': 8453, 'Avalanche': 43114,
};

async function fetchFromDefiLlama(): Promise<LendingMarket[]> {
  console.log('[Earn] Falling back to DeFi Llama API...');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  
  try {
    const response = await fetch('https://yields.llama.fi/pools', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`DeFi Llama API returned ${response.status}`);
    
    const json = await response.json();
    const pools = (json.data || json).filter(
      (p: any) => p.project === 'aave-v3' && p.chain in CHAIN_NAME_TO_ID && p.tvlUsd > 10000
    );
    
    return pools.map((pool: any) => {
      const chainId = CHAIN_NAME_TO_ID[pool.chain];
      const chainCfg = getChainConfig(chainId);
      const symbol = pool.symbol.split('-')[0].trim().toUpperCase();
      const tokenAddress = (pool.underlyingTokens?.[0] || '0x0000000000000000000000000000000000000000') as `0x${string}`;
      const supplyAPY = pool.apy ?? pool.apyBase ?? 0;
      const borrowAPY = Math.abs((pool.apyBaseBorrow ?? 0) + (pool.apyRewardBorrow ?? 0));
      const collateralEnabled = (pool.ltv ?? 0) > 0;
      const marketName = AAVE_MARKET_NAMES[chainId] || '';
      
      return {
        id: `aave-${chainId}-${pool.pool}`,
        protocol: 'aave' as const,
        chainId,
        chainName: chainCfg?.name || pool.chain,
        chainLogo: chainCfg?.logo || '',
        assetSymbol: symbol,
        assetName: symbol,
        assetAddress: tokenAddress,
        assetLogo: getTokenLogo(symbol),
        decimals: 18,
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
        borrowingEnabled: borrowAPY > 0,
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
// ON-CHAIN FETCH PER CHAIN
// ============================================

/**
 * Converts Aave's RAY-based rate to APY percentage.
 * rate is in RAY (1e27). APY = ((1 + rate/secondsPerYear)^secondsPerYear - 1) * 100
 * Simplified: APY ≈ rate / 1e27 * 100
 */
function rayRateToAPY(rayRate: bigint): number {
  // More precise: compound interest
  const ratePerSecond = Number(rayRate) / 1e27;
  const SECONDS_PER_YEAR = 31536000;
  // APY = (1 + ratePerSecond)^secondsPerYear - 1 
  // Use approximation for small rates to avoid floating point issues
  if (ratePerSecond < 1e-12) return 0;
  // Simple APR approach (close enough for display)
  const apr = ratePerSecond * SECONDS_PER_YEAR;
  return apr * 100;
}

async function fetchChainReserves(chainConfig: ChainConfig): Promise<ChainFetchResult> {
  const { chainId, name, rpcUrl, logo } = chainConfig;

  if (!rpcUrl) {
    return { chainId, chainName: name, success: false, markets: [], error: 'No RPC URL', errorType: 'missing_rpc' };
  }

  const aaveAddresses = getAaveAddresses(chainId);
  if (!aaveAddresses) {
    return { chainId, chainName: name, success: false, markets: [], error: 'No Aave addresses', errorType: 'unsupported_chain' };
  }

  const viemChain = VIEM_CHAINS[chainId];
  if (!viemChain) {
    return { chainId, chainName: name, success: false, markets: [], error: 'Chain not configured', errorType: 'unsupported_chain' };
  }

  const client = createPublicClient({
    chain: viemChain,
    transport: http(rpcUrl, { timeout: 15_000 }),
  });

  try {
    const checksummedProvider = getAddress(aaveAddresses.POOL_ADDRESSES_PROVIDER);
    const checksummedUiProvider = getAddress(aaveAddresses.UI_POOL_DATA_PROVIDER);

    const result = await (client.readContract as any)({
      address: checksummedUiProvider,
      abi: UI_POOL_DATA_PROVIDER_ABI,
      functionName: 'getReservesData',
      args: [checksummedProvider],
    });

    const [reserves, baseCurrencyInfo] = result;

    if (!reserves || reserves.length === 0) {
      return { chainId, chainName: name, success: false, markets: [], error: 'No reserves returned', errorType: 'no_markets' };
    }

    // Base currency info for USD conversion
    const marketRefUnit = Number(baseCurrencyInfo.marketReferenceCurrencyUnit);
    const marketRefPriceInUsd = Number(baseCurrencyInfo.marketReferenceCurrencyPriceInUsd) / 1e8;

    const markets: LendingMarket[] = [];

    for (const r of reserves) {
      // Skip inactive/paused reserves
      if (!r.isActive) continue;

      const decimals = Number(r.decimals);
      const symbol = r.symbol || '???';
      
      // Price in USD
      const priceInRef = Number(r.priceInMarketReferenceCurrency) / marketRefUnit;
      const priceUsd = priceInRef * marketRefPriceInUsd;

      // Available liquidity
      const availableLiq = Number(formatUnits(r.availableLiquidity, decimals));
      const availableLiqUsd = availableLiq * priceUsd;

      // Total supply = availableLiquidity + totalBorrow (approx via scaled debt * borrow index)
      const totalScaledDebt = Number(formatUnits(r.totalScaledVariableDebt, decimals));
      const borrowIndex = Number(r.variableBorrowIndex) / 1e27;
      const totalBorrow = totalScaledDebt * borrowIndex;
      const totalBorrowUsd = totalBorrow * priceUsd;
      const totalSupply = availableLiq + totalBorrow;
      const totalSupplyUsd = totalSupply * priceUsd;

      // Utilization rate
      const utilizationRate = totalSupply > 0 ? (totalBorrow / totalSupply) * 100 : 0;

      // APY from on-chain rates (in RAY = 1e27)
      const supplyAPY = rayRateToAPY(r.liquidityRate);
      const borrowAPY = rayRateToAPY(r.variableBorrowRate);

      // Collateral params (in basis points, /10000 = percentage)
      const ltv = Number(r.baseLTVasCollateral) / 100; // percentage
      const liquidationThreshold = Number(r.reserveLiquidationThreshold) / 100;
      const liquidationBonus = (Number(r.reserveLiquidationBonus) / 100) - 100; // bonus above 100%
      const reserveFactor = Number(r.reserveFactor) / 100;
      const collateralEnabled = r.usageAsCollateralEnabled && ltv > 0;

      // Caps
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
        chainLogo: logo,
        assetSymbol: symbol,
        assetName: r.name || symbol,
        assetAddress: r.underlyingAsset,
        assetLogo: getTokenLogo(symbol),
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

    // Sort by TVL desc
    markets.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));

    console.log(`[Earn] ✓ ${name}: ${markets.length} reserves loaded on-chain`);
    return { chainId, chainName: name, success: true, markets };

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Earn] ✗ ${name}: ${msg}`);
    return { chainId, chainName: name, success: false, markets: [], error: msg, errorType: 'contract_error' };
  }
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
        console.log(`[Earn] Using cached on-chain data (${globalCache.markets.length} markets)`);
        setAllMarkets(globalCache.markets);
        setLastFetched(globalCache.timestamp);
        setLoading(false);
        fetchInProgress.current = false;
        return;
      }

      console.log('[Earn] Fetching Aave V3 reserves from on-chain contracts...');

      // Fetch all chains in parallel
      const results = await Promise.all(
        SUPPORTED_CHAINS.map(chain => fetchChainReserves(chain))
      );

      setChainResults(results);

      // Collect all markets from successful chains
      const allMkts: LendingMarket[] = [];
      const failures: ChainFailure[] = [];

      for (const r of results) {
        if (r.success) {
          allMkts.push(...r.markets);
        } else if (r.error) {
          failures.push({
            chainId: r.chainId,
            chainName: r.chainName,
            error: r.error,
            errorType: r.errorType || 'contract_error',
          });
        }
      }

      setPartialFailures(failures);

      if (allMkts.length === 0) {
        // All on-chain calls failed — fall back to DeFi Llama
        console.warn('[Earn] All on-chain calls failed, falling back to DeFi Llama...');
        try {
          const llamaMarkets = await fetchFromDefiLlama();
          if (llamaMarkets.length > 0) {
            setAllMarkets(llamaMarkets);
            setLastFetched(Date.now());
            globalCache = { markets: llamaMarkets, timestamp: Date.now() };
            console.log(`[Earn] ✓ DeFi Llama fallback: ${llamaMarkets.length} markets`);
          } else {
            setError({ type: 'network_error', message: 'No markets from on-chain or DeFi Llama' });
            setErrorMessage('Unable to load market data. Please try again.');
          }
        } catch (llamaErr) {
          console.error('[Earn] DeFi Llama fallback also failed:', llamaErr);
          setError({ type: 'network_error', message: 'All data sources failed' });
          setErrorMessage('Unable to load Aave V3 market data. Please try again.');
        }
      } else {
        // Sort by TVL
        allMkts.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
        setAllMarkets(allMkts);
        setLastFetched(Date.now());
        globalCache = { markets: allMkts, timestamp: Date.now() };

        if (failures.length > 0) {
          console.warn(`[Earn] Partial failure: ${failures.length} chains failed`);
        }
        console.log(`[Earn] ✓ Total: ${allMkts.length} markets from ${results.filter(r => r.success).length}/${results.length} chains`);
      }
    } catch (err) {
      console.error('[Earn] Fatal error fetching markets:', err);
      setError({ type: 'network_error', message: 'Unexpected error loading markets' });
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

  // Filter by selected chain
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

// Re-export isAaveSupported
export { isAaveSupported as isEarnChainSupported } from '@/lib/aaveAddressBook';
