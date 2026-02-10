/**
 * Morpho GraphQL API Client
 * 
 * Fetches market and position data from the official Morpho API.
 * No API key required.
 */

import { MORPHO_API_URL, getMorphoChainConfig } from './config';
import type { MorphoMarket, MorphoAsset } from './types';

// Token logo by symbol (high-quality CDN sources)
const TOKEN_LOGOS: Record<string, string> = {
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  WETH: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  DAI: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png',
  WBTC: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  CBETH: 'https://assets.coingecko.com/coins/images/27008/small/cbeth.png',
  WSTETH: 'https://assets.coingecko.com/coins/images/18834/small/wstETH.png',
  STETH: 'https://assets.coingecko.com/coins/images/13442/small/steth_logo.png',
  RETH: 'https://assets.coingecko.com/coins/images/20764/small/reth.png',
  CBBTC: 'https://assets.coingecko.com/coins/images/40143/small/cbbtc.png',
  LINK: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  UNI: 'https://assets.coingecko.com/coins/images/12504/small/uni.jpg',
  AAVE: 'https://assets.coingecko.com/coins/images/12645/small/aave-token-round.png',
  CRV: 'https://assets.coingecko.com/coins/images/12124/small/Curve.png',
  COMP: 'https://assets.coingecko.com/coins/images/10775/small/COMP.png',
  MKR: 'https://assets.coingecko.com/coins/images/1364/small/Mark_Maker.png',
  SDAI: 'https://assets.coingecko.com/coins/images/32610/small/sdai.png',
  GHO: 'https://assets.coingecko.com/coins/images/30663/small/gho-token-logo.png',
  USDE: 'https://assets.coingecko.com/coins/images/33613/small/usde.png',
  SUSDE: 'https://assets.coingecko.com/coins/images/33669/small/sUSDe.png',
  WEETH: 'https://assets.coingecko.com/coins/images/33033/small/weETH.png',
  EZETH: 'https://assets.coingecko.com/coins/images/34753/small/ezeth.png',
  OSETH: 'https://assets.coingecko.com/coins/images/33117/small/osETH.png',
  FRAX: 'https://assets.coingecko.com/coins/images/13422/small/FRAX_icon.png',
  LUSD: 'https://assets.coingecko.com/coins/images/14666/small/lusd.png',
  PYUSD: 'https://assets.coingecko.com/coins/images/31212/small/PYUSD_Logo_%282%29.png',
  TBTC: 'https://assets.coingecko.com/coins/images/11224/small/0x18084fba666a33d37592fa2633fd49a74dd93a88.png',
  MORPHO: 'https://assets.coingecko.com/coins/images/38440/small/morpho.jpg',
  SWETH: 'https://assets.coingecko.com/coins/images/30326/small/swETH.png',
  METH: 'https://assets.coingecko.com/coins/images/33345/small/meth.png',
  RSETH: 'https://assets.coingecko.com/coins/images/35088/small/rsETH.png',
  PUFETH: 'https://assets.coingecko.com/coins/images/35166/small/pufETH.png',
};

// Ethereum mainnet token address → TrustWallet CDN logo
function getTrustWalletLogo(address: string): string {
  const checksummed = address; // address is usually checksummed from API
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${checksummed}/logo.png`;
}

function getTokenLogo(symbol: string, address?: string): string {
  const normalized = symbol.toUpperCase().replace(/[.\-]/g, '');
  if (TOKEN_LOGOS[normalized]) return TOKEN_LOGOS[normalized];
  // Fallback: TrustWallet CDN by address (Ethereum mainnet)
  if (address && address.startsWith('0x') && address.length === 42) {
    return getTrustWalletLogo(address);
  }
  // Final fallback: CoinGecko generic or empty (let component show letter)
  return '';
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
    logoUrl: getTokenLogo(asset.symbol || '', asset.address),
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

  const markets = data.markets.items
    .map(m => parseMarket(m, chainId))
    .filter((m): m is MorphoMarket => m !== null && m.totalSupplyUsd > 0);

  console.log(`[Morpho API] ✓ Loaded ${markets.length} markets from ${config.label}`);
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
