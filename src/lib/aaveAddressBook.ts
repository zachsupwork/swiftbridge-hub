/**
 * Aave V3 Address Book - Official Contract Addresses
 * 
 * IMPORTANT: These addresses are sourced from the official Aave address-book:
 * https://github.com/bgd-labs/aave-address-book
 * 
 * DO NOT hardcode addresses elsewhere - always import from this file.
 */

// ============================================
// AAVE V3 CONTRACT ADDRESSES BY CHAIN
// ============================================

export interface AaveV3Addresses {
  POOL_ADDRESSES_PROVIDER: `0x${string}`;
  POOL: `0x${string}`;
  UI_POOL_DATA_PROVIDER: `0x${string}`;
}

/**
 * Official Aave V3 addresses from aave-address-book
 * Source: https://github.com/bgd-labs/aave-address-book
 */
export const AAVE_V3_ADDRESSES: Record<number, AaveV3Addresses> = {
  // Ethereum Mainnet (Official Aave V3 addresses)
  1: {
    POOL_ADDRESSES_PROVIDER: '0x2f39D218133AFaB8F2B819B1066c7E434Ad94E9e',
    POOL: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    UI_POOL_DATA_PROVIDER: '0x56b7A1012765C285afAC8b8F25C69Bf10ccfE978',
  },
  // Arbitrum One
  42161: {
    POOL_ADDRESSES_PROVIDER: '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
    POOL: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    UI_POOL_DATA_PROVIDER: '0x145dE30c929a065582da84Cf96F88460dB9745A7',
  },
  // Optimism
  10: {
    POOL_ADDRESSES_PROVIDER: '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
    POOL: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    UI_POOL_DATA_PROVIDER: '0xbd83DdBE37fc91923d59C8c1E0bDe0CccCa332d5',
  },
  // Polygon
  137: {
    POOL_ADDRESSES_PROVIDER: '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
    POOL: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    UI_POOL_DATA_PROVIDER: '0xC69728f11E9E6127733751c8410432913123acf1',
  },
  // Base
  8453: {
    POOL_ADDRESSES_PROVIDER: '0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D',
    POOL: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
    UI_POOL_DATA_PROVIDER: '0x174446a6741300cD2E7C1b1A636Fee99c8F83502',
  },
  // Avalanche
  43114: {
    POOL_ADDRESSES_PROVIDER: '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
    POOL: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    UI_POOL_DATA_PROVIDER: '0xdBbFaFC45983B4659E368a3025b81f69Ab6E5093',
  },
};

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

// ============================================
// UI POOL DATA PROVIDER ABI (minimal)
// ============================================

/**
 * UiPoolDataProviderV3 ABI - Only getReservesData function
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
] as const;

// ============================================
// RESERVE DATA TYPE
// ============================================

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
}

export interface AaveBaseCurrencyInfo {
  marketReferenceCurrencyUnit: bigint;
  marketReferenceCurrencyPriceInUsd: bigint;
  networkBaseTokenPriceInUsd: bigint;
  networkBaseTokenPriceDecimals: number;
}
