/**
 * Lending Markets Hook
 * 
 * Fetches ALL Aave V3 markets from supported chains.
 * Uses The Graph subgraphs for reliable data.
 */

import { useState, useEffect, useCallback } from 'react';

export interface LendingMarket {
  id: string;
  protocol: 'aave' | 'morpho';
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

// Chain configuration for lending protocols
export const LENDING_CHAINS = [
  { id: 1, name: 'Ethereum', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/ethereum.svg', supported: true },
  { id: 42161, name: 'Arbitrum', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/arbitrum.svg', supported: true },
  { id: 10, name: 'Optimism', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/optimism.svg', supported: true },
  { id: 137, name: 'Polygon', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/polygon.svg', supported: true },
  { id: 8453, name: 'Base', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/base.svg', supported: true },
  { id: 43114, name: 'Avalanche', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/avalanche.svg', supported: true },
  { id: 11155111, name: 'Sepolia', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/ethereum.svg', supported: true },
];

// Aave V3 subgraph endpoints (The Graph - decentralized network)
const AAVE_SUBGRAPHS: Record<number, string> = {
  1: 'https://gateway.thegraph.com/api/subgraphs/id/Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g',
  42161: 'https://gateway.thegraph.com/api/subgraphs/id/DLuE98kEb5pQNXAcKFQGQgfSQ57Xdou4jnVbAEqMfy3B',
  10: 'https://gateway.thegraph.com/api/subgraphs/id/DSfLz8oQBUeU5atALgUFQKMTSYV9mZAVYp4noLSXAfvb',
  137: 'https://gateway.thegraph.com/api/subgraphs/id/Co2URyXjnxaw8WqxKyVHdirq9Ahhm5vcTs4dMedAq211',
  8453: 'https://gateway.thegraph.com/api/subgraphs/id/GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF',
  43114: 'https://gateway.thegraph.com/api/subgraphs/id/2h9woxy8RTjHu1HJsCEnmzpPHFArU33avmUh4f71JpVn',
};

// Fallback subgraph URLs (hosted service)
const AAVE_SUBGRAPHS_FALLBACK: Record<number, string> = {
  1: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3',
  42161: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-arbitrum',
  10: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-optimism',
  137: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-polygon',
  8453: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-base',
  43114: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-avalanche',
};

// Aave UI URLs per chain
const AAVE_UI_URLS: Record<number, string> = {
  1: 'https://app.aave.com/reserve-overview/?underlyingAsset=',
  42161: 'https://app.aave.com/reserve-overview/?underlyingAsset=',
  10: 'https://app.aave.com/reserve-overview/?underlyingAsset=',
  137: 'https://app.aave.com/reserve-overview/?underlyingAsset=',
  8453: 'https://app.aave.com/reserve-overview/?underlyingAsset=',
  43114: 'https://app.aave.com/reserve-overview/?underlyingAsset=',
  11155111: 'https://staging.aave.com/reserve-overview/?underlyingAsset=',
};

// Aave V3 Pool addresses per chain (for transaction execution)
export const AAVE_POOL_ADDRESSES: Record<number, `0x${string}`> = {
  1: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
  42161: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  10: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  137: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  8453: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
  43114: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  11155111: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951',
};

// Block explorers
export const CHAIN_EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io/tx/',
  42161: 'https://arbiscan.io/tx/',
  10: 'https://optimistic.etherscan.io/tx/',
  137: 'https://polygonscan.com/tx/',
  8453: 'https://basescan.org/tx/',
  43114: 'https://snowtrace.io/tx/',
  11155111: 'https://sepolia.etherscan.io/tx/',
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
    `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${symbol}/logo.png`;
};

// Aave V3 GraphQL query for reserves - gets ALL reserves
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

async function fetchFromSubgraph(url: string, query: string): Promise<SubgraphReserve[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

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
  if (!chain) return [];

  // Try primary subgraph first, then fallback
  const subgraphUrl = AAVE_SUBGRAPHS[chainId];
  const fallbackUrl = AAVE_SUBGRAPHS_FALLBACK[chainId];
  
  let reserves: SubgraphReserve[] = [];

  // Try primary
  if (subgraphUrl) {
    try {
      reserves = await fetchFromSubgraph(subgraphUrl, AAVE_RESERVES_QUERY);
    } catch (error) {
      console.warn(`Primary subgraph failed for chain ${chainId}, trying fallback...`);
    }
  }

  // Try fallback if primary failed
  if (reserves.length === 0 && fallbackUrl) {
    try {
      reserves = await fetchFromSubgraph(fallbackUrl, AAVE_RESERVES_QUERY);
    } catch (error) {
      console.warn(`Fallback subgraph also failed for chain ${chainId}`);
      return [];
    }
  }

  if (reserves.length === 0) return [];

  return reserves
    .filter((r) => r.isActive && !r.isFrozen)
    .map((reserve) => {
      // liquidityRate is in RAY (1e27), convert to APY percentage
      const rayRate = BigInt(reserve.liquidityRate || '0');
      const supplyAPY = Number(rayRate) / 1e27 * 100;

      const borrowRayRate = BigInt(reserve.variableBorrowRate || '0');
      const borrowAPY = Number(borrowRayRate) / 1e27 * 100;

      // Calculate TVL and available liquidity in USD (simplified - using token units)
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
        protocolUrl: `${AAVE_UI_URLS[chainId]}${reserve.underlyingAsset}&marketName=proto_${chain.name.toLowerCase()}_v3`,
      };
    });
}

// Mock data for when APIs are unavailable
function getMockMarkets(chainId?: number): LendingMarket[] {
  const mockData: LendingMarket[] = [];
  
  const assets = [
    { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
    { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
    { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
    { symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8 },
    { symbol: 'LINK', name: 'Chainlink', decimals: 18 },
    { symbol: 'AAVE', name: 'Aave', decimals: 18 },
    { symbol: 'UNI', name: 'Uniswap', decimals: 18 },
  ];

  const chainsToUse = chainId 
    ? LENDING_CHAINS.filter(c => c.id === chainId) 
    : LENDING_CHAINS.filter(c => c.supported);

  chainsToUse.forEach(chain => {
    assets.forEach(asset => {
      mockData.push({
        id: `aave-${chain.id}-${asset.symbol}`,
        protocol: 'aave',
        chainId: chain.id,
        chainName: chain.name,
        chainLogo: chain.logo,
        assetSymbol: asset.symbol,
        assetName: asset.name,
        assetAddress: `0x${'0'.repeat(40)}` as `0x${string}`,
        assetLogo: getTokenLogo(asset.symbol),
        supplyAPY: Math.random() * 8 + 0.5,
        borrowAPY: Math.random() * 12 + 2,
        isVariable: true,
        tvl: Math.random() * 100000000 + 1000000,
        availableLiquidity: Math.random() * 50000000 + 500000,
        collateralEnabled: true,
        decimals: asset.decimals,
        marketId: `aave-${chain.id}-${asset.symbol}`,
        protocolUrl: `https://app.aave.com/reserve-overview/?underlyingAsset=0x`,
      });
    });
  });

  return mockData;
}

export function useLendingMarkets(selectedChainId?: number) {
  const [markets, setMarkets] = useState<LendingMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number>(0);

  const fetchAllMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let allMarkets: LendingMarket[] = [];

      if (selectedChainId) {
        // Fetch only for selected chain
        const markets = await fetchAaveMarkets(selectedChainId);
        allMarkets = markets;
      } else {
        // Fetch from all supported chains in parallel
        const chainIds = LENDING_CHAINS.filter(c => c.supported).map(c => c.id);
        const results = await Promise.allSettled(chainIds.map(fetchAaveMarkets));

        results.forEach(result => {
          if (result.status === 'fulfilled' && result.value.length > 0) {
            allMarkets.push(...result.value);
          }
        });
      }

      // If no markets were fetched, use mock data
      if (allMarkets.length === 0) {
        console.log('No markets from APIs, using mock data');
        setMarkets(getMockMarkets(selectedChainId));
        setError('Markets temporarily unavailable. Showing sample data.');
      } else {
        // Sort by TVL descending (popularity proxy)
        allMarkets.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
        setMarkets(allMarkets);
      }

      setLastFetched(Date.now());
    } catch (err) {
      console.error('Failed to fetch lending markets:', err);
      setError('Failed to load markets. Please retry.');
      setMarkets(getMockMarkets(selectedChainId));
    } finally {
      setLoading(false);
    }
  }, [selectedChainId]);

  useEffect(() => {
    fetchAllMarkets();
  }, [fetchAllMarkets]);

  const refresh = useCallback(() => {
    fetchAllMarkets();
  }, [fetchAllMarkets]);

  return {
    markets,
    loading,
    error,
    refresh,
    chains: LENDING_CHAINS,
    lastFetched,
  };
}

export function getPoolAddress(chainId: number): `0x${string}` | null {
  return AAVE_POOL_ADDRESSES[chainId] || null;
}

export function getExplorerUrl(chainId: number, txHash: string): string {
  return `${CHAIN_EXPLORERS[chainId] || 'https://etherscan.io/tx/'}${txHash}`;
}
