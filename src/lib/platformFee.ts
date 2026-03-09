/**
 * Platform Fee Configuration & Helpers
 * 
 * Fee: 0.05% (5 basis points) on all Aave actions.
 * Treasury receives fee via a separate ERC-20 transfer transaction.
 */

import { formatUnits } from 'viem';

// Treasury address from env, with hardcoded fallback
export const FEE_TREASURY = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FEE_TREASURY) ||
  '0xE73F5ECEB9c7f239897bE55c5361eA8f9d2D89d1'
) as `0x${string}`;

/** Fee in basis points: 5 bps = 0.05% */
export const PLATFORM_FEE_BPS = 5;

/** Human-readable fee percentage */
export const PLATFORM_FEE_PERCENT = '0.05';

/** Calculate fee amount from a bigint transaction amount */
export function calcPlatformFee(amount: bigint): bigint {
  return (amount * BigInt(PLATFORM_FEE_BPS)) / 10000n;
}

/** Format fee for display: returns { feeAmount, feeFormatted, feeUsd } */
export function formatFeeDisplay(
  amount: bigint,
  decimals: number,
  priceUsd?: number,
): { feeAmount: bigint; feeFormatted: string; feeUsd: string } {
  const feeAmount = calcPlatformFee(amount);
  const feeFormatted = formatUnits(feeAmount, decimals);
  const feeUsd = priceUsd
    ? `$${(parseFloat(feeFormatted) * priceUsd).toFixed(4)}`
    : '';
  return { feeAmount, feeFormatted, feeUsd };
}

/** Check if treasury is configured */
export function isTreasuryConfigured(): boolean {
  return FEE_TREASURY.length === 42 && FEE_TREASURY.startsWith('0x');
}
