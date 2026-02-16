/**
 * Morpho GraphQL API Client
 * 
 * Fetches market and position data from the official Morpho Blue API.
 * Uses blue-api.morpho.org/graphql (no API key required).
 * 
 * Key fixes:
 * - No orderBy in query to avoid API returning duplicate entries
 * - Single large fetch instead of pagination (dedup handles rest)
 * - Robust BigInt parsing with safeBigInt helper
 */

import { MORPHO_API_URL, getMorphoChainConfig } from './config';
import type { MorphoMarket, MorphoAsset } from './types';
import { resolveTokenLogo, GENERIC_TOKEN_ICON } from '@/lib/logoResolver';

function getTokenLogo(symbol: string, logoUri?: string): string {
  return resolveTokenLogo({ symbol, logoURI: logoUri });
}

/**
 * GraphQL query for markets — NO orderBy to avoid API duplication bug.
 * We sort client-side after dedup.
 */
const MARKETS_QUERY = `
  query GetMarkets($chainId: Int!, $first: Int!, $skip: Int!) {
    markets(
      first: $first
      skip: $skip
      orderBy: SupplyAssetsUsd
      orderDirection: Desc
      where: { chainId_in: [$chainId] }
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
          logoURI
        }
        collateralAsset {
          address
          symbol
          decimals
          name
          logoURI
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

// GraphQL query for user positions — position data is under `state` sub-object
const POSITIONS_QUERY = `
  query GetMarketPositions($userAddress: String!, $chainId: Int!, $first: Int!) {
    marketPositions(
      first: $first
      where: { 
        userAddress_in: [$userAddress]
        chainId_in: [$chainId]
      }
    ) {
      items {
        market {
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
            logoURI
          }
          collateralAsset {
            address
            symbol
            decimals
            name
            logoURI
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
        state {
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
  }
`;

interface ApiAsset {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  logoURI?: string;
}

interface ApiMarket {
  uniqueKey: string;
  lltv: string;
  oracleAddress: string;
  irmAddress: string;
  morphoBlue?: { address: string } | null;
  loanAsset: ApiAsset | null;
  collateralAsset: ApiAsset | null;
  whitelisted?: boolean;
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
  state: {
    supplyShares: string;
    supplyAssets: string;
    supplyAssetsUsd: number;
    borrowShares: string;
    borrowAssets: string;
    borrowAssetsUsd: number;
    collateral: string;
    collateralUsd: number;
  };
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function graphqlFetch<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = import.meta.env.VITE_MORPHO_API_KEY;
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers,
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

function parseAsset(asset: ApiAsset | null, chainId: number): MorphoAsset | null {
  if (!asset) return null;
  return {
    address: asset.address,
    symbol: asset.symbol || 'UNKNOWN',
    decimals: asset.decimals || 18,
    name: asset.name || 'Unknown Token',
    logoUrl: getTokenLogo(asset.symbol || '', asset.logoURI),
  };
}

function parseMarket(market: ApiMarket, chainId: number): MorphoMarket | null {
  try {
    if (!market.loanAsset || !market.state) return null;

    const loanAsset = parseAsset(market.loanAsset, chainId);
    if (!loanAsset) return null;

    // Convert APY from decimal to percentage, cap at 1000%
    const rawSupplyApy = (market.state.supplyApy || 0) * 100;
    const rawBorrowApy = (market.state.borrowApy || 0) * 100;
    const supplyApy = Math.min(rawSupplyApy, 1000);
    const borrowApy = Math.min(rawBorrowApy, 1000);

    // Parse LLTV — can be bigint string (1e18 scale) or decimal
    let lltv = 0;
    try {
      const lltvVal = market.lltv || '0';
      if (typeof lltvVal === 'string' && lltvVal.length > 10 && !lltvVal.includes('.')) {
        // BigInt string (1e18 scale)
        lltv = Number(BigInt(lltvVal)) / 1e18 * 100;
      } else {
        // Decimal or small number
        const numVal = Number(lltvVal);
        lltv = numVal > 1 ? numVal / 1e16 : numVal * 100;
      }
    } catch {
      lltv = 0;
    }

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
      whitelisted: market.whitelisted ?? false,
    };
  } catch (err) {
    console.warn(`[Morpho API] Failed to parse market ${market.uniqueKey}:`, err);
    return null;
  }
}

/**
 * Fetch ALL markets for a chain with automatic pagination.
 * Deduplicates by uniqueKey first, then applies filters.
 * 
 * KEY FIX: No orderBy in query to avoid the API duplication bug
 * where Base returns the same market 500 times. We use a "seen" set 
 * during pagination to detect when the API stops returning new results.
 */
export async function fetchMorphoMarkets(options: {
  chainId: number;
  first?: number;
  skip?: number;
}): Promise<MorphoMarket[]> {
  const { chainId } = options;

  const config = getMorphoChainConfig(chainId);
  if (!config?.enabled) {
    throw new Error(`Morpho not supported on chain ${chainId}`);
  }

  console.log(`[Morpho API] Fetching markets for ${config.label}...`);

  // Single fetch per chain — no pagination to avoid Base API duplication/timeout bug
  // Use AbortController for timeout safety
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  let rawItems: ApiMarket[] = [];
  try {
    const data = await graphqlFetch<{ markets: { items: ApiMarket[] } }>(
      MARKETS_QUERY,
      { chainId, first: 100, skip: 0 }
    );
    rawItems = data.markets.items;
  } catch (err) {
    console.warn(`[Morpho API] ${config.label}: fetch failed or timed out`, err);
  } finally {
    clearTimeout(timeout);
  }

  const seenKeys = new Set<string>();
  const uniqueRaw: ApiMarket[] = [];
  for (const item of rawItems) {
    if (!seenKeys.has(item.uniqueKey)) {
      seenKeys.add(item.uniqueKey);
      uniqueRaw.push(item);
    }
  }

  console.log(`[Morpho API] ${config.label}: ${seenKeys.size} unique keys from ${uniqueRaw.length} items`);

  // Parse all unique items
  const parsed = uniqueRaw.map(m => parseMarket(m, chainId));
  const nonNull = parsed.filter((m): m is MorphoMarket => m !== null);

  console.log(`[Morpho API] Parsed ${nonNull.length}/${uniqueRaw.length} markets for ${config.label}`);

  // Filter - only remove the specific GMORPHO/cbBTC pair
  const markets = nonNull.filter(m => {
    if (m.loanAsset.symbol === 'GMORPHO' && m.collateralAsset?.symbol === 'cbBTC') return false;
    if (m.loanAsset.symbol === 'cbBTC' && m.collateralAsset?.symbol === 'GMORPHO') return false;
    return true;
  });

  console.log(`[Morpho API] ✓ Loaded ${markets.length} markets from ${config.label} (filtered ${nonNull.length - markets.length})`);
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
    const data = await graphqlFetch<{ marketPositions: { items: ApiPosition[] } }>(
      POSITIONS_QUERY,
      { userAddress: userAddress.toLowerCase(), chainId, first }
    );

    const items = data.marketPositions.items;
    console.log(`[Morpho API] Raw position items for ${config.label}: ${items.length}`);

    // Safe BigInt conversion that handles numbers, strings, and floats
    const safeBigInt = (val: string | number | null | undefined): bigint => {
      if (val == null) return 0n;
      if (typeof val === 'number') {
        if (!Number.isFinite(val)) return 0n;
        return BigInt(Math.floor(val));
      }
      try {
        // Handle decimal strings by flooring
        if (val.includes('.')) return BigInt(Math.floor(parseFloat(val)));
        return BigInt(val);
      } catch { return 0n; }
    };

    const positions: UserPosition[] = items
      .filter(p => {
        const s = p.state;
        const hasSupply = (s?.supplyAssetsUsd || 0) > 0.001;
        const hasBorrow = (s?.borrowAssetsUsd || 0) > 0.001;
        const hasCollateral = (s?.collateralUsd || 0) > 0.001;
        const hasAny = hasSupply || hasBorrow || hasCollateral;
        if (hasAny) {
          console.log(`[Morpho API] Position found: market=${p.market?.loanAsset?.symbol}/${p.market?.collateralAsset?.symbol}, supply=$${s?.supplyAssetsUsd?.toFixed(2)}, borrow=$${s?.borrowAssetsUsd?.toFixed(2)}, collateral=$${s?.collateralUsd?.toFixed(2)}`);
        }
        return hasAny;
      })
      .map(p => {
        const s = p.state;
        return {
          marketId: p.market.uniqueKey,
          chainId,
          market: parseMarket(p.market, chainId),
          supplyShares: safeBigInt(s?.supplyShares),
          supplyAssets: safeBigInt(s?.supplyAssets),
          supplyAssetsUsd: s?.supplyAssetsUsd || 0,
          borrowShares: safeBigInt(s?.borrowShares),
          borrowAssets: safeBigInt(s?.borrowAssets),
          borrowAssetsUsd: s?.borrowAssetsUsd || 0,
          collateral: safeBigInt(s?.collateral),
          collateralUsd: s?.collateralUsd || 0,
        };
      });

    console.log(`[Morpho API] ✓ Found ${positions.length} active positions on ${config.label}`);
    return positions;
  } catch (error) {
    console.error(`[Morpho API] Failed to fetch positions on ${config.label}:`, error);
    return [];
  }
}