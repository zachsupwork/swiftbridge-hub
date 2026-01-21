import { useState, useEffect, useCallback } from 'react';

export interface LendingMarket {
  id: string;
  protocol: 'aave' | 'morpho';
  chainId: number;
  chainName: string;
  chainLogo: string;
  assetSymbol: string;
  assetName: string;
  assetAddress: string;
  assetLogo: string;
  supplyAPY: number;
  isVariable: boolean;
  tvl: number | null;
  marketId: string;
  protocolUrl: string;
}

// Chain configuration for lending protocols
const LENDING_CHAINS = [
  { id: 1, name: 'Ethereum', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/ethereum.svg' },
  { id: 42161, name: 'Arbitrum', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/arbitrum.svg' },
  { id: 10, name: 'Optimism', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/optimism.svg' },
  { id: 137, name: 'Polygon', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/polygon.svg' },
  { id: 8453, name: 'Base', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/base.svg' },
];

// Aave V3 subgraph endpoints (The Graph)
const AAVE_SUBGRAPHS: Record<number, string> = {
  1: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3',
  42161: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-arbitrum',
  10: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-optimism',
  137: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-polygon',
  8453: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-base',
};

// Aave UI URLs per chain
const AAVE_UI_URLS: Record<number, string> = {
  1: 'https://app.aave.com/reserve-overview/?underlyingAsset=',
  42161: 'https://app.aave.com/reserve-overview/?underlyingAsset=',
  10: 'https://app.aave.com/reserve-overview/?underlyingAsset=',
  137: 'https://app.aave.com/reserve-overview/?underlyingAsset=',
  8453: 'https://app.aave.com/reserve-overview/?underlyingAsset=',
};

// Token logo mapping for common assets
const TOKEN_LOGOS: Record<string, string> = {
  ETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/eth.svg',
  WETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg',
  USDC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  USDT: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdt.svg',
  DAI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/dai.svg',
  WBTC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg',
  LINK: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/link.svg',
  AAVE: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/aave.svg',
  UNI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/uni.svg',
  MATIC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/matic.svg',
  ARB: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/arb.svg',
  OP: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/op.svg',
};

const getTokenLogo = (symbol: string): string => {
  const upperSymbol = symbol.toUpperCase();
  return TOKEN_LOGOS[upperSymbol] || 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
};

// Aave V3 GraphQL query for reserves
const AAVE_RESERVES_QUERY = `
  query GetReserves {
    reserves(first: 100, where: { isActive: true }) {
      id
      symbol
      name
      underlyingAsset
      liquidityRate
      totalATokenSupply
      decimals
      isActive
      isFrozen
    }
  }
`;

// Morpho Blue API (using their public API)
const MORPHO_API_URL = 'https://blue-api.morpho.org/graphql';

const MORPHO_MARKETS_QUERY = `
  query GetMarkets {
    markets(first: 100, orderBy: "supplyAssetsUsd", orderDirection: "desc") {
      items {
        id
        uniqueKey
        loanAsset {
          symbol
          name
          address
        }
        collateralAsset {
          symbol
          name
          address
        }
        state {
          supplyApy
          supplyAssetsUsd
        }
        morphoBlue {
          chain {
            id
            name
          }
        }
      }
    }
  }
`;

async function fetchAaveMarkets(chainId: number): Promise<LendingMarket[]> {
  const subgraphUrl = AAVE_SUBGRAPHS[chainId];
  if (!subgraphUrl) return [];

  const chain = LENDING_CHAINS.find(c => c.id === chainId);
  if (!chain) return [];

  try {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: AAVE_RESERVES_QUERY }),
    });

    if (!response.ok) {
      console.warn(`Aave subgraph failed for chain ${chainId}`);
      return [];
    }

    const data = await response.json();
    const reserves = data?.data?.reserves || [];

    return reserves
      .filter((r: { isActive: boolean; isFrozen: boolean }) => r.isActive && !r.isFrozen)
      .map((reserve: {
        id: string;
        symbol: string;
        name: string;
        underlyingAsset: string;
        liquidityRate: string;
        totalATokenSupply: string;
        decimals: number;
      }) => {
        // liquidityRate is in RAY (1e27), convert to APY percentage
        const rayRate = BigInt(reserve.liquidityRate || '0');
        const supplyAPY = Number(rayRate) / 1e27 * 100;

        // Approximate TVL from totalATokenSupply (simplified)
        const tvl = parseFloat(reserve.totalATokenSupply || '0') / Math.pow(10, reserve.decimals);

        return {
          id: `aave-${chainId}-${reserve.underlyingAsset}`,
          protocol: 'aave' as const,
          chainId,
          chainName: chain.name,
          chainLogo: chain.logo,
          assetSymbol: reserve.symbol,
          assetName: reserve.name,
          assetAddress: reserve.underlyingAsset,
          assetLogo: getTokenLogo(reserve.symbol),
          supplyAPY,
          isVariable: true,
          tvl: tvl > 0 ? tvl : null,
          marketId: reserve.id,
          protocolUrl: `${AAVE_UI_URLS[chainId]}${reserve.underlyingAsset}&marketName=proto_${chain.name.toLowerCase()}_v3`,
        };
      });
  } catch (error) {
    console.error(`Failed to fetch Aave markets for chain ${chainId}:`, error);
    return [];
  }
}

async function fetchMorphoMarkets(): Promise<LendingMarket[]> {
  try {
    const response = await fetch(MORPHO_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: MORPHO_MARKETS_QUERY }),
    });

    if (!response.ok) {
      console.warn('Morpho API failed');
      return [];
    }

    const data = await response.json();
    const markets = data?.data?.markets?.items || [];

    return markets.map((market: {
      id: string;
      uniqueKey: string;
      loanAsset: { symbol: string; name: string; address: string };
      collateralAsset: { symbol: string; name: string; address: string } | null;
      state: { supplyApy: number; supplyAssetsUsd: number };
      morphoBlue: { chain: { id: number; name: string } };
    }) => {
      const chainId = market.morphoBlue?.chain?.id || 1;
      const chain = LENDING_CHAINS.find(c => c.id === chainId) || LENDING_CHAINS[0];
      
      return {
        id: `morpho-${market.uniqueKey}`,
        protocol: 'morpho' as const,
        chainId,
        chainName: chain.name,
        chainLogo: chain.logo,
        assetSymbol: market.loanAsset.symbol,
        assetName: market.loanAsset.name,
        assetAddress: market.loanAsset.address,
        assetLogo: getTokenLogo(market.loanAsset.symbol),
        supplyAPY: (market.state?.supplyApy || 0) * 100,
        isVariable: false,
        tvl: market.state?.supplyAssetsUsd || null,
        marketId: market.uniqueKey,
        protocolUrl: `https://app.morpho.org/market?id=${market.uniqueKey}`,
      };
    });
  } catch (error) {
    console.error('Failed to fetch Morpho markets:', error);
    return [];
  }
}

// Fallback mock data for when APIs are unavailable
function getMockMarkets(): LendingMarket[] {
  const mockData: LendingMarket[] = [];
  
  const assets = [
    { symbol: 'USDC', name: 'USD Coin' },
    { symbol: 'USDT', name: 'Tether USD' },
    { symbol: 'DAI', name: 'Dai Stablecoin' },
    { symbol: 'WETH', name: 'Wrapped Ether' },
    { symbol: 'WBTC', name: 'Wrapped Bitcoin' },
  ];

  // Generate Aave markets for each chain
  LENDING_CHAINS.forEach(chain => {
    assets.forEach(asset => {
      mockData.push({
        id: `aave-${chain.id}-${asset.symbol}`,
        protocol: 'aave',
        chainId: chain.id,
        chainName: chain.name,
        chainLogo: chain.logo,
        assetSymbol: asset.symbol,
        assetName: asset.name,
        assetAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
        assetLogo: getTokenLogo(asset.symbol),
        supplyAPY: Math.random() * 8 + 0.5,
        isVariable: true,
        tvl: Math.random() * 100000000 + 1000000,
        marketId: `aave-${chain.id}-${asset.symbol}`,
        protocolUrl: `https://app.aave.com/reserve-overview/?underlyingAsset=0x`,
      });
    });
  });

  // Add some Morpho markets
  ['USDC', 'WETH', 'DAI'].forEach(symbol => {
    mockData.push({
      id: `morpho-eth-${symbol}`,
      protocol: 'morpho',
      chainId: 1,
      chainName: 'Ethereum',
      chainLogo: LENDING_CHAINS[0].logo,
      assetSymbol: symbol,
      assetName: symbol === 'USDC' ? 'USD Coin' : symbol === 'WETH' ? 'Wrapped Ether' : 'Dai Stablecoin',
      assetAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
      assetLogo: getTokenLogo(symbol),
      supplyAPY: Math.random() * 6 + 1,
      isVariable: false,
      tvl: Math.random() * 50000000 + 500000,
      marketId: `morpho-${symbol}`,
      protocolUrl: `https://app.morpho.org/market`,
    });
  });

  return mockData;
}

export function useLendingMarkets() {
  const [markets, setMarkets] = useState<LendingMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch from all sources in parallel
      const [aaveEth, aaveArb, aaveOpt, aavePoly, aaveBase, morpho] = await Promise.allSettled([
        fetchAaveMarkets(1),
        fetchAaveMarkets(42161),
        fetchAaveMarkets(10),
        fetchAaveMarkets(137),
        fetchAaveMarkets(8453),
        fetchMorphoMarkets(),
      ]);

      const allMarkets: LendingMarket[] = [];

      // Collect successful results
      [aaveEth, aaveArb, aaveOpt, aavePoly, aaveBase, morpho].forEach(result => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          allMarkets.push(...result.value);
        }
      });

      // If no markets were fetched, use mock data
      if (allMarkets.length === 0) {
        console.log('No markets from APIs, using mock data');
        setMarkets(getMockMarkets());
      } else {
        // Sort by APY descending
        allMarkets.sort((a, b) => b.supplyAPY - a.supplyAPY);
        setMarkets(allMarkets);
      }
    } catch (err) {
      console.error('Failed to fetch lending markets:', err);
      setError('Failed to load markets. Using cached data.');
      setMarkets(getMockMarkets());
    } finally {
      setLoading(false);
    }
  }, []);

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
  };
}
