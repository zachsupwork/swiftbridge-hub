/**
 * Lending Markets Hook
 * 
 * Fetches REAL Aave V3 markets from supported chains ONLY.
 * NO demo/preview mode - always fetches live on-chain data.
 * 
 * Uses Vite env vars (import.meta.env.VITE_*)
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  SUPPORTED_CHAINS, 
  SUPPORTED_CHAIN_IDS, 
  getChainConfig, 
  isEarnChainSupported,
  type ChainConfig 
} from '@/lib/chainConfig';

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
export { SUPPORTED_CHAINS, SUPPORTED_CHAIN_IDS, isEarnChainSupported, getChainConfig };

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

// Aave V3 GraphQL query for reserves
const AAVE_RESERVES_QUERY = `
  query GetReserves {
    reserves(first: 200, where: { isActive: true }) {
      id
      symbol
      name
      underlyingAsset
      liquidityRate
      variableBorrowRate
      totalATokenSupply
      availableLiquidity
      decimals
      isActive
      isFrozen
      usageAsCollateralEnabled
    }
  }
`;

interface SubgraphReserve {
  id: string;
  symbol: string;
  name: string;
  underlyingAsset: string;
  liquidityRate: string;
  variableBorrowRate: string;
  totalATokenSupply: string;
  availableLiquidity: string;
  decimals: number;
  isActive: boolean;
  isFrozen: boolean;
  usageAsCollateralEnabled: boolean;
}

// Error types for specific error handling
export type MarketFetchErrorType = 
  | 'unsupported_chain'
  | 'missing_rpc'
  | 'rpc_unavailable'
  | 'subgraph_error'
  | 'contract_error'
  | 'network_error'
  | 'no_markets'
  | 'partial_failure';

export interface MarketFetchError {
  type: MarketFetchErrorType;
  chainId?: number;
  chainName?: string;
  message: string;
  missingEnvKey?: string;
  failedChains?: { chainId: number; chainName: string; error: string }[];
}

async function fetchFromSubgraph(url: string, query: string): Promise<SubgraphReserve[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(data.errors[0]?.message || 'GraphQL error');
    }

    return data?.data?.reserves || [];
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function fetchAaveMarkets(chainConfig: ChainConfig): Promise<LendingMarket[]> {
  const { chainId, name, aaveSubgraph, aaveMarketName } = chainConfig;
  
  if (!aaveSubgraph) {
    throw {
      type: 'unsupported_chain',
      chainId,
      chainName: name,
      message: `No Aave subgraph configured for ${name}`,
    } as MarketFetchError;
  }
  
  let reserves: SubgraphReserve[] = [];

  try {
    reserves = await fetchFromSubgraph(aaveSubgraph, AAVE_RESERVES_QUERY);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw {
      type: 'subgraph_error',
      chainId,
      chainName: name,
      message: `Failed to fetch ${name} markets: ${errorMessage}`,
    } as MarketFetchError;
  }

  if (reserves.length === 0) {
    throw {
      type: 'no_markets',
      chainId,
      chainName: name,
      message: `No active markets found on ${name}`,
    } as MarketFetchError;
  }

  const aaveUiUrl = `https://app.aave.com/reserve-overview/?underlyingAsset=`;

  return reserves
    .filter((r) => r.isActive && !r.isFrozen)
    .map((reserve) => {
      // liquidityRate is in RAY (1e27), convert to APY percentage
      const rayRate = BigInt(reserve.liquidityRate || '0');
      const supplyAPY = Number(rayRate) / 1e27 * 100;

      const borrowRayRate = BigInt(reserve.variableBorrowRate || '0');
      const borrowAPY = Number(borrowRayRate) / 1e27 * 100;

      // Calculate TVL and available liquidity
      const totalSupply = parseFloat(reserve.totalATokenSupply || '0') / Math.pow(10, reserve.decimals);
      const available = parseFloat(reserve.availableLiquidity || '0') / Math.pow(10, reserve.decimals);

      return {
        id: `aave-${chainId}-${reserve.underlyingAsset}`,
        protocol: 'aave' as const,
        chainId,
        chainName: name,
        chainLogo: chainConfig.logo,
        assetSymbol: reserve.symbol,
        assetName: reserve.name,
        assetAddress: reserve.underlyingAsset as `0x${string}`,
        assetLogo: getTokenLogo(reserve.symbol),
        supplyAPY,
        borrowAPY,
        isVariable: true,
        tvl: totalSupply > 0 ? totalSupply : null,
        availableLiquidity: available > 0 ? available : null,
        collateralEnabled: reserve.usageAsCollateralEnabled,
        decimals: reserve.decimals,
        marketId: reserve.id,
        protocolUrl: `${aaveUiUrl}${reserve.underlyingAsset}&marketName=${aaveMarketName}`,
      };
    });
}

export interface ChainFetchResult {
  chainId: number;
  chainName: string;
  success: boolean;
  markets: LendingMarket[];
  error?: string;
}

export interface UseLendingMarketsResult {
  markets: LendingMarket[];
  loading: boolean;
  error: MarketFetchError | null;
  errorMessage: string | null;
  refresh: () => void;
  chains: typeof LENDING_CHAINS;
  lastFetched: number;
  isRetrying: boolean;
  chainResults: ChainFetchResult[];
  partialFailures: { chainId: number; chainName: string; error: string }[];
}

export function useLendingMarkets(selectedChainId?: number): UseLendingMarketsResult {
  const [markets, setMarkets] = useState<LendingMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MarketFetchError | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [chainResults, setChainResults] = useState<ChainFetchResult[]>([]);
  const [partialFailures, setPartialFailures] = useState<{ chainId: number; chainName: string; error: string }[]>([]);

  const fetchAllMarkets = useCallback(async (isRetry = false) => {
    // Always fetch real data - no preview/demo mode
    if (import.meta.env.DEV) {
      console.log('[Earn] Fetching LIVE Aave V3 markets from subgraphs...');
    }

    if (isRetry) {
      setIsRetrying(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setErrorMessage(null);
    setPartialFailures([]);

    try {
      let allMarkets: LendingMarket[] = [];
      const results: ChainFetchResult[] = [];
      const failures: { chainId: number; chainName: string; error: string }[] = [];

      // If specific chain selected, validate and fetch
      if (selectedChainId !== undefined) {
        const chainConfig = getChainConfig(selectedChainId);
        
        if (!chainConfig) {
          throw {
            type: 'unsupported_chain',
            chainId: selectedChainId,
            message: `Chain ${selectedChainId} is not supported for Earn. Please select a supported chain.`,
          } as MarketFetchError;
        }

        try {
          const chainMarkets = await fetchAaveMarkets(chainConfig);
          allMarkets = chainMarkets;
          results.push({
            chainId: selectedChainId,
            chainName: chainConfig.name,
            success: true,
            markets: chainMarkets,
          });
        } catch (err) {
          const fetchError = err as MarketFetchError;
          results.push({
            chainId: selectedChainId,
            chainName: chainConfig.name,
            success: false,
            markets: [],
            error: fetchError.message,
          });
          throw fetchError;
        }
      } else {
        // Fetch from ALL supported chains in parallel - skip failures
        const fetchPromises = SUPPORTED_CHAINS.map(async (chainConfig): Promise<ChainFetchResult> => {
          try {
            const chainMarkets = await fetchAaveMarkets(chainConfig);
            return {
              chainId: chainConfig.chainId,
              chainName: chainConfig.name,
              success: true,
              markets: chainMarkets,
            };
          } catch (err) {
            const errorMsg = err instanceof Error 
              ? err.message 
              : (err as MarketFetchError).message || 'Unknown error';
            return {
              chainId: chainConfig.chainId,
              chainName: chainConfig.name,
              success: false,
              markets: [],
              error: errorMsg,
            };
          }
        });

        const chainResultsArray = await Promise.all(fetchPromises);
        
        // Process results
        chainResultsArray.forEach(result => {
          results.push(result);
          if (result.success) {
            allMarkets.push(...result.markets);
          } else {
            failures.push({
              chainId: result.chainId,
              chainName: result.chainName,
              error: result.error || 'Unknown error',
            });
            if (import.meta.env.DEV) {
              console.warn(`[Earn] ${result.chainName} failed:`, result.error);
            }
          }
        });

        // If ALL chains failed, show error
        if (allMarkets.length === 0 && failures.length > 0) {
          throw {
            type: 'network_error',
            message: 'Unable to fetch market data from any chain. Please check your connection and try again.',
            failedChains: failures,
          } as MarketFetchError;
        }

        // If some chains failed, set partial failures (non-blocking warning)
        if (failures.length > 0 && allMarkets.length > 0) {
          setPartialFailures(failures);
        }
      }

      // Sort by TVL descending (popularity proxy)
      allMarkets.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
      setMarkets(allMarkets);
      setChainResults(results);
      setLastFetched(Date.now());

    } catch (err) {
      console.error('Failed to fetch lending markets:', err);
      
      // Type-safe error handling
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
      
      // Clear markets on error - NEVER show mock data
      setMarkets([]);
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  }, [selectedChainId]);

  useEffect(() => {
    fetchAllMarkets();
  }, [fetchAllMarkets]);

  const refresh = useCallback(() => {
    fetchAllMarkets(true);
  }, [fetchAllMarkets]);

  return {
    markets,
    loading,
    error,
    errorMessage,
    refresh,
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
    
    case 'subgraph_error':
      return `Failed to fetch market data for ${error.chainName || 'the selected chain'}. ${error.message}`;
    
    case 'contract_error':
      return `Smart contract error on ${error.chainName || 'the network'}: ${error.message}`;
    
    case 'no_markets':
      return `No active Aave markets found on ${error.chainName || 'this chain'}.`;
    
    case 'network_error':
    default:
      return error.message || 'Failed to load Aave markets. Please try again.';
  }
}

// Legacy exports for backward compatibility
export function getPoolAddress(chainId: number): `0x${string}` | null {
  return getChainConfig(chainId)?.aavePool || null;
}

export function getExplorerUrl(chainId: number, txHash: string): string {
  const config = getChainConfig(chainId);
  return config ? `${config.explorerUrl}${txHash}` : `https://etherscan.io/tx/${txHash}`;
}
