/**
 * Lending Markets Hook
 * 
 * Fetches REAL Aave V3 markets from on-chain UiPoolDataProviderV3.
 * NO demo/preview mode - always fetches live on-chain data.
 * 
 * Uses Vite env vars (import.meta.env.VITE_*)
 */

import { useState, useEffect, useCallback } from 'react';
import { createPublicClient, http, type Chain, getAddress } from 'viem';
import { mainnet, arbitrum, optimism, polygon, base, avalanche } from 'viem/chains';
import { 
  UI_POOL_DATA_PROVIDER_ABI,
  getAaveAddresses,
  isAaveSupported,
  type AaveReserveData,
} from '@/lib/aaveAddressBook';
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
  | 'partial_failure';

export interface MarketFetchError {
  type: MarketFetchErrorType;
  chainId?: number;
  chainName?: string;
  message: string;
  missingEnvKey?: string;
  failedAddress?: string;
  failedChains?: { chainId: number; chainName: string; error: string }[];
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

/**
 * Fetch Aave V3 reserves data using UiPoolDataProviderV3 on-chain call
 */
async function fetchAaveMarketsOnChain(chainConfig: ChainConfig): Promise<LendingMarket[]> {
  const { chainId, name, rpcUrl, logo } = chainConfig;
  
  // Get Aave addresses from address book
  const aaveAddresses = getAaveAddresses(chainId);
  
  if (!aaveAddresses) {
    throw {
      type: 'unsupported_chain',
      chainId,
      chainName: name,
      message: `Aave V3 not available on ${name}`,
    } as MarketFetchError;
  }

  if (!rpcUrl) {
    throw {
      type: 'missing_rpc',
      chainId,
      chainName: name,
      message: `Missing RPC for ${name}`,
      missingEnvKey: chainConfig.rpcEnvKey,
    } as MarketFetchError;
  }

  // Checksum addresses to prevent "checksum counterpart" errors
  let checksummedProvider: `0x${string}`;
  let checksummedUiProvider: `0x${string}`;
  let checksummedPool: `0x${string}`;
  
  try {
    checksummedProvider = getAddress(aaveAddresses.POOL_ADDRESSES_PROVIDER);
    checksummedUiProvider = getAddress(aaveAddresses.UI_POOL_DATA_PROVIDER);
    checksummedPool = getAddress(aaveAddresses.POOL);
  } catch (checksumError) {
    console.error(`[Earn] Address checksum failed for ${name}:`, checksumError);
    throw {
      type: 'contract_error',
      chainId,
      chainName: name,
      message: `Invalid address format for ${name}: ${checksumError instanceof Error ? checksumError.message : 'checksum failed'}`,
      failedAddress: 'address checksum validation',
    } as MarketFetchError;
  }

  // Log addresses for debugging (temporary)
  console.log(`[Earn] Fetching ${name} markets:`, {
    chainId,
    POOL_ADDRESSES_PROVIDER: checksummedProvider,
    UI_POOL_DATA_PROVIDER: checksummedUiProvider,
    POOL: checksummedPool,
  });

  // Validate addresses are defined
  if (!checksummedProvider || !checksummedUiProvider) {
    console.error(`[Earn] Aave addresses undefined for ${name}:`, aaveAddresses);
    throw {
      type: 'contract_error',
      chainId,
      chainName: name,
      message: `Aave addresses undefined for ${name}`,
      failedAddress: 'POOL_ADDRESSES_PROVIDER or UI_POOL_DATA_PROVIDER',
    } as MarketFetchError;
  }

  const viemChain = VIEM_CHAINS[chainId];
  if (!viemChain) {
    throw {
      type: 'unsupported_chain',
      chainId,
      chainName: name,
      message: `Chain ${name} not configured in viem`,
    } as MarketFetchError;
  }

  // Create viem client with the RPC URL
  const client = createPublicClient({
    chain: viemChain,
    transport: http(rpcUrl),
  });

  try {
    // Call UiPoolDataProviderV3.getReservesData with checksummed addresses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (client.readContract as any)({
      address: checksummedUiProvider,
      abi: UI_POOL_DATA_PROVIDER_ABI,
      functionName: 'getReservesData',
      args: [checksummedProvider],
    }) as [AaveReserveData[], unknown];

    const [reserves] = result;
    
    if (!reserves || reserves.length === 0) {
      throw {
        type: 'no_markets',
        chainId,
        chainName: name,
        message: `No Aave V3 markets available on ${name}`,
      } as MarketFetchError;
    }

    console.log(`[Earn] ${name}: Fetched ${reserves.length} reserves`);

    const aaveUiUrl = `https://app.aave.com/reserve-overview/?underlyingAsset=`;
    const marketName = AAVE_MARKET_NAMES[chainId] || '';

    return reserves
      .filter((r) => r.isActive && !r.isFrozen && !r.isPaused)
      .map((reserve) => {
        // liquidityRate is in RAY (1e27), convert to APY percentage
        const liquidityRate = Number(reserve.liquidityRate);
        const supplyAPY = (liquidityRate / 1e27) * 100;

        const variableBorrowRate = Number(reserve.variableBorrowRate);
        const borrowAPY = (variableBorrowRate / 1e27) * 100;

        // Calculate TVL from available liquidity + borrowed
        const decimals = Number(reserve.decimals);
        const availableLiquidity = Number(reserve.availableLiquidity) / Math.pow(10, decimals);
        
        // Total variable debt scaled
        const totalScaledVariableDebt = Number(reserve.totalScaledVariableDebt) / Math.pow(10, decimals);
        const totalStableDebt = Number(reserve.totalPrincipalStableDebt) / Math.pow(10, decimals);
        
        // TVL = available + all borrowed
        const tvl = availableLiquidity + totalScaledVariableDebt + totalStableDebt;

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
  } catch (error) {
    // Check if it's already our error type
    if (typeof error === 'object' && error !== null && 'type' in error) {
      throw error;
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Earn] ${name} contract call failed:`, error);
    
    // Categorize the error more specifically
    let errorType: MarketFetchErrorType = 'contract_error';
    let detailedMessage = errorMessage;

    if (errorMessage.includes('execution reverted')) {
      errorType = 'contract_error';
      detailedMessage = `Contract call reverted: ${errorMessage}`;
    } else if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
      errorType = 'rpc_unavailable';
      detailedMessage = `RPC timeout on ${name}`;
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      errorType = 'rpc_unavailable';
      detailedMessage = `RPC rate limited on ${name}`;
    } else if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
      errorType = 'network_error';
      detailedMessage = `Network error connecting to ${name}: ${errorMessage}`;
    }
    
    throw {
      type: errorType,
      chainId,
      chainName: name,
      message: detailedMessage,
      failedAddress: checksummedUiProvider,
    } as MarketFetchError;
  }
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
    console.log('[Earn] Fetching LIVE Aave V3 markets from on-chain UiPoolDataProviderV3...');

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
          const chainMarkets = await fetchAaveMarketsOnChain(chainConfig);
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
        // Fetch from ALL supported chains in parallel
        const fetchPromises = SUPPORTED_CHAINS.map(async (chainConfig): Promise<ChainFetchResult> => {
          try {
            const chainMarkets = await fetchAaveMarketsOnChain(chainConfig);
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
            console.warn(`[Earn] ${result.chainName} failed:`, result.error);
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
      console.error('[Earn] Failed to fetch lending markets:', err);
      
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
    
    case 'contract_error':
      return `Aave contracts not reachable on ${error.chainName || 'the network'}. Failed address: ${error.failedAddress || 'unknown'}. ${error.message}`;
    
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
