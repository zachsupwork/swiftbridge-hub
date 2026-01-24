/**
 * Aave V3 Address Book - Official Contract Addresses
 * 
 * IMPORTANT: These addresses are sourced from the official @bgd-labs/aave-address-book package.
 * https://github.com/bgd-labs/aave-address-book
 * 
 * DO NOT hardcode addresses elsewhere - always import from this file.
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
// AAVE V3 CONTRACT ADDRESSES BY CHAIN
// ============================================

export interface AaveV3Addresses {
  POOL_ADDRESSES_PROVIDER: `0x${string}`;
  POOL: `0x${string}`;
  UI_POOL_DATA_PROVIDER: `0x${string}`;
  ORACLE: `0x${string}`;
}

export interface AaveV3Market {
  chainId: number;
  label: string;
  addresses: AaveV3Addresses;
}

/**
 * Build the Aave V3 markets map from official address book
 * All addresses are already checksummed by the package
 */
function buildAaveV3Markets(): Map<number, AaveV3Market> {
  const markets = new Map<number, AaveV3Market>();

  // Ethereum Mainnet
  markets.set(1, {
    chainId: 1,
    label: 'Ethereum',
    addresses: {
      POOL_ADDRESSES_PROVIDER: getAddress(AaveV3Ethereum.POOL_ADDRESSES_PROVIDER) as `0x${string}`,
      POOL: getAddress(AaveV3Ethereum.POOL) as `0x${string}`,
      UI_POOL_DATA_PROVIDER: getAddress(AaveV3Ethereum.UI_POOL_DATA_PROVIDER) as `0x${string}`,
      ORACLE: getAddress(AaveV3Ethereum.ORACLE) as `0x${string}`,
    },
  });

  // Arbitrum One
  markets.set(42161, {
    chainId: 42161,
    label: 'Arbitrum',
    addresses: {
      POOL_ADDRESSES_PROVIDER: getAddress(AaveV3Arbitrum.POOL_ADDRESSES_PROVIDER) as `0x${string}`,
      POOL: getAddress(AaveV3Arbitrum.POOL) as `0x${string}`,
      UI_POOL_DATA_PROVIDER: getAddress(AaveV3Arbitrum.UI_POOL_DATA_PROVIDER) as `0x${string}`,
      ORACLE: getAddress(AaveV3Arbitrum.ORACLE) as `0x${string}`,
    },
  });

  // Optimism
  markets.set(10, {
    chainId: 10,
    label: 'Optimism',
    addresses: {
      POOL_ADDRESSES_PROVIDER: getAddress(AaveV3Optimism.POOL_ADDRESSES_PROVIDER) as `0x${string}`,
      POOL: getAddress(AaveV3Optimism.POOL) as `0x${string}`,
      UI_POOL_DATA_PROVIDER: getAddress(AaveV3Optimism.UI_POOL_DATA_PROVIDER) as `0x${string}`,
      ORACLE: getAddress(AaveV3Optimism.ORACLE) as `0x${string}`,
    },
  });

  // Polygon
  markets.set(137, {
    chainId: 137,
    label: 'Polygon',
    addresses: {
      POOL_ADDRESSES_PROVIDER: getAddress(AaveV3Polygon.POOL_ADDRESSES_PROVIDER) as `0x${string}`,
      POOL: getAddress(AaveV3Polygon.POOL) as `0x${string}`,
      UI_POOL_DATA_PROVIDER: getAddress(AaveV3Polygon.UI_POOL_DATA_PROVIDER) as `0x${string}`,
      ORACLE: getAddress(AaveV3Polygon.ORACLE) as `0x${string}`,
    },
  });

  // Base
  markets.set(8453, {
    chainId: 8453,
    label: 'Base',
    addresses: {
      POOL_ADDRESSES_PROVIDER: getAddress(AaveV3Base.POOL_ADDRESSES_PROVIDER) as `0x${string}`,
      POOL: getAddress(AaveV3Base.POOL) as `0x${string}`,
      UI_POOL_DATA_PROVIDER: getAddress(AaveV3Base.UI_POOL_DATA_PROVIDER) as `0x${string}`,
      ORACLE: getAddress(AaveV3Base.ORACLE) as `0x${string}`,
    },
  });

  // Avalanche
  markets.set(43114, {
    chainId: 43114,
    label: 'Avalanche',
    addresses: {
      POOL_ADDRESSES_PROVIDER: getAddress(AaveV3Avalanche.POOL_ADDRESSES_PROVIDER) as `0x${string}`,
      POOL: getAddress(AaveV3Avalanche.POOL) as `0x${string}`,
      UI_POOL_DATA_PROVIDER: getAddress(AaveV3Avalanche.UI_POOL_DATA_PROVIDER) as `0x${string}`,
      ORACLE: getAddress(AaveV3Avalanche.ORACLE) as `0x${string}`,
    },
  });

  return markets;
}

// Build markets once at module load
export const AAVE_V3_MARKETS = buildAaveV3Markets();

// Legacy compatibility - map to old structure
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
    console.log(`  ${market.label} (${chainId}):`, {
      POOL: market.addresses.POOL,
      POOL_ADDRESSES_PROVIDER: market.addresses.POOL_ADDRESSES_PROVIDER,
      UI_POOL_DATA_PROVIDER: market.addresses.UI_POOL_DATA_PROVIDER,
    });
  });
}

// ============================================
// UI POOL DATA PROVIDER ABI (minimal)
// ============================================

/**
 * UiPoolDataProviderV3 ABI - getReservesData function
 * 
 * IMPORTANT: This ABI matches the Aave V3.1 periphery contracts deployed on
 * Optimism, Base, Arbitrum, Polygon, Ethereum, and Avalanche.
 * 
 * The struct includes v3.1 fields (virtualAccActive, virtualUnderlyingBalance)
 * which are present on most L2 deployments.
 * 
 * Source: https://github.com/aave/aave-v3-periphery/blob/master/contracts/misc/UiPoolDataProviderV3.sol
 */
export const UI_POOL_DATA_PROVIDER_ABI = [
  {
    inputs: [
      { internalType: 'contract IPoolAddressesProvider', name: 'provider', type: 'address' }
    ],
    name: 'getReservesData',
    outputs: [
      {
        components: [
          { internalType: 'address', name: 'underlyingAsset', type: 'address' },
          { internalType: 'string', name: 'name', type: 'string' },
          { internalType: 'string', name: 'symbol', type: 'string' },
          { internalType: 'uint256', name: 'decimals', type: 'uint256' },
          { internalType: 'uint256', name: 'baseLTVasCollateral', type: 'uint256' },
          { internalType: 'uint256', name: 'reserveLiquidationThreshold', type: 'uint256' },
          { internalType: 'uint256', name: 'reserveLiquidationBonus', type: 'uint256' },
          { internalType: 'uint256', name: 'reserveFactor', type: 'uint256' },
          { internalType: 'bool', name: 'usageAsCollateralEnabled', type: 'bool' },
          { internalType: 'bool', name: 'borrowingEnabled', type: 'bool' },
          { internalType: 'bool', name: 'stableBorrowRateEnabled', type: 'bool' },
          { internalType: 'bool', name: 'isActive', type: 'bool' },
          { internalType: 'bool', name: 'isFrozen', type: 'bool' },
          { internalType: 'uint128', name: 'liquidityIndex', type: 'uint128' },
          { internalType: 'uint128', name: 'variableBorrowIndex', type: 'uint128' },
          { internalType: 'uint128', name: 'liquidityRate', type: 'uint128' },
          { internalType: 'uint128', name: 'variableBorrowRate', type: 'uint128' },
          { internalType: 'uint128', name: 'stableBorrowRate', type: 'uint128' },
          { internalType: 'uint40', name: 'lastUpdateTimestamp', type: 'uint40' },
          { internalType: 'address', name: 'aTokenAddress', type: 'address' },
          { internalType: 'address', name: 'stableDebtTokenAddress', type: 'address' },
          { internalType: 'address', name: 'variableDebtTokenAddress', type: 'address' },
          { internalType: 'address', name: 'interestRateStrategyAddress', type: 'address' },
          { internalType: 'uint256', name: 'availableLiquidity', type: 'uint256' },
          { internalType: 'uint256', name: 'totalPrincipalStableDebt', type: 'uint256' },
          { internalType: 'uint256', name: 'averageStableRate', type: 'uint256' },
          { internalType: 'uint256', name: 'stableDebtLastUpdateTimestamp', type: 'uint256' },
          { internalType: 'uint256', name: 'totalScaledVariableDebt', type: 'uint256' },
          { internalType: 'uint256', name: 'priceInMarketReferenceCurrency', type: 'uint256' },
          { internalType: 'address', name: 'priceOracle', type: 'address' },
          { internalType: 'uint256', name: 'variableRateSlope1', type: 'uint256' },
          { internalType: 'uint256', name: 'variableRateSlope2', type: 'uint256' },
          { internalType: 'uint256', name: 'stableRateSlope1', type: 'uint256' },
          { internalType: 'uint256', name: 'stableRateSlope2', type: 'uint256' },
          { internalType: 'uint256', name: 'baseStableBorrowRate', type: 'uint256' },
          { internalType: 'uint256', name: 'baseVariableBorrowRate', type: 'uint256' },
          { internalType: 'uint256', name: 'optimalUsageRatio', type: 'uint256' },
          { internalType: 'bool', name: 'isPaused', type: 'bool' },
          { internalType: 'bool', name: 'isSiloedBorrowing', type: 'bool' },
          { internalType: 'uint128', name: 'accruedToTreasury', type: 'uint128' },
          { internalType: 'uint128', name: 'unbacked', type: 'uint128' },
          { internalType: 'uint128', name: 'isolationModeTotalDebt', type: 'uint128' },
          { internalType: 'bool', name: 'flashLoanEnabled', type: 'bool' },
          { internalType: 'uint256', name: 'debtCeiling', type: 'uint256' },
          { internalType: 'uint256', name: 'debtCeilingDecimals', type: 'uint256' },
          { internalType: 'uint8', name: 'eModeCategoryId', type: 'uint8' },
          { internalType: 'uint256', name: 'borrowCap', type: 'uint256' },
          { internalType: 'uint256', name: 'supplyCap', type: 'uint256' },
          { internalType: 'uint16', name: 'eModeLtv', type: 'uint16' },
          { internalType: 'uint16', name: 'eModeLiquidationThreshold', type: 'uint16' },
          { internalType: 'uint16', name: 'eModeLiquidationBonus', type: 'uint16' },
          { internalType: 'address', name: 'eModePriceSource', type: 'address' },
          { internalType: 'string', name: 'eModeLabel', type: 'string' },
          { internalType: 'bool', name: 'borrowableInIsolation', type: 'bool' },
          // V3.1 fields - required for L2 deployments (Optimism, Base, Arbitrum, etc.)
          { internalType: 'bool', name: 'virtualAccActive', type: 'bool' },
          { internalType: 'uint128', name: 'virtualUnderlyingBalance', type: 'uint128' },
        ],
        internalType: 'struct IUiPoolDataProviderV3.AggregatedReserveData[]',
        name: '',
        type: 'tuple[]',
      },
      {
        components: [
          { internalType: 'uint256', name: 'marketReferenceCurrencyUnit', type: 'uint256' },
          { internalType: 'int256', name: 'marketReferenceCurrencyPriceInUsd', type: 'int256' },
          { internalType: 'int256', name: 'networkBaseTokenPriceInUsd', type: 'int256' },
          { internalType: 'uint8', name: 'networkBaseTokenPriceDecimals', type: 'uint8' },
        ],
        internalType: 'struct IUiPoolDataProviderV3.BaseCurrencyInfo',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'contract IPoolAddressesProvider', name: 'provider', type: 'address' }
    ],
    name: 'getReservesList',
    outputs: [
      { internalType: 'address[]', name: '', type: 'address[]' }
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ============================================
// RESERVE DATA TYPE
// ============================================

/**
 * AaveReserveData interface - matches the ABI struct exactly
 * Includes V3.1 fields for L2 compatibility
 */
export interface AaveReserveData {
  underlyingAsset: `0x${string}`;
  name: string;
  symbol: string;
  decimals: bigint;
  baseLTVasCollateral: bigint;
  reserveLiquidationThreshold: bigint;
  reserveLiquidationBonus: bigint;
  reserveFactor: bigint;
  usageAsCollateralEnabled: boolean;
  borrowingEnabled: boolean;
  stableBorrowRateEnabled: boolean;
  isActive: boolean;
  isFrozen: boolean;
  liquidityIndex: bigint;
  variableBorrowIndex: bigint;
  liquidityRate: bigint;
  variableBorrowRate: bigint;
  stableBorrowRate: bigint;
  lastUpdateTimestamp: number;
  aTokenAddress: `0x${string}`;
  stableDebtTokenAddress: `0x${string}`;
  variableDebtTokenAddress: `0x${string}`;
  interestRateStrategyAddress: `0x${string}`;
  availableLiquidity: bigint;
  totalPrincipalStableDebt: bigint;
  averageStableRate: bigint;
  stableDebtLastUpdateTimestamp: bigint;
  totalScaledVariableDebt: bigint;
  priceInMarketReferenceCurrency: bigint;
  priceOracle: `0x${string}`;
  variableRateSlope1: bigint;
  variableRateSlope2: bigint;
  stableRateSlope1: bigint;
  stableRateSlope2: bigint;
  baseStableBorrowRate: bigint;
  baseVariableBorrowRate: bigint;
  optimalUsageRatio: bigint;
  isPaused: boolean;
  isSiloedBorrowing: boolean;
  accruedToTreasury: bigint;
  unbacked: bigint;
  isolationModeTotalDebt: bigint;
  flashLoanEnabled: boolean;
  debtCeiling: bigint;
  debtCeilingDecimals: bigint;
  eModeCategoryId: number;
  borrowCap: bigint;
  supplyCap: bigint;
  eModeLtv: number;
  eModeLiquidationThreshold: number;
  eModeLiquidationBonus: number;
  eModePriceSource: `0x${string}`;
  eModeLabel: string;
  borrowableInIsolation: boolean;
  // V3.1 fields
  virtualAccActive?: boolean;
  virtualUnderlyingBalance?: bigint;
}

export interface AaveBaseCurrencyInfo {
  marketReferenceCurrencyUnit: bigint;
  marketReferenceCurrencyPriceInUsd: bigint;
  networkBaseTokenPriceInUsd: bigint;
  networkBaseTokenPriceDecimals: number;
}
