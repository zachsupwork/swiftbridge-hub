/**
 * Swap Deep Link Helpers
 * 
 * Build pre-filled swap URLs for collateral/token acquisition flows.
 */

/** Common tokens by chainId for auto-picking best fromToken */
const COMMON_TOKENS: Record<number, { symbol: string; address: string }[]> = {
  1: [
    { symbol: 'ETH', address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' },
    { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
    { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
  ],
};

/** Native token address per chain */
const NATIVE_TOKEN: Record<number, string> = {
  1: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  10: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  137: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  42161: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  8453: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  43114: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
};

export interface SwapDeepLinkParams {
  chainId: number;
  /** Token to swap TO (e.g., needed token for earn) */
  toTokenAddress?: string;
  toTokenSymbol?: string;
  /** Token to swap FROM (portfolio token the user holds) */
  fromTokenAddress?: string;
  fromTokenSymbol?: string;
  /** Destination chain for bridge */
  toChainId?: number;
  marketId?: string;
  ref?: 'earn' | 'portfolio';
  action?: 'supply' | 'borrow' | 'swap' | 'bridge';
}

/**
 * Build a swap URL with pre-filled query params.
 * 
 * For portfolio → swap: use fromTokenAddress (token user holds) as the FROM token.
 * For earn → swap: use toTokenAddress (token user needs) as the TO token.
 */
export function buildSwapLink({
  chainId,
  toTokenAddress,
  toTokenSymbol,
  fromTokenAddress,
  fromTokenSymbol,
  toChainId,
  marketId,
  ref,
  action,
}: SwapDeepLinkParams): string {
  const params = new URLSearchParams();
  params.set('fromChainId', String(chainId));
  params.set('toChainId', String(toChainId ?? chainId));
  if (toTokenAddress) params.set('toToken', toTokenAddress);
  if (toTokenSymbol) params.set('toSymbol', toTokenSymbol);
  if (fromTokenAddress) params.set('fromToken', fromTokenAddress);
  if (fromTokenSymbol) params.set('fromSymbol', fromTokenSymbol);
  if (marketId) params.set('marketId', marketId);
  if (ref) params.set('ref', ref);
  if (action) params.set('action', action);
  return `/?${params.toString()}`;
}

/**
 * Get the default fromToken for a chain (native token).
 */
export function getDefaultFromToken(chainId: number): string {
  return NATIVE_TOKEN[chainId] || '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
}

/**
 * Parse swap deep link params from URL search params.
 */
export function parseSwapDeepLink(search: string): {
  fromChainId?: number;
  toChainId?: number;
  fromToken?: string;
  toToken?: string;
  toSymbol?: string;
  marketId?: string;
  ref?: string;
  action?: string;
} | null {
  const params = new URLSearchParams(search);
  const ref = params.get('ref');
  if (!ref) return null;
  
  return {
    fromChainId: params.get('fromChainId') ? Number(params.get('fromChainId')) : undefined,
    toChainId: params.get('toChainId') ? Number(params.get('toChainId')) : undefined,
    fromToken: params.get('fromToken') || undefined,
    toToken: params.get('toToken') || undefined,
    toSymbol: params.get('toSymbol') || undefined,
    marketId: params.get('marketId') || undefined,
    ref: ref || undefined,
    action: params.get('action') || undefined,
  };
}
