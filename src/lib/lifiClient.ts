// LI.FI API Client wrapper
const LIFI_BASE_URL = import.meta.env.VITE_LIFI_BASE_URL || 'https://li.quest';
const INTEGRATOR = import.meta.env.VITE_LIFI_INTEGRATOR || 'cryptodefibridge';
const FEE = parseFloat(import.meta.env.VITE_LIFI_FEE || '0.001');

export interface Chain {
  id: number;
  key: string;
  name: string;
  logoURI: string;
  nativeToken: Token;
}

export interface Token {
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
  name: string;
  logoURI?: string;
  priceUSD?: string;
}

export interface RouteRequest {
  fromChainId: number;
  toChainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  fromAmount: string;
  fromAddress?: string;
  toAddress?: string;
  slippage?: number;
}

export interface FeeCost {
  name: string;
  description?: string;
  percentage?: string;
  token: Token;
  amount: string;
  amountUSD?: string;
}

export interface GasCost {
  type: string;
  estimate: string;
  limit: string;
  amount: string;
  amountUSD?: string;
  price: string;
  token: Token;
}

export interface Step {
  id: string;
  type: string;
  tool: string;
  toolDetails: {
    name: string;
    logoURI: string;
  };
  action: {
    fromChainId: number;
    toChainId: number;
    fromToken: Token;
    toToken: Token;
    fromAmount: string;
    slippage: number;
  };
  estimate: {
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    approvalAddress: string;
    executionDuration: number;
    feeCosts?: FeeCost[];
    gasCosts?: GasCost[];
  };
  transactionRequest?: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    gasPrice: string;
  };
}

export interface Route {
  id: string;
  fromChainId: number;
  toChainId: number;
  fromAmountUSD: string;
  toAmountUSD: string;
  fromAmount: string;
  toAmount: string;
  toAmountMin: string;
  fromToken: Token;
  toToken: Token;
  steps: Step[];
  tags: string[];
  insurance?: {
    state: string;
    feeAmountUsd: string;
  };
}

export interface RoutesResponse {
  routes: Route[];
}

export interface TransactionStatus {
  status: 'NOT_FOUND' | 'PENDING' | 'DONE' | 'FAILED';
  substatus?: string;
  substatusMessage?: string;
  receiving?: {
    txHash: string;
    txLink: string;
    amount: string;
    token: Token;
    chainId: number;
  };
  sending?: {
    txHash: string;
    txLink: string;
    amount: string;
    token: Token;
    chainId: number;
  };
}

export interface TokenAmount extends Token {
  amount: string;
  blockNumber?: number;
}

export interface TokenBalancesResponse {
  [chainId: string]: TokenAmount[];
}

// Popular tokens to show first
const POPULAR_TOKENS: Record<number, string[]> = {
  1: ['ETH', 'USDC', 'USDT', 'DAI', 'WETH', 'WBTC', 'LINK', 'UNI'],
  10: ['ETH', 'USDC', 'USDT', 'DAI', 'WETH', 'OP'],
  137: ['MATIC', 'USDC', 'USDT', 'DAI', 'WETH', 'WBTC'],
  42161: ['ETH', 'USDC', 'USDT', 'DAI', 'WETH', 'ARB'],
  8453: ['ETH', 'USDC', 'DAI', 'WETH'],
  11155111: ['ETH', 'USDC', 'DAI'],
};

// Cache for tokens
const tokenCache: Map<number, Token[]> = new Map();
const chainCache: Chain[] = [];

async function fetchWithTimeout<T>(url: string, options?: RequestInit, timeout = 10000): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    
    clearTimeout(id);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    clearTimeout(id);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('RPC timeout - request took too long');
    }
    throw error;
  }
}

export async function getChains(): Promise<Chain[]> {
  if (chainCache.length > 0) {
    return chainCache;
  }
  
  try {
    const data = await fetchWithTimeout<{ chains: Chain[] }>(
      `${LIFI_BASE_URL}/v1/chains`
    );
    chainCache.push(...data.chains);
    return data.chains;
  } catch (error) {
    console.error('Failed to fetch chains:', error);
    // Return default chains if API fails
    return [
      { id: 1, key: 'eth', name: 'Ethereum', logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/ethereum.svg', nativeToken: { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', decimals: 18, chainId: 1, name: 'Ether' } },
      { id: 10, key: 'opt', name: 'Optimism', logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/optimism.svg', nativeToken: { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', decimals: 18, chainId: 10, name: 'Ether' } },
      { id: 137, key: 'pol', name: 'Polygon', logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/polygon.svg', nativeToken: { address: '0x0000000000000000000000000000000000000000', symbol: 'MATIC', decimals: 18, chainId: 137, name: 'MATIC' } },
      { id: 42161, key: 'arb', name: 'Arbitrum', logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/arbitrum.svg', nativeToken: { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', decimals: 18, chainId: 42161, name: 'Ether' } },
      { id: 8453, key: 'bas', name: 'Base', logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/base.svg', nativeToken: { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', decimals: 18, chainId: 8453, name: 'Ether' } },
      { id: 11155111, key: 'sep', name: 'Sepolia', logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/ethereum.svg', nativeToken: { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', decimals: 18, chainId: 11155111, name: 'Ether' } },
    ];
  }
}

export async function getTokens(chainId: number): Promise<Token[]> {
  if (tokenCache.has(chainId)) {
    return tokenCache.get(chainId)!;
  }
  
  try {
    const data = await fetchWithTimeout<{ tokens: Record<string, Token[]> }>(
      `${LIFI_BASE_URL}/v1/tokens?chains=${chainId}`
    );
    
    const tokens = data.tokens[chainId.toString()] || [];
    
    // Sort by popular tokens first
    const popular = POPULAR_TOKENS[chainId] || [];
    const sortedTokens = tokens.sort((a, b) => {
      const aIndex = popular.indexOf(a.symbol);
      const bIndex = popular.indexOf(b.symbol);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
    
    tokenCache.set(chainId, sortedTokens);
    return sortedTokens;
  } catch (error) {
    console.error('Failed to fetch tokens:', error);
    return [];
  }
}

export async function getRoutes(request: RouteRequest): Promise<RoutesResponse> {
  const body = {
    fromChainId: request.fromChainId,
    toChainId: request.toChainId,
    fromTokenAddress: request.fromTokenAddress,
    toTokenAddress: request.toTokenAddress,
    fromAmount: request.fromAmount,
    fromAddress: request.fromAddress,
    toAddress: request.toAddress || request.fromAddress,
    options: {
      slippage: request.slippage || 0.005,
      integrator: INTEGRATOR,
      fee: FEE,
      order: 'RECOMMENDED',
    },
  };
  
  try {
    const data = await fetchWithTimeout<RoutesResponse>(
      `${LIFI_BASE_URL}/v1/advanced/routes`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      15000
    );
    
    if (!data.routes || data.routes.length === 0) {
      throw new Error('No route found');
    }
    
    return data;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new Error('RPC timeout');
      }
      if (error.message.includes('No route found')) {
        throw error;
      }
    }
    throw new Error('Insufficient liquidity');
  }
}

export async function getStepTransaction(step: Step): Promise<Step> {
  const data = await fetchWithTimeout<Step>(
    `${LIFI_BASE_URL}/v1/advanced/stepTransaction`,
    {
      method: 'POST',
      body: JSON.stringify(step),
    }
  );
  return data;
}

export async function getTransactionStatus(
  txHash: string,
  fromChainId: number,
  toChainId: number,
  tool?: string
): Promise<TransactionStatus> {
  let url = `${LIFI_BASE_URL}/v1/status?txHash=${txHash}&fromChain=${fromChainId}&toChain=${toChainId}`;
  if (tool) {
    url += `&bridge=${encodeURIComponent(tool)}`;
  }
  const data = await fetchWithTimeout<TransactionStatus>(url);
  return data;
}

export async function getTokenBalances(
  walletAddress: string,
  chainIds: number[]
): Promise<TokenBalancesResponse> {
  try {
    const chainsParam = chainIds.join(',');
    const url = `${LIFI_BASE_URL}/v1/token/balances?walletAddress=${walletAddress}&chains=${chainsParam}`;
    
    if (import.meta.env.DEV) {
      console.log('[LiFi Balances] Fetching:', url);
    }
    
    const raw = await fetchWithTimeout<unknown>(url, undefined, 30000);

    if (import.meta.env.DEV) {
      console.log('[LiFi Balances] Raw response type:', typeof raw, Array.isArray(raw) ? 'array' : '', raw);
    }

    const normalized = normalizeBalancesResponse(raw);

    if (import.meta.env.DEV) {
      const totalTokens = Object.values(normalized).reduce((s, arr) => s + arr.length, 0);
      console.log('[LiFi Balances] Normalized:', Object.keys(normalized).length, 'chains,', totalTokens, 'tokens');
    }

    return normalized;
  } catch (error) {
    console.error('Failed to fetch token balances:', error);
    return {};
  }
}

/**
 * Handles all known LI.FI balance response shapes:
 *  1) Already a map: { "1": [...], "137": [...] }
 *  2) Flat array of tokens with chainId: [ { chainId: 1, ... }, ... ]
 *  3) Wrapped: { tokens: [...] }
 */
function normalizeBalancesResponse(raw: unknown): TokenBalancesResponse {
  if (!raw || typeof raw !== 'object') return {};

  // Shape 3: { tokens: [...] }
  if ('tokens' in (raw as Record<string, unknown>)) {
    const inner = (raw as Record<string, unknown>).tokens;
    if (Array.isArray(inner)) {
      return groupTokensByChain(inner);
    }
  }

  // Shape 2: flat array
  if (Array.isArray(raw)) {
    return groupTokensByChain(raw);
  }

  // Shape 1: already a map — validate entries
  const result: TokenBalancesResponse = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const chainId = parseInt(key, 10);
    if (isNaN(chainId) || !Array.isArray(value)) continue;
    const tokens = value.map(coerceToken).filter((t): t is TokenAmount => t !== null);
    if (tokens.length > 0) result[String(chainId)] = tokens;
  }
  return result;
}

function groupTokensByChain(arr: unknown[]): TokenBalancesResponse {
  const result: TokenBalancesResponse = {};
  for (const item of arr) {
    const token = coerceToken(item);
    if (!token) continue;
    const key = String(token.chainId);
    if (!result[key]) result[key] = [];
    result[key].push(token);
  }
  return result;
}

/**
 * Lenient coercion: accepts chainId as string or number,
 * only requires address + symbol to be present.
 */
function coerceToken(v: unknown): TokenAmount | null {
  if (!v || typeof v !== 'object') return null;
  const t = v as Record<string, unknown>;

  // Must have address and symbol at minimum
  if (typeof t.address !== 'string' || typeof t.symbol !== 'string') return null;

  // Coerce chainId from string or number
  let chainId: number;
  if (typeof t.chainId === 'number') {
    chainId = t.chainId;
  } else if (typeof t.chainId === 'string') {
    chainId = parseInt(t.chainId, 10);
  } else {
    return null;
  }
  if (isNaN(chainId)) return null;

  const decimals = typeof t.decimals === 'number' ? t.decimals : parseInt(String(t.decimals || '18'), 10);

  return {
    address: t.address,
    symbol: t.symbol as string,
    decimals: isNaN(decimals) ? 18 : decimals,
    chainId,
    name: (typeof t.name === 'string' ? t.name : t.symbol) as string,
    logoURI: typeof t.logoURI === 'string' ? t.logoURI : undefined,
    priceUSD: typeof t.priceUSD === 'string' ? t.priceUSD : (typeof t.priceUSD === 'number' ? String(t.priceUSD) : undefined),
    amount: typeof t.amount === 'string' ? t.amount : (typeof t.amount === 'number' ? String(t.amount) : '0'),
    blockNumber: typeof t.blockNumber === 'number' ? t.blockNumber : undefined,
  };
}

function isTokenAmount(v: unknown): v is TokenAmount {
  return coerceToken(v) !== null;
}

export function getIntegratorFee(): number {
  return FEE;
}

export function formatFeePercentage(fee: number): string {
  return `${(fee * 100).toFixed(2)}%`;
}

export function calculateIntegratorFeeAmount(amount: string, decimals: number): string {
  const amountBigInt = BigInt(amount);
  const feeAmount = (amountBigInt * BigInt(Math.floor(FEE * 10000))) / BigInt(10000);
  return feeAmount.toString();
}
