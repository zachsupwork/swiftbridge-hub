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
// UI POOL DATA PROVIDER ABI
// ============================================

/**
 * UiPoolDataProviderV3 ABI - Official Aave V3.1 interface
 * 
 * Source: https://github.com/aave/aave-v3-periphery/blob/master/contracts/misc/UiPoolDataProviderV3.sol
 * 
 * CRITICAL: The AggregatedReserveData struct fields MUST be in EXACT order as defined in Solidity.
 * Any mismatch causes viem decoding errors ("Bytes value is not a valid boolean").
 * 
 * This ABI field order is verified against the official Aave V3.1 IUiPoolDataProviderV3.sol interface.
 * 
 * INDEX ORDER (must match exactly):
 * 0: underlyingAsset (address)
 * 1: name (string)
 * 2: symbol (string)
 * 3: decimals (uint256)
 * 4: baseLTVasCollateral (uint256)
 * 5: reserveLiquidationThreshold (uint256)
 * 6: reserveLiquidationBonus (uint256)
 * 7: reserveFactor (uint256)
 * 8: usageAsCollateralEnabled (bool)
 * 9: borrowingEnabled (bool)
 * 10: stableBorrowRateEnabled (bool)
 * 11: isActive (bool)
 * 12: isFrozen (bool)
 * 13: liquidityIndex (uint128)
 * 14: variableBorrowIndex (uint128)
 * 15: liquidityRate (uint128)
 * 16: variableBorrowRate (uint128)
 * 17: stableBorrowRate (uint128)
 * 18: lastUpdateTimestamp (uint40)
 * 19: aTokenAddress (address)
 * 20: stableDebtTokenAddress (address)
 * 21: variableDebtTokenAddress (address)
 * 22: interestRateStrategyAddress (address)
 * 23: availableLiquidity (uint256)
 * 24: totalPrincipalStableDebt (uint256)
 * 25: averageStableRate (uint256)
 * 26: stableDebtLastUpdateTimestamp (uint256)
 * 27: totalScaledVariableDebt (uint256)
 * 28: priceInMarketReferenceCurrency (uint256)
 * 29: priceOracle (address)
 * 30: variableRateSlope1 (uint256)
 * 31: variableRateSlope2 (uint256)
 * 32: stableRateSlope1 (uint256)
 * 33: stableRateSlope2 (uint256)
 * 34: baseStableBorrowRate (uint256)
 * 35: baseVariableBorrowRate (uint256)
 * 36: optimalUsageRatio (uint256)
 * 37: isPaused (bool)
 * 38: isSiloedBorrowing (bool)
 * 39: accruedToTreasury (uint128)
 * 40: unbacked (uint128)
 * 41: isolationModeTotalDebt (uint128)
 * 42: flashLoanEnabled (bool)
 * 43: debtCeiling (uint256)
 * 44: debtCeilingDecimals (uint256)
 * 45: eModeCategoryId (uint8)
 * 46: borrowCap (uint256)
 * 47: supplyCap (uint256)
 * 48: eModeLtv (uint16)
 * 49: eModeLiquidationThreshold (uint16)
 * 50: eModeLiquidationBonus (uint16)
 * 51: eModePriceSource (address)
 * 52: eModeLabel (string)
 * 53: borrowableInIsolation (bool)
 * 54: virtualAccActive (bool) - V3.1
 * 55: virtualUnderlyingBalance (uint128) - V3.1
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
          // 0: Core asset info
          { internalType: 'address', name: 'underlyingAsset', type: 'address' },
          // 1-3: Token metadata
          { internalType: 'string', name: 'name', type: 'string' },
          { internalType: 'string', name: 'symbol', type: 'string' },
          { internalType: 'uint256', name: 'decimals', type: 'uint256' },
          // 4-7: Collateral configuration
          { internalType: 'uint256', name: 'baseLTVasCollateral', type: 'uint256' },
          { internalType: 'uint256', name: 'reserveLiquidationThreshold', type: 'uint256' },
          { internalType: 'uint256', name: 'reserveLiquidationBonus', type: 'uint256' },
          { internalType: 'uint256', name: 'reserveFactor', type: 'uint256' },
          // 8-12: Borrowing flags
          { internalType: 'bool', name: 'usageAsCollateralEnabled', type: 'bool' },
          { internalType: 'bool', name: 'borrowingEnabled', type: 'bool' },
          { internalType: 'bool', name: 'stableBorrowRateEnabled', type: 'bool' },
          { internalType: 'bool', name: 'isActive', type: 'bool' },
          { internalType: 'bool', name: 'isFrozen', type: 'bool' },
          // 13-18: Indices and rates (RAY = 1e27)
          { internalType: 'uint128', name: 'liquidityIndex', type: 'uint128' },
          { internalType: 'uint128', name: 'variableBorrowIndex', type: 'uint128' },
          { internalType: 'uint128', name: 'liquidityRate', type: 'uint128' },
          { internalType: 'uint128', name: 'variableBorrowRate', type: 'uint128' },
          { internalType: 'uint128', name: 'stableBorrowRate', type: 'uint128' },
          { internalType: 'uint40', name: 'lastUpdateTimestamp', type: 'uint40' },
          // 19-22: Token addresses
          { internalType: 'address', name: 'aTokenAddress', type: 'address' },
          { internalType: 'address', name: 'stableDebtTokenAddress', type: 'address' },
          { internalType: 'address', name: 'variableDebtTokenAddress', type: 'address' },
          { internalType: 'address', name: 'interestRateStrategyAddress', type: 'address' },
          // 23-27: Liquidity and debt
          { internalType: 'uint256', name: 'availableLiquidity', type: 'uint256' },
          { internalType: 'uint256', name: 'totalPrincipalStableDebt', type: 'uint256' },
          { internalType: 'uint256', name: 'averageStableRate', type: 'uint256' },
          { internalType: 'uint256', name: 'stableDebtLastUpdateTimestamp', type: 'uint256' },
          { internalType: 'uint256', name: 'totalScaledVariableDebt', type: 'uint256' },
          // 28-29: Price data
          { internalType: 'uint256', name: 'priceInMarketReferenceCurrency', type: 'uint256' },
          { internalType: 'address', name: 'priceOracle', type: 'address' },
          // 30-36: Interest rate strategy params
          { internalType: 'uint256', name: 'variableRateSlope1', type: 'uint256' },
          { internalType: 'uint256', name: 'variableRateSlope2', type: 'uint256' },
          { internalType: 'uint256', name: 'stableRateSlope1', type: 'uint256' },
          { internalType: 'uint256', name: 'stableRateSlope2', type: 'uint256' },
          { internalType: 'uint256', name: 'baseStableBorrowRate', type: 'uint256' },
          { internalType: 'uint256', name: 'baseVariableBorrowRate', type: 'uint256' },
          { internalType: 'uint256', name: 'optimalUsageRatio', type: 'uint256' },
          // 37-38: V3 flags
          { internalType: 'bool', name: 'isPaused', type: 'bool' },
          { internalType: 'bool', name: 'isSiloedBorrowing', type: 'bool' },
          // 39-41: Unbacked and treasury
          { internalType: 'uint128', name: 'accruedToTreasury', type: 'uint128' },
          { internalType: 'uint128', name: 'unbacked', type: 'uint128' },
          { internalType: 'uint128', name: 'isolationModeTotalDebt', type: 'uint128' },
          // 42: Flash loan flag
          { internalType: 'bool', name: 'flashLoanEnabled', type: 'bool' },
          // 43-44: Debt ceiling
          { internalType: 'uint256', name: 'debtCeiling', type: 'uint256' },
          { internalType: 'uint256', name: 'debtCeilingDecimals', type: 'uint256' },
          // 45-52: eMode fields
          { internalType: 'uint8', name: 'eModeCategoryId', type: 'uint8' },
          { internalType: 'uint256', name: 'borrowCap', type: 'uint256' },
          { internalType: 'uint256', name: 'supplyCap', type: 'uint256' },
          { internalType: 'uint16', name: 'eModeLtv', type: 'uint16' },
          { internalType: 'uint16', name: 'eModeLiquidationThreshold', type: 'uint16' },
          { internalType: 'uint16', name: 'eModeLiquidationBonus', type: 'uint16' },
          { internalType: 'address', name: 'eModePriceSource', type: 'address' },
          { internalType: 'string', name: 'eModeLabel', type: 'string' },
          // 53: Isolation borrowable flag
          { internalType: 'bool', name: 'borrowableInIsolation', type: 'bool' },
          // 54-55: V3.1 virtual accounting fields
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
 * AaveReserveData interface - matches the ABI struct exactly in field order
 * 
 * CRITICAL: Field order MUST match the Solidity struct for correct decoding
 */
export interface AaveReserveData {
  // 0: Core asset info
  underlyingAsset: `0x${string}`;
  // 1-3: Token metadata
  name: string;
  symbol: string;
  decimals: bigint;
  // 4-7: Collateral configuration
  baseLTVasCollateral: bigint;
  reserveLiquidationThreshold: bigint;
  reserveLiquidationBonus: bigint;
  reserveFactor: bigint;
  // 8-12: Borrowing flags
  usageAsCollateralEnabled: boolean;
  borrowingEnabled: boolean;
  stableBorrowRateEnabled: boolean;
  isActive: boolean;
  isFrozen: boolean;
  // 13-18: Indices and rates
  liquidityIndex: bigint;
  variableBorrowIndex: bigint;
  liquidityRate: bigint;
  variableBorrowRate: bigint;
  stableBorrowRate: bigint;
  lastUpdateTimestamp: bigint;
  // 19-22: Token addresses
  aTokenAddress: `0x${string}`;
  stableDebtTokenAddress: `0x${string}`;
  variableDebtTokenAddress: `0x${string}`;
  interestRateStrategyAddress: `0x${string}`;
  // 23-27: Liquidity and debt
  availableLiquidity: bigint;
  totalPrincipalStableDebt: bigint;
  averageStableRate: bigint;
  stableDebtLastUpdateTimestamp: bigint;
  totalScaledVariableDebt: bigint;
  // 28-29: Price data
  priceInMarketReferenceCurrency: bigint;
  priceOracle: `0x${string}`;
  // 30-36: Interest rate strategy params
  variableRateSlope1: bigint;
  variableRateSlope2: bigint;
  stableRateSlope1: bigint;
  stableRateSlope2: bigint;
  baseStableBorrowRate: bigint;
  baseVariableBorrowRate: bigint;
  optimalUsageRatio: bigint;
  // 37-38: V3 flags
  isPaused: boolean;
  isSiloedBorrowing: boolean;
  // 39-41: Unbacked and treasury
  accruedToTreasury: bigint;
  unbacked: bigint;
  isolationModeTotalDebt: bigint;
  // 42: Flash loan flag
  flashLoanEnabled: boolean;
  // 43-44: Debt ceiling
  debtCeiling: bigint;
  debtCeilingDecimals: bigint;
  // 45-52: eMode fields
  eModeCategoryId: number;
  borrowCap: bigint;
  supplyCap: bigint;
  eModeLtv: number;
  eModeLiquidationThreshold: number;
  eModeLiquidationBonus: number;
  eModePriceSource: `0x${string}`;
  eModeLabel: string;
  // 53: Isolation borrowable flag
  borrowableInIsolation: boolean;
  // 54-55: V3.1 virtual accounting fields
  virtualAccActive: boolean;
  virtualUnderlyingBalance: bigint;
}

export interface AaveBaseCurrencyInfo {
  marketReferenceCurrencyUnit: bigint;
  marketReferenceCurrencyPriceInUsd: bigint;
  networkBaseTokenPriceInUsd: bigint;
  networkBaseTokenPriceDecimals: number;
}
