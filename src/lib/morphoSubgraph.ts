/**
 * Morpho Blue API Client
 * 
 * Uses official Morpho API at api.morpho.org - no API key required.
 */

import { MORPHO_API_URL, getMorphoChainConfig, type MorphoChainConfig } from './morphoConfig';

export interface MorphoMarket {
  id: string;
  chainId: number;
  loanToken: {
    address: string;
    symbol: string;
    decimals: number;
    name: string;
  };
  collateralToken: {
    address: string;
    symbol: string;
    decimals: number;
    name: string;
  } | null;
  supplyApy: number;
  borrowApy: number;
  totalSupply: number;
  totalBorrow: number;
  availableLiquidity: number;
  utilization: number;
  lltv: number;
}

// Official Morpho API query
const MARKETS_QUERY = `
  query GetMarkets($chainId: Int!, $first: Int!, $skip: Int!) {
    markets(
      first: $first
      skip: $skip
      where: { chainId_in: [$chainId] }
      orderBy: SupplyAssetsUsd
      orderDirection: Desc
    ) {
      items {
        uniqueKey
        lltv
        loanAsset {
          address
          symbol
          decimals
          name
        }
        collateralAsset {
          address
          symbol
          decimals
          name
        }
        state {
          supplyApy
          borrowApy
          utilization
          supplyAssetsUsd
          borrowAssetsUsd
          liquidityAssetsUsd
        }
      }
    }
  }
`;

interface MorphoApiMarket {
  uniqueKey: string;
  lltv: string;
  loanAsset: { address: string; symbol: string; decimals: number; name: string } | null;
  collateralAsset: { address: string; symbol: string; decimals: number; name: string } | null;
  state: {
    supplyApy: number;
    borrowApy: number;
    utilization: number;
    supplyAssetsUsd: number;
    borrowAssetsUsd: number;
    liquidityAssetsUsd: number;
  } | null;
}

interface MorphoApiResponse {
  data?: { markets: { items: MorphoApiMarket[] } };
  errors?: Array<{ message: string }>;
}

export async function fetchMorphoMarkets(options: {
  chainId: number;
  first?: number;
  skip?: number;
}): Promise<MorphoMarket[]> {
  const { chainId, first = 50, skip = 0 } = options;
  
  const config = getMorphoChainConfig(chainId);
  if (!config?.enabled) {
    throw new Error(`Morpho not supported on chain ${chainId}`);
  }

  console.log(`[Morpho] Fetching from official API for ${config.label}...`);

  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: MARKETS_QUERY,
      variables: { chainId, first, skip },
    }),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const json: MorphoApiResponse = await response.json();
  
  console.log(`[Morpho] API response:`, {
    hasData: !!json.data,
    marketsCount: json.data?.markets?.items?.length,
    errors: json.errors,
  });

  if (json.errors?.length) {
    throw new Error(`API error: ${json.errors[0].message}`);
  }

  if (!json.data?.markets?.items) {
    throw new Error('No markets in response');
  }

  const markets = json.data.markets.items
    .filter(m => m.loanAsset && m.state)
    .map(m => ({
      id: m.uniqueKey,
      chainId,
      loanToken: {
        address: m.loanAsset!.address,
        symbol: m.loanAsset!.symbol || 'UNKNOWN',
        decimals: m.loanAsset!.decimals || 18,
        name: m.loanAsset!.name || 'Unknown',
      },
      collateralToken: m.collateralAsset ? {
        address: m.collateralAsset.address,
        symbol: m.collateralAsset.symbol || 'UNKNOWN',
        decimals: m.collateralAsset.decimals || 18,
        name: m.collateralAsset.name || 'Unknown',
      } : null,
      supplyApy: (m.state!.supplyApy || 0) * 100,
      borrowApy: (m.state!.borrowApy || 0) * 100,
      totalSupply: m.state!.supplyAssetsUsd || 0,
      totalBorrow: m.state!.borrowAssetsUsd || 0,
      availableLiquidity: m.state!.liquidityAssetsUsd || 0,
      utilization: (m.state!.utilization || 0) * 100,
      lltv: Number(BigInt(m.lltv || '0')) / 1e18 * 100,
    }))
    .filter(m => m.totalSupply > 0);

  console.log(`[Morpho] ✓ Loaded ${markets.length} markets from ${config.label}`);
  return markets;
}
