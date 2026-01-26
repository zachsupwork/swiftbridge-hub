/**
 * Swap Preflight Validation
 * 
 * Comprehensive validation before executing a swap to reduce MetaMask failures.
 * Checks: quote freshness, chain match, gas balance, allowances, route validity.
 */

import { type Address, formatUnits, parseUnits } from 'viem';
import { type Route } from '@/lib/lifiClient';

export interface PreflightCheck {
  id: string;
  label: string;
  status: 'pending' | 'checking' | 'passed' | 'failed' | 'warning';
  message?: string;
}

export interface PreflightResult {
  canProceed: boolean;
  checks: PreflightCheck[];
  errors: string[];
  warnings: string[];
}

export interface PreflightOptions {
  route: Route;
  walletChainId: number;
  walletAddress: Address;
  fromTokenBalance: bigint;
  nativeBalance: bigint;
  currentAllowance: bigint;
  quoteTimestamp: number;
  maxQuoteAgeSeconds?: number;
}

const QUOTE_MAX_AGE_SECONDS = 45;
const MIN_GAS_RESERVE_ETH = 0.002; // Minimum native token for gas

/**
 * Validate all preflight conditions before swap execution
 */
export function validatePreflight(options: PreflightOptions): PreflightResult {
  const {
    route,
    walletChainId,
    walletAddress,
    fromTokenBalance,
    nativeBalance,
    currentAllowance,
    quoteTimestamp,
    maxQuoteAgeSeconds = QUOTE_MAX_AGE_SECONDS,
  } = options;

  const checks: PreflightCheck[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Quote freshness check
  const quoteAgeSeconds = (Date.now() - quoteTimestamp) / 1000;
  const isQuoteStale = quoteAgeSeconds > maxQuoteAgeSeconds;
  checks.push({
    id: 'quote_freshness',
    label: 'Quote freshness',
    status: isQuoteStale ? 'failed' : 'passed',
    message: isQuoteStale 
      ? `Quote expired (${Math.floor(quoteAgeSeconds)}s old). Refresh for a new quote.`
      : `Quote valid (${Math.floor(quoteAgeSeconds)}s old)`,
  });
  if (isQuoteStale) {
    errors.push('Quote expired—refresh quote before swapping');
  }

  // 2. Chain match check
  const fromChainId = route.fromChainId;
  const isChainMatch = walletChainId === fromChainId;
  checks.push({
    id: 'chain_match',
    label: 'Network match',
    status: isChainMatch ? 'passed' : 'failed',
    message: isChainMatch 
      ? `Wallet on correct chain (${fromChainId})`
      : `Wrong network. Switch from ${walletChainId} to ${fromChainId}`,
  });
  if (!isChainMatch) {
    errors.push(`Wrong network—switch to chain ${fromChainId}`);
  }

  // 3. Token balance check
  const fromAmountBigInt = BigInt(route.fromAmount);
  const hasEnoughTokens = fromTokenBalance >= fromAmountBigInt;
  const fromToken = route.fromToken;
  checks.push({
    id: 'token_balance',
    label: 'Token balance',
    status: hasEnoughTokens ? 'passed' : 'failed',
    message: hasEnoughTokens 
      ? `Sufficient ${fromToken.symbol} balance`
      : `Insufficient ${fromToken.symbol}. Need ${formatUnits(fromAmountBigInt, fromToken.decimals)}, have ${formatUnits(fromTokenBalance, fromToken.decimals)}`,
  });
  if (!hasEnoughTokens) {
    errors.push(`Insufficient ${fromToken.symbol} balance`);
  }

  // 4. Gas balance check (only for non-native tokens or to ensure gas reserve)
  const isNativeToken = fromToken.address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
                        fromToken.address.toLowerCase() === '0x0000000000000000000000000000000000000000';
  
  let requiredNative = 0n;
  if (isNativeToken) {
    // For native token swaps, we need the swap amount + gas
    requiredNative = fromAmountBigInt + parseUnits(MIN_GAS_RESERVE_ETH.toString(), 18);
  } else {
    // For ERC-20 swaps, we just need gas
    requiredNative = parseUnits(MIN_GAS_RESERVE_ETH.toString(), 18);
  }
  
  const hasEnoughGas = nativeBalance >= requiredNative;
  checks.push({
    id: 'gas_balance',
    label: 'Gas balance',
    status: hasEnoughGas ? 'passed' : 'failed',
    message: hasEnoughGas 
      ? 'Sufficient gas for transaction'
      : `Insufficient gas. Need at least ${MIN_GAS_RESERVE_ETH} native token for fees`,
  });
  if (!hasEnoughGas) {
    errors.push('Insufficient native token for gas fees');
  }

  // 5. Allowance check (for ERC-20 tokens only)
  if (!isNativeToken) {
    const hasEnoughAllowance = currentAllowance >= fromAmountBigInt;
    checks.push({
      id: 'allowance',
      label: 'Token approval',
      status: hasEnoughAllowance ? 'passed' : 'warning',
      message: hasEnoughAllowance 
        ? 'Token approval sufficient'
        : `Approval required for ${fromToken.symbol}`,
    });
    if (!hasEnoughAllowance) {
      warnings.push(`Token approval needed before swap`);
    }
  }

  // 6. Route validity check
  const hasValidRoute = route.steps && route.steps.length > 0;
  checks.push({
    id: 'route_valid',
    label: 'Route availability',
    status: hasValidRoute ? 'passed' : 'failed',
    message: hasValidRoute 
      ? `Route found with ${route.steps.length} step(s)`
      : 'No valid route found',
  });
  if (!hasValidRoute) {
    errors.push('No valid route available');
  }

  // 7. Liquidity check
  const hasLiquidity = route.toAmount && BigInt(route.toAmount) > 0n;
  checks.push({
    id: 'liquidity',
    label: 'Liquidity available',
    status: hasLiquidity ? 'passed' : 'failed',
    message: hasLiquidity 
      ? 'Sufficient liquidity for swap'
      : 'Insufficient liquidity—try smaller amount or different pair',
  });
  if (!hasLiquidity) {
    errors.push('Insufficient liquidity for this trade');
  }

  return {
    canProceed: errors.length === 0,
    checks,
    errors,
    warnings,
  };
}

/**
 * Format time remaining until quote expires
 */
export function getQuoteTimeRemaining(quoteTimestamp: number, maxAgeSeconds: number = QUOTE_MAX_AGE_SECONDS): string {
  const ageSeconds = (Date.now() - quoteTimestamp) / 1000;
  const remaining = Math.max(0, maxAgeSeconds - ageSeconds);
  
  if (remaining <= 0) return 'Expired';
  if (remaining < 10) return `${Math.ceil(remaining)}s`;
  return `${Math.floor(remaining)}s`;
}

/**
 * Check if quote needs refresh
 */
export function isQuoteExpired(quoteTimestamp: number, maxAgeSeconds: number = QUOTE_MAX_AGE_SECONDS): boolean {
  const ageSeconds = (Date.now() - quoteTimestamp) / 1000;
  return ageSeconds > maxAgeSeconds;
}

/**
 * Get human-readable error suggestions
 */
export function getErrorSuggestions(errors: string[]): string[] {
  const suggestions: string[] = [];
  
  for (const error of errors) {
    if (error.includes('Quote expired')) {
      suggestions.push('Click "Get Quote" to refresh with current prices');
    }
    if (error.includes('Wrong network')) {
      suggestions.push('Your wallet will prompt you to switch networks');
    }
    if (error.includes('Insufficient') && error.includes('balance')) {
      suggestions.push('Try a smaller amount or add more tokens');
    }
    if (error.includes('gas')) {
      suggestions.push('Add native tokens (ETH, MATIC, etc.) for gas fees');
    }
    if (error.includes('liquidity')) {
      suggestions.push('Try a smaller amount, higher slippage, or different token pair');
    }
  }
  
  return [...new Set(suggestions)]; // Remove duplicates
}
