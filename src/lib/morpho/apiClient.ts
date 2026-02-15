/**
 * Morpho GraphQL API Client
 * 
 * Fetches market and position data from the official Morpho API.
 * No API key required.
 */

import { MORPHO_API_URL, getMorphoChainConfig } from './config';
import type { MorphoMarket, MorphoAsset } from './types';

// Token logo fallback mapping
const TOKEN_LOGOS: Record<string, string> = {
  ETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/eth.svg',
  WETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg',
  USDC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  USDT: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdt.svg',
  DAI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/dai.svg',
  WBTC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg',
  CBETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/cbeth.svg',
  WSTETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wsteth.svg',
  RETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/reth.svg',
  CBBTC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg',
};

const GENERIC_TOKEN_LOGO = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';

function getTokenLogo(symbol: string): string {
  const normalized = symbol.toUpperCase().replace(/[.\-]/g, '');
  return TOKEN_LOGOS[normalized] || GENERIC_TOKEN_LOGO;
}

// GraphQL query for markets
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
        oracleAddress
        irmAddress
        morphoBlue {
          address
        }
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
          supplyAssets
          borrowAssets
          liquidityAssets
          collateralAssetsUsd
          rateAtUTarget
          fee
        }
      }
    }
  }
`;

// GraphQL query for user positions
const POSITIONS_QUERY = `
  query GetPositions($userAddress: String!, $chainId: Int!, $first: Int!) {
    positions(
      first: $first
      where: { 
        userAddress: $userAddress
        chainId_in: [$chainId]
      }
    ) {
      items {
        market {
          uniqueKey
          lltv
          oracleAddress
          irmAddress
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
        supplyShares
        supplyAssets
        supplyAssetsUsd
        borrowShares
        borrowAssets
        borrowAssetsUsd
        collateral
        collateralUsd
      }
    }
  }
`;

interface ApiMarket {
  uniqueKey: string;
  lltv: string;
  oracleAddress: string;
  irmAddress: string;
  morphoBlue?: { address: string } | null;
  loanAsset: { address: string; symbol: string; decimals: number; name: string } | null;
  collateralAsset: { address: string; symbol: string; decimals: number; name: string } | null;
  state: {
    supplyApy: number;
    borrowApy: number;
    utilization: number;
    supplyAssetsUsd: number;
    borrowAssetsUsd: number;
    liquidityAssetsUsd: number;
    supplyAssets: string | number | null;
    borrowAssets: string | number | null;
    liquidityAssets: string | number | null;
    collateralAssetsUsd: number | null;
    rateAtUTarget: number | null;
    fee: number | null;
  } | null;
}

interface ApiPosition {
  market: ApiMarket;
  supplyShares: string;
  supplyAssets: string;
  supplyAssetsUsd: number;
  borrowShares: string;
  borrowAssets: string;
  borrowAssetsUsd: number;
  collateral: string;
  collateralUsd: number;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function graphqlFetch<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const json: GraphQLResponse<T> = await response.json();

  if (json.errors?.length) {
    throw new Error(`GraphQL error: ${json.errors[0].message}`);
  }

  if (!json.data) {
    throw new Error('No data in response');
  }

  return json.data;
}

function parseAsset(asset: ApiMarket['loanAsset'], chainId: number): MorphoAsset | null {
  if (!asset) return null;
  return {
    address: asset.address,
    symbol: asset.symbol || 'UNKNOWN',
    decimals: asset.decimals || 18,
    name: asset.name || 'Unknown Token',
    logoUrl: getTokenLogo(asset.symbol || ''),
  };
}

function parseMarket(market: ApiMarket, chainId: number): MorphoMarket | null {
  if (!market.loanAsset || !market.state) return null;

  const loanAsset = parseAsset(market.loanAsset, chainId);
  if (!loanAsset) return null;

  // Convert APY from decimal to percentage, cap at 1000%
  const rawSupplyApy = (market.state.supplyApy || 0) * 100;
  const rawBorrowApy = (market.state.borrowApy || 0) * 100;
  const supplyApy = Math.min(rawSupplyApy, 1000);
  const borrowApy = Math.min(rawBorrowApy, 1000);

  // Parse LLTV from bigint string (1e18 scale)
  const lltvRaw = BigInt(market.lltv || '0');
  const lltv = Number(lltvRaw) / 1e18 * 100;

  // Parse token-denominated amounts using loan asset decimals
  const decimals = loanAsset.decimals;
  const parseTokenAmount = (val: string | number | null | undefined): number => {
    if (val == null) return 0;
    if (typeof val === 'number') return val;
    try {
      return parseFloat(val) / Math.pow(10, decimals);
    } catch {
      return 0;
    }
  };

  // Rate at target utilization (comes as decimal, convert to %)
  const rateAtTarget = market.state.rateAtUTarget != null
    ? market.state.rateAtUTarget * 100
    : null;

  // Protocol fee (comes as decimal 0-1, convert to %)
  const fee = (market.state.fee || 0) * 100;

  // Scaling sanity check: warn if borrow APR looks impossibly high
  if (borrowApy > 100) {
    const parityDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('parityDebug') === 'true';
    if (parityDebug) {
      console.warn(`[Morpho Parity] High Borrow APR detected: ${borrowApy.toFixed(2)}% for ${loanAsset.symbol}/${market.collateralAsset?.symbol || '—'} — possible scaling bug`);
    }
  }

  return {
    id: market.uniqueKey,
    uniqueKey: market.uniqueKey,
    chainId,
    loanAsset,
    collateralAsset: parseAsset(market.collateralAsset, chainId),
    lltv,
    supplyApy,
    borrowApy,
    totalSupplyUsd: market.state.supplyAssetsUsd || 0,
    totalBorrowUsd: market.state.borrowAssetsUsd || 0,
    availableLiquidityUsd: market.state.liquidityAssetsUsd || 0,
    utilization: (market.state.utilization || 0) * 100,
    oracle: market.oracleAddress,
    irm: market.irmAddress,
    totalSupplyAssets: parseTokenAmount(market.state.supplyAssets),
    totalBorrowAssets: parseTokenAmount(market.state.borrowAssets),
    liquidityAssets: parseTokenAmount(market.state.liquidityAssets),
    totalCollateralUsd: market.state.collateralAssetsUsd || 0,
    rateAtTarget,
    fee,
    morphoBlue: market.morphoBlue?.address || '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
  };
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

  console.log(`[Morpho API] Fetching markets for ${config.label}...`);

  const data = await graphqlFetch<{ markets: { items: ApiMarket[] } }>(
    MARKETS_QUERY,
    { chainId, first, skip }
  );

  const parsed = data.markets.items
    .map(m => parseMarket(m, chainId))
    .filter((m): m is MorphoMarket => m !== null && m.totalSupplyUsd > 0);

  // Deduplicate by uniqueKey (API can return duplicates across pages)
  const seen = new Set<string>();
  const markets = parsed.filter(m => {
    const key = m.uniqueKey;
    if (seen.has(key)) {
      console.warn(`[Morpho API] Duplicate market filtered: ${key} on ${config.label}`);
      return false;
    }
    seen.add(key);
    return true;
  });

  if (parsed.length !== markets.length) {
    console.warn(`[Morpho API] Removed ${parsed.length - markets.length} duplicate markets on ${config.label}`);
  }

  console.log(`[Morpho API] ✓ Loaded ${markets.length} unique markets from ${config.label}`);
  return markets;
}

export interface UserPosition {
  marketId: string;
  chainId: number;
  market: MorphoMarket | null;
  supplyShares: bigint;
  supplyAssets: bigint;
  supplyAssetsUsd: number;
  borrowShares: bigint;
  borrowAssets: bigint;
  borrowAssetsUsd: number;
  collateral: bigint;
  collateralUsd: number;
}

export async function fetchMorphoPositions(options: {
  userAddress: string;
  chainId: number;
  first?: number;
}): Promise<UserPosition[]> {
  const { userAddress, chainId, first = 100 } = options;

  const config = getMorphoChainConfig(chainId);
  if (!config?.enabled) {
    return [];
  }

  console.log(`[Morpho API] Fetching positions for ${userAddress.slice(0, 8)}... on ${config.label}`);

  try {
    const data = await graphqlFetch<{ positions: { items: ApiPosition[] } }>(
      POSITIONS_QUERY,
      { userAddress: userAddress.toLowerCase(), chainId, first }
    );

    const positions: UserPosition[] = data.positions.items
      .filter(p => {
        // Filter out empty positions
        const hasSupply = BigInt(p.supplyAssets || '0') > 0n;
        const hasBorrow = BigInt(p.borrowAssets || '0') > 0n;
        const hasCollateral = BigInt(p.collateral || '0') > 0n;
        return hasSupply || hasBorrow || hasCollateral;
      })
      .map(p => ({
        marketId: p.market.uniqueKey,
        chainId,
        market: parseMarket(p.market, chainId),
        supplyShares: BigInt(p.supplyShares || '0'),
        supplyAssets: BigInt(p.supplyAssets || '0'),
        supplyAssetsUsd: p.supplyAssetsUsd || 0,
        borrowShares: BigInt(p.borrowShares || '0'),
        borrowAssets: BigInt(p.borrowAssets || '0'),
        borrowAssetsUsd: p.borrowAssetsUsd || 0,
        collateral: BigInt(p.collateral || '0'),
        collateralUsd: p.collateralUsd || 0,
      }));

    console.log(`[Morpho API] ✓ Found ${positions.length} positions on ${config.label}`);
    return positions;
  } catch (error) {
    console.error(`[Morpho API] Failed to fetch positions on ${config.label}:`, error);
    return [];
  }
}
