/**
 * Lending Markets Hook
 * 
 * Fetches REAL Aave V3 markets from supported chains ONLY.
 * NO mock/sample data - shows error if data unavailable.
 */

import { useState, useEffect, useCallback } from 'react';

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

// ============================================
// SUPPORTED CHAINS - MAINNET ONLY (NO TESTNETS)
// ============================================
export const LENDING_CHAINS = [
  { id: 1, name: 'Ethereum', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/ethereum.svg', supported: true },
  { id: 42161, name: 'Arbitrum', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/arbitrum.svg', supported: true },
  { id: 10, name: 'Optimism', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/optimism.svg', supported: true },
  { id: 137, name: 'Polygon', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/polygon.svg', supported: true },
  { id: 8453, name: 'Base', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/base.svg', supported: true },
  { id: 43114, name: 'Avalanche', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/avalanche.svg', supported: true },
] as const;

export const SUPPORTED_CHAIN_IDS: readonly number[] = LENDING_CHAINS.map(c => c.id);

// Helper to check if chain is supported
export function isChainSupported(chainId: number): boolean {
  return SUPPORTED_CHAIN_IDS.includes(chainId);
}

// ============================================
// AAVE V3 POOL ADDRESSES - OFFICIAL ONLY
// ============================================
export const AAVE_POOL_ADDRESSES: Record<number, `0x${string}`> = {
  1: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',      // Ethereum Mainnet
  42161: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',  // Arbitrum
  10: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',     // Optimism
  137: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',    // Polygon
  8453: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',   // Base
  43114: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',  // Avalanche
};

// Block explorers
export const CHAIN_EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io/tx/',
  42161: 'https://arbiscan.io/tx/',
  10: 'https://optimistic.etherscan.io/tx/',
  137: 'https://polygonscan.com/tx/',
  8453: 'https://basescan.org/tx/',
  43114: 'https://snowtrace.io/tx/',
};

// Aave UI URLs per chain
const AAVE_UI_URLS: Record<number, string> = {
  1: 'https://app.aave.com/reserve-overview/?underlyingAsset=',
  42161: 'https://app.aave.com/reserve-overview/?underlyingAsset=',
  10: 'https://app.aave.com/reserve-overview/?underlyingAsset=',
  137: 'https://app.aave.com/reserve-overview/?underlyingAsset=',
  8453: 'https://app.aave.com/reserve-overview/?underlyingAsset=',
  43114: 'https://app.aave.com/reserve-overview/?underlyingAsset=',
};

// Chain market names for Aave URLs
const CHAIN_MARKET_NAMES: Record<number, string> = {
  1: 'proto_mainnet_v3',
  42161: 'proto_arbitrum_v3',
  10: 'proto_optimism_v3',
  137: 'proto_polygon_v3',
  8453: 'proto_base_v3',
  43114: 'proto_avalanche_v3',
};

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

// ============================================
// AAVE V3 SUBGRAPH ENDPOINTS
// Using free public endpoints (hosted service)
// ============================================
const AAVE_SUBGRAPHS: Record<number, string> = {
  1: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3',
  42161: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-arbitrum',
  10: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-optimism',
  137: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-polygon',
  8453: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-base',
  43114: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-avalanche',
};

// Backup: Aave's official API endpoint (if subgraph fails)
const AAVE_API_ENDPOINTS: Record<number, string> = {
  1: 'https://aave-api-v2.aave.com/data/pools/v3/1',
  42161: 'https://aave-api-v2.aave.com/data/pools/v3/42161',
  10: 'https://aave-api-v2.aave.com/data/pools/v3/10',
  137: 'https://aave-api-v2.aave.com/data/pools/v3/137',
  8453: 'https://aave-api-v2.aave.com/data/pools/v3/8453',
  43114: 'https://aave-api-v2.aave.com/data/pools/v3/43114',
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
export type MarketFetchError = 
  | { type: 'unsupported_chain'; chainId: number; chainName?: string }
  | { type: 'rpc_unavailable'; chainId: number; message: string }
  | { type: 'contract_error'; chainId: number; message: string }
  | { type: 'network_error'; message: string }
  | { type: 'no_markets'; chainId: number };

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

async function fetchAaveMarkets(chainId: number): Promise<LendingMarket[]> {
  const chain = LENDING_CHAINS.find(c => c.id === chainId);
  if (!chain) {
    throw { type: 'unsupported_chain', chainId } as MarketFetchError;
  }

  const subgraphUrl = AAVE_SUBGRAPHS[chainId];
  if (!subgraphUrl) {
    throw { type: 'unsupported_chain', chainId, chainName: chain.name } as MarketFetchError;
  }
  
  let reserves: SubgraphReserve[] = [];
  let lastError: Error | null = null;

  // Attempt 1: Primary subgraph
  try {
    reserves = await fetchFromSubgraph(subgraphUrl, AAVE_RESERVES_QUERY);
  } catch (error) {
    console.warn(`Subgraph failed for chain ${chainId}:`, error);
    lastError = error as Error;
  }

  // If no reserves, throw error - NO FALLBACK TO MOCK DATA
  if (reserves.length === 0) {
    throw { 
      type: 'network_error', 
      message: lastError?.message || 'Failed to fetch market data' 
    } as MarketFetchError;
  }

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
        chainName: chain.name,
        chainLogo: chain.logo,
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
        protocolUrl: `${AAVE_UI_URLS[chainId]}${reserve.underlyingAsset}&marketName=${CHAIN_MARKET_NAMES[chainId]}`,
      };
    });
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
}

export function useLendingMarkets(selectedChainId?: number): UseLendingMarketsResult {
  const [markets, setMarkets] = useState<LendingMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MarketFetchError | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const fetchAllMarkets = useCallback(async (isRetry = false) => {
    if (isRetry) {
      setIsRetrying(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setErrorMessage(null);

    try {
      let allMarkets: LendingMarket[] = [];

      // If specific chain selected, validate it's supported
      if (selectedChainId !== undefined) {
        if (!isChainSupported(selectedChainId)) {
          const chainName = LENDING_CHAINS.find(c => c.id === selectedChainId)?.name;
          throw { 
            type: 'unsupported_chain', 
            chainId: selectedChainId, 
            chainName 
          } as MarketFetchError;
        }

        // Fetch only for selected chain
        const markets = await fetchAaveMarkets(selectedChainId);
        allMarkets = markets;
        
        if (allMarkets.length === 0) {
          throw { type: 'no_markets', chainId: selectedChainId } as MarketFetchError;
        }
      } else {
        // Fetch from all supported chains in parallel
        const results = await Promise.allSettled(
          SUPPORTED_CHAIN_IDS.map(fetchAaveMarkets)
        );

        let successCount = 0;
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.length > 0) {
            allMarkets.push(...result.value);
            successCount++;
          } else if (result.status === 'rejected') {
            console.warn(`Failed to fetch chain ${SUPPORTED_CHAIN_IDS[index]}:`, result.reason);
          }
        });

        // If no chains succeeded, show error
        if (successCount === 0) {
          throw { 
            type: 'network_error', 
            message: 'Unable to fetch market data from any chain. Please check your connection and try again.' 
          } as MarketFetchError;
        }
      }

      // Sort by TVL descending (popularity proxy)
      allMarkets.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
      setMarkets(allMarkets);
      setLastFetched(Date.now());

    } catch (err) {
      console.error('Failed to fetch lending markets:', err);
      
      // Type-safe error handling
      if (typeof err === 'object' && err !== null && 'type' in err) {
        const marketError = err as MarketFetchError;
        setError(marketError);
        
        // Generate user-friendly error message
        switch (marketError.type) {
          case 'unsupported_chain':
            setErrorMessage(`Aave V3 is not available on ${marketError.chainName || `chain ${marketError.chainId}`}. Please select a supported chain.`);
            break;
          case 'rpc_unavailable':
            setErrorMessage(`Unable to connect to the network. ${marketError.message}`);
            break;
          case 'contract_error':
            setErrorMessage(`Smart contract error: ${marketError.message}`);
            break;
          case 'no_markets':
            setErrorMessage('No Aave markets available on this chain.');
            break;
          case 'network_error':
          default:
            setErrorMessage(marketError.message || 'Failed to load Aave markets. Please try again.');
        }
      } else {
        setError({ type: 'network_error', message: String(err) });
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
  };
}

export function getPoolAddress(chainId: number): `0x${string}` | null {
  return AAVE_POOL_ADDRESSES[chainId] || null;
}

export function getExplorerUrl(chainId: number, txHash: string): string {
  return `${CHAIN_EXPLORERS[chainId] || 'https://etherscan.io/tx/'}${txHash}`;
}
