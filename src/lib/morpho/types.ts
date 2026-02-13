/**
 * Morpho Blue Type Definitions
 * 
 * Shared types for markets, positions, and actions.
 */

export interface MorphoChainConfig {
  chainId: number;
  label: string;
  logo: string;
  enabled: boolean;
  morphoBlue: `0x${string}`;
  bundler?: `0x${string}`;
}

export interface MorphoAsset {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  logoUrl?: string;
}

export interface MorphoMarket {
  id: string;
  uniqueKey: string;
  chainId: number;
  loanAsset: MorphoAsset;
  collateralAsset: MorphoAsset | null;
  lltv: number; // Loan-to-Value ratio as percentage (e.g., 86.5)
  supplyApy: number; // Already as percentage (e.g., 5.2)
  borrowApy: number;
  totalSupplyUsd: number;
  totalBorrowUsd: number;
  availableLiquidityUsd: number;
  utilization: number; // As percentage (e.g., 75.3)
  oracle: string;
  irm: string;
  // Extended fields for Morpho parity
  totalSupplyAssets: number; // In loan token units
  totalBorrowAssets: number; // In loan token units
  liquidityAssets: number;   // In loan token units
  totalCollateralUsd: number;
  rateAtTarget: number | null; // IRM rate at target utilization (percentage)
  fee: number; // Protocol fee as percentage (e.g., 10 = 10%)
  morphoBlue: string; // Morpho Blue core contract
}

export interface MorphoPosition {
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
  healthFactor: number | null; // null if no borrow
  isHealthy: boolean;
  maxBorrowableAssets: bigint;
}

export interface MorphoMarketParams {
  loanToken: `0x${string}`;
  collateralToken: `0x${string}`;
  oracle: `0x${string}`;
  irm: `0x${string}`;
  lltv: bigint;
}

export type MorphoActionType = 'supply' | 'withdraw' | 'borrow' | 'repay' | 'supplyCollateral' | 'withdrawCollateral';

export interface MorphoActionResult {
  success: boolean;
  txHash?: `0x${string}`;
  error?: string;
}

export interface FeeInfo {
  feeAmount: bigint;
  feeAmountFormatted: string;
  feeWallet: `0x${string}`;
  feeBps: number;
  feePercentage: string;
}
