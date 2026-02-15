/**
 * Morpho Blue On-Chain Actions
 * 
 * Handles supply, withdraw, borrow, repay operations.
 * Uses wagmi writeContract for transaction execution.
 */

import { parseUnits, formatUnits, erc20Abi, type Hash } from 'viem';
import { MORPHO_BLUE_ADDRESS } from './config';
import type { MorphoMarket, MorphoMarketParams, FeeInfo } from './types';

/**
 * Get the Morpho Blue contract address for a specific market.
 * Uses the market's morphoBlue field (from API) with fallback to default.
 */
export function getMorphoBlueForMarket(market: MorphoMarket): `0x${string}` {
  return (market.morphoBlue as `0x${string}`) || MORPHO_BLUE_ADDRESS;
}
import { FEE_WALLET, FEE_BPS, isPlatformFeeConfigured } from '@/lib/env';

// Morpho Blue ABI (minimal subset for our actions)
export const MORPHO_BLUE_ABI = [
  {
    name: 'supply',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', type: 'address' },
          { name: 'collateralToken', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'irm', type: 'address' },
          { name: 'lltv', type: 'uint256' },
        ],
      },
      { name: 'assets', type: 'uint256' },
      { name: 'shares', type: 'uint256' },
      { name: 'onBehalf', type: 'address' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [
      { name: 'assetsSupplied', type: 'uint256' },
      { name: 'sharesSupplied', type: 'uint256' },
    ],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', type: 'address' },
          { name: 'collateralToken', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'irm', type: 'address' },
          { name: 'lltv', type: 'uint256' },
        ],
      },
      { name: 'assets', type: 'uint256' },
      { name: 'shares', type: 'uint256' },
      { name: 'onBehalf', type: 'address' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [
      { name: 'assetsWithdrawn', type: 'uint256' },
      { name: 'sharesWithdrawn', type: 'uint256' },
    ],
  },
  {
    name: 'borrow',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', type: 'address' },
          { name: 'collateralToken', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'irm', type: 'address' },
          { name: 'lltv', type: 'uint256' },
        ],
      },
      { name: 'assets', type: 'uint256' },
      { name: 'shares', type: 'uint256' },
      { name: 'onBehalf', type: 'address' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [
      { name: 'assetsBorrowed', type: 'uint256' },
      { name: 'sharesBorrowed', type: 'uint256' },
    ],
  },
  {
    name: 'repay',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', type: 'address' },
          { name: 'collateralToken', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'irm', type: 'address' },
          { name: 'lltv', type: 'uint256' },
        ],
      },
      { name: 'assets', type: 'uint256' },
      { name: 'shares', type: 'uint256' },
      { name: 'onBehalf', type: 'address' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [
      { name: 'assetsRepaid', type: 'uint256' },
      { name: 'sharesRepaid', type: 'uint256' },
    ],
  },
  {
    name: 'supplyCollateral',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', type: 'address' },
          { name: 'collateralToken', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'irm', type: 'address' },
          { name: 'lltv', type: 'uint256' },
        ],
      },
      { name: 'assets', type: 'uint256' },
      { name: 'onBehalf', type: 'address' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'withdrawCollateral',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', type: 'address' },
          { name: 'collateralToken', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'irm', type: 'address' },
          { name: 'lltv', type: 'uint256' },
        ],
      },
      { name: 'assets', type: 'uint256' },
      { name: 'onBehalf', type: 'address' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [],
  },
] as const;

/**
 * Convert market to on-chain marketParams tuple
 */
export function marketToParams(market: MorphoMarket): MorphoMarketParams {
  // LLTV is stored as percentage, convert back to 1e18 scale
  const lltvBigInt = BigInt(Math.floor(market.lltv * 1e16)); // lltv% * 1e16 = lltv * 1e18

  return {
    loanToken: market.loanAsset.address as `0x${string}`,
    collateralToken: (market.collateralAsset?.address || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    oracle: market.oracle as `0x${string}`,
    irm: market.irm as `0x${string}`,
    lltv: lltvBigInt,
  };
}

/**
 * Calculate platform fee for an amount
 */
export function calculateFee(amount: bigint, decimals: number): FeeInfo | null {
  if (!isPlatformFeeConfigured() || FEE_BPS === 0) {
    return null;
  }

  const feeAmount = (amount * BigInt(FEE_BPS)) / 10000n;
  const feeAmountFormatted = formatUnits(feeAmount, decimals);

  return {
    feeAmount,
    feeAmountFormatted,
    feeWallet: FEE_WALLET,
    feeBps: FEE_BPS,
    feePercentage: (FEE_BPS / 100).toFixed(2),
  };
}

/**
 * Parse user input amount to bigint
 */
export function parseAmount(amount: string, decimals: number): bigint {
  try {
    return parseUnits(amount, decimals);
  } catch {
    return 0n;
  }
}

/**
 * Format bigint to display string
 */
export function formatAmount(amount: bigint, decimals: number, precision = 6): string {
  const formatted = formatUnits(amount, decimals);
  const num = parseFloat(formatted);
  if (num === 0) return '0';
  if (num < 0.000001) return '<0.000001';
  return num.toLocaleString(undefined, { 
    maximumFractionDigits: precision,
    minimumFractionDigits: 0,
  });
}

/**
 * Action step types for UI state management
 */
export type ActionStep = 
  | 'idle'
  | 'checking'
  | 'fee_approval'
  | 'fee_pending'
  | 'fee_transfer'
  | 'fee_confirming'
  | 'approval'
  | 'approval_pending'
  | 'action'
  | 'action_pending'
  | 'success'
  | 'error';

export interface ActionState {
  step: ActionStep;
  error?: string;
  feeTxHash?: Hash;
  approvalTxHash?: Hash;
  actionTxHash?: Hash;
}

/**
 * Get human-readable step description
 */
export function getStepDescription(step: ActionStep, actionType: string): string {
  switch (step) {
    case 'idle':
      return 'Ready';
    case 'checking':
      return 'Checking balances...';
    case 'fee_approval':
      return 'Approve fee transfer';
    case 'fee_pending':
      return 'Waiting for fee approval...';
    case 'fee_transfer':
      return 'Confirm fee transfer';
    case 'fee_confirming':
      return 'Fee transfer confirming...';
    case 'approval':
      return `Approve ${actionType}`;
    case 'approval_pending':
      return 'Waiting for approval...';
    case 'action':
      return `Confirm ${actionType}`;
    case 'action_pending':
      return 'Transaction pending...';
    case 'success':
      return 'Complete!';
    case 'error':
      return 'Failed';
    default:
      return '';
  }
}

// Export constants for use in hooks
export { MORPHO_BLUE_ADDRESS };
export { erc20Abi };
export { getMorphoBlueForMarket as getMorphoAddress };
