/**
 * Environment variable helper supporting both Vite and Next.js prefixes
 * This allows the app to work in both environments
 */

function getEnvVar(viteKey: string, nextKey: string, fallback: string = ''): string {
  // Check Vite env first
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const viteValue = import.meta.env[viteKey];
    if (viteValue) return viteValue;
  }
  
  // Check Next.js public env
  if (typeof process !== 'undefined' && process.env) {
    const nextValue = process.env[nextKey];
    if (nextValue) return nextValue;
  }
  
  return fallback;
}

// Fee configuration - MANDATORY platform fee
export const FEE_WALLET = getEnvVar(
  'VITE_FEE_WALLET', 
  'NEXT_PUBLIC_FEE_WALLET', 
  '' // No default - must be set in env
) as `0x${string}`;

export const FEE_BPS = parseInt(
  getEnvVar('VITE_FEE_BPS', 'NEXT_PUBLIC_FEE_BPS', '10'), 
  10
); // Default 10 bps = 0.10%

// Optional logging endpoint
export const EARN_LOG_ENDPOINT = getEnvVar(
  'VITE_EARN_LOG_ENDPOINT',
  'NEXT_PUBLIC_EARN_LOG_ENDPOINT',
  ''
);

// Helper to check if platform fee is configured
export function isPlatformFeeConfigured(): boolean {
  return FEE_WALLET.length > 0 && FEE_WALLET.startsWith('0x') && FEE_WALLET.length === 42;
}

// Calculate fee percentage for display
export function getFeePercentage(): string {
  return (FEE_BPS / 100).toFixed(2);
}

// Calculate fee and supply amounts
export function calculateFeeAmounts(totalAmount: bigint): { feeAmount: bigint; supplyAmount: bigint } {
  const feeAmount = (totalAmount * BigInt(FEE_BPS)) / 10000n;
  const supplyAmount = totalAmount - feeAmount;
  return { feeAmount, supplyAmount };
}
