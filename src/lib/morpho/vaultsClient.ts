/**
 * Morpho Vaults API Client
 * 
 * Fetches vault data from the official Morpho Blue API.
 * Uses blue-api.morpho.org/graphql with pagination and dedup.
 */

import { MORPHO_API_URL, getMorphoChainConfig } from './config';

export interface MorphoVault {
  address: string;
  chainId: number;
  name: string;
  symbol: string;
  curator: string | null;
  asset: {
    address: string;
    symbol: string;
    decimals: number;
    name: string;
    logoUrl?: string;
  };
  totalAssetsUsd: number;
  totalAssets: number;
  apy: number;
  liquidity: number;
  liquidityUsd: number;
  fee: number;
  allocators: number;
  marketsCount: number;
}

export interface VaultPosition {
  vaultAddress: string;
  chainId: number;
  vault: MorphoVault | null;
  shares: bigint;
  assets: bigint;
  assetsUsd: number;
}

// Token logo fallback
const TOKEN_LOGOS: Record<string, string> = {
  ETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/eth.svg',
  WETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg',
  USDC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  USDT: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdt.svg',
  DAI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/dai.svg',
  WBTC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg',
  PYUSD: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
};

const GENERIC_LOGO = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';

function getTokenLogo(symbol: string, logoUri?: string): string {
  if (logoUri) return logoUri;
  return TOKEN_LOGOS[symbol.toUpperCase()] || GENERIC_LOGO;
}

const VAULTS_QUERY = `
  query GetVaults($chainId: Int!, $first: Int!, $skip: Int!) {
    vaults(
      first: $first
      skip: $skip
      where: { chainId_in: [$chainId], totalAssetsUsd_gte: 100 }
      orderBy: TotalAssetsUsd
      orderDirection: Desc
    ) {
      items {
        address
        name
        symbol
        asset {
          address
          symbol
          decimals
          name
          logoURI
        }
        chain {
          id
        }
        state {
          totalAssetsUsd
          totalAssets
          apy
          fee
          allTimeApy
          allocation {
            market {
              uniqueKey
            }
          }
        }
        metadata {
          curators {
            name
          }
        }
      }
    }
  }
`;

const VAULT_POSITIONS_QUERY = `
  query GetVaultPositions($userAddress: String!, $chainId: Int!, $first: Int!) {
    vaultPositions(
      first: $first
      where: {
        userAddress: $userAddress
        chainId_in: [$chainId]
      }
    ) {
      items {
        vault {
          address
          name
          symbol
          asset {
            address
            symbol
            decimals
            name
            logoURI
          }
          state {
            totalAssetsUsd
            totalAssets
            apy
            fee
          }
          metadata {
            curators {
              name
            }
          }
        }
        shares
        assets
        assetsUsd
      }
    }
  }
`;

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function gqlFetch<T>(query: string, variables: Record<string, unknown>): Promise<T> {
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
    throw new Error(`API request failed: ${response.status}`);
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

/**
 * Fetch all vaults for a chain with pagination and dedup.
 */
export async function fetchMorphoVaults(options: {
  chainId: number;
  first?: number;
  skip?: number;
}): Promise<MorphoVault[]> {
  const { chainId } = options;

  const config = getMorphoChainConfig(chainId);
  if (!config?.enabled) {
    throw new Error(`Morpho not supported on chain ${chainId}`);
  }

  console.log(`[Morpho Vaults] Fetching for ${config.label}...`);

  const PAGE_SIZE = 100;
  const allRaw: any[] = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const data = await gqlFetch<{ vaults: { items: any[] } }>(
      VAULTS_QUERY,
      { chainId, first: PAGE_SIZE, skip }
    );

    const items = data.vaults.items;
    allRaw.push(...items);

    if (items.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      skip += PAGE_SIZE;
      if (skip >= 300) {
        hasMore = false;
      }
    }
  }

  const vaults: MorphoVault[] = allRaw
    .filter((v: any) => v.asset && v.state)
    .map((v: any) => ({
      address: v.address,
      chainId,
      name: v.name || v.symbol || 'Unnamed Vault',
      symbol: v.symbol || '???',
      curator: v.metadata?.curators?.[0]?.name || null,
      asset: {
        address: v.asset.address,
        symbol: v.asset.symbol || 'UNKNOWN',
        decimals: v.asset.decimals || 18,
        name: v.asset.name || 'Unknown',
        logoUrl: getTokenLogo(v.asset.symbol || '', v.asset.logoURI),
      },
      totalAssetsUsd: v.state.totalAssetsUsd || 0,
      totalAssets: parseFloat(v.state.totalAssets || '0') / Math.pow(10, v.asset.decimals || 18),
      apy: (v.state.apy || 0) * 100,
      liquidity: 0,
      liquidityUsd: 0,
      fee: (v.state.fee || 0) * 100,
      allocators: 0,
      marketsCount: v.state.allocation?.length || 0,
    }));

  // Deduplicate by address (lowercase)
  const seen = new Set<string>();
  const deduped = vaults.filter(v => {
    const key = v.address.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[Morpho Vaults] ✓ Loaded ${deduped.length} unique vaults from ${config.label}`);
  return deduped;
}

export async function fetchMorphoVaultPositions(options: {
  userAddress: string;
  chainId: number;
  first?: number;
}): Promise<VaultPosition[]> {
  const { userAddress, chainId, first = 100 } = options;

  const config = getMorphoChainConfig(chainId);
  if (!config?.enabled) return [];

  try {
    const data = await gqlFetch<{ vaultPositions: { items: any[] } }>(
      VAULT_POSITIONS_QUERY,
      { userAddress: userAddress.toLowerCase(), chainId, first }
    );

    return data.vaultPositions.items
      .filter((p: any) => BigInt(p.assets || '0') > 0n)
      .map((p: any) => ({
        vaultAddress: p.vault.address,
        chainId,
        vault: {
          address: p.vault.address,
          chainId,
          name: p.vault.name || p.vault.symbol || 'Vault',
          symbol: p.vault.symbol || '???',
          curator: p.vault.metadata?.curators?.[0]?.name || null,
          asset: {
            address: p.vault.asset.address,
            symbol: p.vault.asset.symbol || 'UNKNOWN',
            decimals: p.vault.asset.decimals || 18,
            name: p.vault.asset.name || 'Unknown',
            logoUrl: getTokenLogo(p.vault.asset.symbol || '', p.vault.asset.logoURI),
          },
          totalAssetsUsd: p.vault.state?.totalAssetsUsd || 0,
          totalAssets: 0,
          apy: (p.vault.state?.apy || 0) * 100,
          liquidity: 0,
          liquidityUsd: 0,
          fee: (p.vault.state?.fee || 0) * 100,
          allocators: 0,
          marketsCount: 0,
        },
        shares: BigInt(p.shares || '0'),
        assets: BigInt(p.assets || '0'),
        assetsUsd: p.assetsUsd || 0,
      }));
  } catch (error) {
    console.error(`[Morpho Vaults] Failed to fetch positions on ${config.label}:`, error);
    return [];
  }
}
