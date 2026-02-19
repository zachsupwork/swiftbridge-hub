/**
 * Aave V3 Address Book - Official Contract Addresses
 * 
 * Sources addresses from @bgd-labs/aave-address-book.
 * Also exports per-chain ASSETS maps with aToken/vToken addresses
 * for reliable position discovery via balanceOf.
 */

import { getAddress } from 'viem';
import {
  AaveV3Ethereum,
  AaveV3Arbitrum,
  AaveV3Optimism,
  AaveV3Polygon,
  AaveV3Base,
  AaveV3Avalanche,
} from '@bgd-labs/aave-address-book';

// ============================================
// TYPES
// ============================================

export interface AaveV3Addresses {
  POOL_ADDRESSES_PROVIDER: `0x${string}`;
  POOL: `0x${string}`;
  UI_POOL_DATA_PROVIDER: `0x${string}`;
  ORACLE: `0x${string}`;
  AAVE_PROTOCOL_DATA_PROVIDER: `0x${string}`;
}

export interface AaveAssetInfo {
  symbol: string;
  decimals: number;
  underlying: `0x${string}`;
  aToken: `0x${string}`;
  vToken: `0x${string}`;
}

export interface AaveV3Market {
  chainId: number;
  label: string;
  addresses: AaveV3Addresses;
  assets: AaveAssetInfo[];
}

// ============================================
// HELPER: Extract assets from address book
// ============================================

function extractAssets(assetsObj: Record<string, any>): AaveAssetInfo[] {
  const result: AaveAssetInfo[] = [];
  for (const [symbol, info] of Object.entries(assetsObj)) {
    if (!info?.UNDERLYING || !info?.A_TOKEN || !info?.V_TOKEN) continue;
    try {
      result.push({
        symbol,
        decimals: info.decimals ?? 18,
        underlying: getAddress(info.UNDERLYING) as `0x${string}`,
        aToken: getAddress(info.A_TOKEN) as `0x${string}`,
        vToken: getAddress(info.V_TOKEN) as `0x${string}`,
      });
    } catch {
      // Skip assets with invalid addresses
    }
  }
  return result;
}

// ============================================
// BUILD MARKETS MAP
// ============================================

function buildAaveV3Markets(): Map<number, AaveV3Market> {
  const markets = new Map<number, AaveV3Market>();

  const chainConfigs: Array<{
    chainId: number;
    label: string;
    source: any;
  }> = [
    { chainId: 1, label: 'Ethereum', source: AaveV3Ethereum },
    { chainId: 42161, label: 'Arbitrum', source: AaveV3Arbitrum },
    { chainId: 10, label: 'Optimism', source: AaveV3Optimism },
    { chainId: 137, label: 'Polygon', source: AaveV3Polygon },
    { chainId: 8453, label: 'Base', source: AaveV3Base },
    { chainId: 43114, label: 'Avalanche', source: AaveV3Avalanche },
  ];

  for (const { chainId, label, source } of chainConfigs) {
    try {
      markets.set(chainId, {
        chainId,
        label,
        addresses: {
          POOL_ADDRESSES_PROVIDER: getAddress(source.POOL_ADDRESSES_PROVIDER) as `0x${string}`,
          POOL: getAddress(source.POOL) as `0x${string}`,
          UI_POOL_DATA_PROVIDER: getAddress(source.UI_POOL_DATA_PROVIDER) as `0x${string}`,
          ORACLE: getAddress(source.ORACLE) as `0x${string}`,
          AAVE_PROTOCOL_DATA_PROVIDER: getAddress(source.AAVE_PROTOCOL_DATA_PROVIDER) as `0x${string}`,
        },
        assets: extractAssets(source.ASSETS || {}),
      });
    } catch (e) {
      console.warn(`[Aave Address Book] Failed to load ${label}:`, e);
    }
  }

  return markets;
}

// Build once at module load
export const AAVE_V3_MARKETS = buildAaveV3Markets();

// Legacy compatibility
export const AAVE_V3_ADDRESSES: Record<number, AaveV3Addresses> = {};
AAVE_V3_MARKETS.forEach((market, chainId) => {
  AAVE_V3_ADDRESSES[chainId] = market.addresses;
});

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getAaveAddresses(chainId: number): AaveV3Addresses | null {
  return AAVE_V3_ADDRESSES[chainId] || null;
}

export function getAaveAssets(chainId: number): AaveAssetInfo[] {
  return AAVE_V3_MARKETS.get(chainId)?.assets || [];
}

export function isAaveSupported(chainId: number): boolean {
  return chainId in AAVE_V3_ADDRESSES;
}

export function getSupportedChainIds(): number[] {
  return Object.keys(AAVE_V3_ADDRESSES).map(Number);
}

export function getPoolAddress(chainId: number): `0x${string}` | null {
  return AAVE_V3_ADDRESSES[chainId]?.POOL || null;
}

export function getAaveMarket(chainId: number): AaveV3Market | undefined {
  return AAVE_V3_MARKETS.get(chainId);
}

// Log addresses for verification in dev mode
if (import.meta.env.DEV) {
  console.log('[Aave Address Book] Loaded official addresses:');
  AAVE_V3_MARKETS.forEach((market, chainId) => {
    console.log(`  ${market.label} (${chainId}): ${market.assets.length} assets`, {
      POOL: market.addresses.POOL,
      POOL_ADDRESSES_PROVIDER: market.addresses.POOL_ADDRESSES_PROVIDER,
      UI_POOL_DATA_PROVIDER: market.addresses.UI_POOL_DATA_PROVIDER,
    });
  });
}
