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

// ─── Token Balances (on-chain via viem multicall) ────────────────

// ERC20 balanceOf ABI fragment
const ERC20_BALANCE_OF_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// Curated top tokens per chain (address, symbol, decimals, name, logoURI)
// These are the most commonly held tokens that users expect to see
interface KnownToken {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  logoURI?: string;
}

const KNOWN_TOKENS: Record<number, KnownToken[]> = {
  1: [ // Ethereum
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18, name: 'Dai' },
    { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', decimals: 8, name: 'Wrapped BTC' },
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', symbol: 'LINK', decimals: 18, name: 'Chainlink' },
  ],
  137: [ // Polygon
    { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
    { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC.e', decimals: 6, name: 'Bridged USDC' },
    { address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', symbol: 'WBTC', decimals: 8, name: 'Wrapped BTC' },
    { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', symbol: 'DAI', decimals: 18, name: 'Dai' },
    { address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', symbol: 'WPOL', decimals: 18, name: 'Wrapped POL' },
  ],
  42161: [ // Arbitrum
    { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
    { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', symbol: 'USDC.e', decimals: 6, name: 'Bridged USDC' },
    { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', symbol: 'WBTC', decimals: 8, name: 'Wrapped BTC' },
    { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', decimals: 18, name: 'Dai' },
    { address: '0x912CE59144191C1204E64559FE8253a0e49E6548', symbol: 'ARB', decimals: 18, name: 'Arbitrum' },
  ],
  8453: [ // Base
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI', decimals: 18, name: 'Dai' },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
  ],
  10: [ // Optimism
    { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
    { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', symbol: 'USDC.e', decimals: 6, name: 'Bridged USDC' },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', decimals: 18, name: 'Dai' },
    { address: '0x4200000000000000000000000000000000000042', symbol: 'OP', decimals: 18, name: 'Optimism' },
  ],
  56: [ // BSC
    { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', decimals: 18, name: 'Tether USD' },
    { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', decimals: 18, name: 'USD Coin' },
    { address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', symbol: 'ETH', decimals: 18, name: 'Ethereum' },
    { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', symbol: 'WBNB', decimals: 18, name: 'Wrapped BNB' },
    { address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', symbol: 'BTCB', decimals: 18, name: 'Bitcoin BEP2' },
  ],
  43114: [ // Avalanche
    { address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
    { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB', symbol: 'WETH.e', decimals: 18, name: 'Wrapped Ether' },
    { address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', symbol: 'WAVAX', decimals: 18, name: 'Wrapped AVAX' },
  ],
};

// Native token metadata per chain
const NATIVE_TOKEN_META: Record<number, { symbol: string; name: string; decimals: number; logoURI?: string }> = {
  1: { symbol: 'ETH', name: 'Ether', decimals: 18 },
  10: { symbol: 'ETH', name: 'Ether', decimals: 18 },
  137: { symbol: 'POL', name: 'POL', decimals: 18 },
  42161: { symbol: 'ETH', name: 'Ether', decimals: 18 },
  8453: { symbol: 'ETH', name: 'Ether', decimals: 18 },
  56: { symbol: 'BNB', name: 'BNB', decimals: 18 },
  43114: { symbol: 'AVAX', name: 'Avalanche', decimals: 18 },
  250: { symbol: 'FTM', name: 'Fantom', decimals: 18 },
  100: { symbol: 'xDAI', name: 'xDAI', decimals: 18 },
  42220: { symbol: 'CELO', name: 'Celo', decimals: 18 },
  1284: { symbol: 'GLMR', name: 'Moonbeam', decimals: 18 },
  324: { symbol: 'ETH', name: 'Ether', decimals: 18 },
  59144: { symbol: 'ETH', name: 'Ether', decimals: 18 },
  534352: { symbol: 'ETH', name: 'Ether', decimals: 18 },
  5000: { symbol: 'MNT', name: 'Mantle', decimals: 18 },
};

// RPC URLs per chain (reuse from wagmiConfig or fallback publics)
const CHAIN_RPCS: Record<number, string> = {
  1: 'https://eth.llamarpc.com',
  10: 'https://mainnet.optimism.io',
  137: 'https://polygon-rpc.com',
  42161: 'https://arb1.arbitrum.io/rpc',
  8453: 'https://mainnet.base.org',
  56: 'https://bsc-dataseed1.binance.org',
  43114: 'https://api.avax.network/ext/bc/C/rpc',
  250: 'https://rpc.ftm.tools',
  100: 'https://rpc.gnosischain.com',
  42220: 'https://forno.celo.org',
  1284: 'https://rpc.api.moonbeam.network',
  324: 'https://mainnet.era.zksync.io',
  59144: 'https://rpc.linea.build',
  534352: 'https://rpc.scroll.io',
  5000: 'https://rpc.mantle.xyz',
};

// Track the fetch method used for debugging
export let lastFetchMethod = '';
export let lastFetchDebug: { url?: string; status?: number; error?: string; rawSample?: string } = {};

/**
 * Fetch token balances for a wallet across multiple chains.
 * Strategy:
 * 1. Try LI.FI REST endpoint first (may work for some users)
 * 2. If empty/error, fall back to on-chain multicall via viem
 */
export async function getTokenBalances(
  walletAddress: string,
  chainIds: number[]
): Promise<TokenBalancesResponse> {
  const isDev = import.meta.env.DEV;

  // Step 1: Try LI.FI REST endpoint
  try {
    const chainsParam = chainIds.join(',');
    const url = `${LIFI_BASE_URL}/v1/token/balances?walletAddress=${walletAddress}&chains=${chainsParam}`;

    if (isDev) console.debug('[LiFi Balances] Trying REST:', url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { signal: controller.signal, headers: { 'Content-Type': 'application/json' } });
    clearTimeout(timeout);

    lastFetchDebug = { url, status: response.status };

    if (response.ok) {
      const raw = await response.json();
      lastFetchDebug.rawSample = JSON.stringify(raw).slice(0, 500);
      const normalized = normalizeBalancesResponse(raw);
      const totalTokens = Object.values(normalized).reduce((s, arr) => s + arr.length, 0);

      if (totalTokens > 0) {
        lastFetchMethod = 'lifi-rest';
        if (isDev) console.debug('[LiFi Balances] REST succeeded:', totalTokens, 'tokens');
        return normalized;
      }
      if (isDev) console.debug('[LiFi Balances] REST returned 0 tokens, falling back to on-chain');
    } else {
      if (isDev) console.warn('[LiFi Balances] REST failed:', response.status);
      lastFetchDebug.error = `HTTP ${response.status}`;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isDev) console.warn('[LiFi Balances] REST error:', msg);
    lastFetchDebug.error = msg;
  }

  // Step 2: On-chain fallback via JSON-RPC batch calls
  if (isDev) console.debug('[LiFi Balances] Using on-chain multicall fallback');
  lastFetchMethod = 'on-chain-rpc';

  // Fetch token prices from LI.FI /v1/tokens for price data
  let tokenPrices: Record<string, string> = {}; // key: `${chainId}:${address.toLowerCase()}`
  try {
    const priceChains = chainIds.slice(0, 8).join(','); // limit to avoid huge response
    const priceData = await fetchWithTimeout<Record<string, unknown>>(
      `${LIFI_BASE_URL}/v1/tokens?chains=${priceChains}`,
      undefined,
      10000
    );
    // Response shape: { tokens: { "137": [...tokens], "1": [...tokens] } } or { "137": [...], ... }
    const tokensMap = (priceData as any)?.tokens || priceData;
    if (tokensMap && typeof tokensMap === 'object') {
      for (const [cid, tokens] of Object.entries(tokensMap)) {
        if (Array.isArray(tokens)) {
          for (const t of tokens) {
            if (t?.address && t?.priceUSD) {
              tokenPrices[`${cid}:${t.address.toLowerCase()}`] = String(t.priceUSD);
            }
          }
        }
      }
    }
    if (isDev) console.debug('[LiFi Balances] Loaded prices for', Object.keys(tokenPrices).length, 'tokens');
  } catch (e) {
    if (isDev) console.warn('[LiFi Balances] Price fetch failed, USD values will be missing');
  }

  // Fetch balances on-chain per chain (batched 3 at a time)
  const result: TokenBalancesResponse = {};
  const batchSize = 3;

  for (let i = 0; i < chainIds.length; i += batchSize) {
    const batch = chainIds.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((chainId) => fetchChainBalancesOnChain(walletAddress, chainId, tokenPrices))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      if (r.status === 'fulfilled' && r.value.length > 0) {
        result[String(batch[j])] = r.value;
      }
    }
  }

  if (isDev) {
    const total = Object.values(result).reduce((s, a) => s + a.length, 0);
    console.debug('[LiFi Balances] On-chain result:', Object.keys(result).length, 'chains,', total, 'tokens');
  }

  return result;
}

/**
 * Fetch native + ERC20 balances for one chain using JSON-RPC eth_call / eth_getBalance.
 */
async function fetchChainBalancesOnChain(
  walletAddress: string,
  chainId: number,
  tokenPrices: Record<string, string>
): Promise<TokenAmount[]> {
  const rpc = CHAIN_RPCS[chainId];
  if (!rpc) return [];

  const nativeMeta = NATIVE_TOKEN_META[chainId] || { symbol: 'ETH', name: 'Native', decimals: 18 };
  const knownTokens = KNOWN_TOKENS[chainId] || [];
  const tokens: TokenAmount[] = [];

  // Build batch JSON-RPC request
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls: any[] = [];

  // Call 0: native balance
  calls.push({
    jsonrpc: '2.0' as any,
    method: 'eth_getBalance',
    params: [walletAddress, 'latest'],
    id: 0,
  });

  // Calls 1..N: ERC20 balanceOf via eth_call
  const balanceOfData = '0x70a08231000000000000000000000000' + walletAddress.slice(2).toLowerCase();
  for (let i = 0; i < knownTokens.length; i++) {
    calls.push({
      jsonrpc: '2.0' as any,
      method: 'eth_call',
      params: [{ to: knownTokens[i].address, data: balanceOfData }, 'latest'],
      id: i + 1,
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(calls),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) return [];

    const results: { id: number; result?: string; error?: unknown }[] = await resp.json();
    if (!Array.isArray(results)) return [];

    // Index results by id
    const byId: Record<number, string> = {};
    for (const r of results) {
      if (r.result && typeof r.result === 'string' && r.result !== '0x' && r.result !== '0x0') {
        byId[r.id] = r.result;
      }
    }

    // Native balance
    if (byId[0]) {
      const rawBal = byId[0];
      const amount = BigInt(rawBal);
      if (amount > 0n) {
        const nativePrice = tokenPrices[`${chainId}:0x0000000000000000000000000000000000000000`] || '';
        tokens.push({
          address: '0x0000000000000000000000000000000000000000',
          symbol: nativeMeta.symbol,
          decimals: nativeMeta.decimals,
          chainId,
          name: nativeMeta.name,
          logoURI: nativeMeta.logoURI,
          priceUSD: nativePrice || undefined,
          amount: amount.toString(),
        });
      }
    }

    // ERC20 balances
    for (let i = 0; i < knownTokens.length; i++) {
      const hex = byId[i + 1];
      if (!hex) continue;
      try {
        const amount = BigInt(hex);
        if (amount > 0n) {
          const tk = knownTokens[i];
          const priceKey = `${chainId}:${tk.address.toLowerCase()}`;
          tokens.push({
            address: tk.address,
            symbol: tk.symbol,
            decimals: tk.decimals,
            chainId,
            name: tk.name,
            logoURI: tk.logoURI,
            priceUSD: tokenPrices[priceKey] || undefined,
            amount: amount.toString(),
          });
        }
      } catch { /* skip invalid hex */ }
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn(`[LiFi Balances] On-chain fetch failed for chain ${chainId}:`, e);
    }
  }

  return tokens;
}

/** Per-chain LI.FI REST fallback (kept for completeness) */
async function getTokenBalancesPerChain(
  walletAddress: string,
  chainIds: number[]
): Promise<TokenBalancesResponse> {
  const merged: TokenBalancesResponse = {};
  const batchSize = 3;
  for (let i = 0; i < chainIds.length; i += batchSize) {
    const batch = chainIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (chainId) => {
        const url = `${LIFI_BASE_URL}/v1/token/balances?walletAddress=${walletAddress}&chains=${chainId}`;
        const raw = await fetchWithTimeout<unknown>(url, undefined, 15000);
        return { chainId, raw };
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        const norm = normalizeBalancesResponse(r.value.raw);
        for (const [k, v] of Object.entries(norm)) {
          if (!merged[k]) merged[k] = [];
          merged[k].push(...v);
        }
      }
    }
  }
  return merged;
}

/**
 * Handles ALL known LI.FI balance response shapes (kept for REST path).
 */
function normalizeBalancesResponse(raw: unknown): TokenBalancesResponse {
  if (!raw || typeof raw !== 'object') return {};

  const obj = raw as Record<string, unknown>;

  if ('tokens' in obj && Array.isArray(obj.tokens)) return groupTokensByChain(obj.tokens);

  if ('balances' in obj && obj.balances != null) {
    const balances = obj.balances;
    if (Array.isArray(balances)) return groupTokensByChain(balances);
    if (typeof balances === 'object') {
      const result: TokenBalancesResponse = {};
      for (const [key, value] of Object.entries(balances as Record<string, unknown>)) {
        const chainId = parseInt(key, 10);
        if (isNaN(chainId)) continue;
        if (Array.isArray(value)) {
          const tokens = value.map(coerceToken).filter((t): t is TokenAmount => t !== null);
          if (tokens.length > 0) result[String(chainId)] = tokens;
        } else if (typeof value === 'object' && value !== null) {
          const tokens = Object.values(value as Record<string, unknown>).map(coerceToken).filter((t): t is TokenAmount => t !== null);
          if (tokens.length > 0) result[String(chainId)] = tokens;
        }
      }
      return result;
    }
  }

  if (Array.isArray(raw)) return groupTokensByChain(raw);

  const result: TokenBalancesResponse = {};
  for (const [key, value] of Object.entries(obj)) {
    const chainId = parseInt(key, 10);
    if (isNaN(chainId)) continue;
    if (Array.isArray(value)) {
      const tokens = value.map(coerceToken).filter((t): t is TokenAmount => t !== null);
      if (tokens.length > 0) result[String(chainId)] = tokens;
    }
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

function coerceToken(v: unknown): TokenAmount | null {
  if (!v || typeof v !== 'object') return null;
  const t = v as Record<string, unknown>;
  if (typeof t.address !== 'string' || typeof t.symbol !== 'string') return null;

  let chainId: number;
  if (typeof t.chainId === 'number') chainId = t.chainId;
  else if (typeof t.chainId === 'string') chainId = parseInt(t.chainId, 10);
  else return null;
  if (isNaN(chainId)) return null;

  let decimals = typeof t.decimals === 'number' ? t.decimals : (typeof t.decimals === 'string' ? parseInt(t.decimals, 10) : NaN);
  if (isNaN(decimals) || decimals < 0) decimals = 18;

  let priceUSD: string | undefined;
  if (typeof t.priceUSD === 'string' && t.priceUSD !== '') priceUSD = t.priceUSD;
  else if (typeof t.priceUSD === 'number') priceUSD = String(t.priceUSD);

  return {
    address: t.address,
    symbol: t.symbol as string,
    decimals,
    chainId,
    name: (typeof t.name === 'string' ? t.name : t.symbol) as string,
    logoURI: typeof t.logoURI === 'string' ? t.logoURI : undefined,
    priceUSD,
    amount: typeof t.amount === 'string' ? t.amount : (typeof t.amount === 'number' ? String(t.amount) : '0'),
    blockNumber: typeof t.blockNumber === 'number' ? t.blockNumber : undefined,
  };
}

// ─── Fee helpers ─────────────────────────────────────────────

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
