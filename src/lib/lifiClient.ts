// LI.FI API Client wrapper
const LIFI_BASE_URL = import.meta.env.VITE_LIFI_BASE_URL || 'https://li.quest';
const INTEGRATOR = import.meta.env.VITE_LIFI_INTEGRATOR || 'Lovable';

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
  
  // Only set Content-Type for POST/PUT to avoid CORS preflight on GET
  const method = (options?.method || 'GET').toUpperCase();
  const defaultHeaders: Record<string, string> = method === 'GET' || method === 'HEAD'
    ? { 'Accept': 'application/json' }
    : { 'Content-Type': 'application/json' };

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...defaultHeaders,
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
  1: [ // Ethereum — top 25
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18, name: 'Dai' },
    { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', decimals: 8, name: 'Wrapped BTC' },
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', symbol: 'LINK', decimals: 18, name: 'Chainlink' },
    { address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', symbol: 'AAVE', decimals: 18, name: 'Aave' },
    { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI', decimals: 18, name: 'Uniswap' },
    { address: '0xc00e94Cb662C3520282E6f5717214004A7f26888', symbol: 'COMP', decimals: 18, name: 'Compound' },
    { address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', symbol: 'MKR', decimals: 18, name: 'Maker' },
    { address: '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F', symbol: 'SNX', decimals: 18, name: 'Synthetix' },
    { address: '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e', symbol: 'YFI', decimals: 18, name: 'yearn.finance' },
    { address: '0xD533a949740bb3306d119CC777fa900bA034cd52', symbol: 'CRV', decimals: 18, name: 'Curve DAO' },
    { address: '0xba100000625a3754423978a60c9317c58a424e3D', symbol: 'BAL', decimals: 18, name: 'Balancer' },
    { address: '0x4d224452801ACEd8B2F0aebE155379bb5D594381', symbol: 'APE', decimals: 18, name: 'ApeCoin' },
    { address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', symbol: 'SHIB', decimals: 18, name: 'Shiba Inu' },
    { address: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32', symbol: 'LDO', decimals: 18, name: 'Lido DAO' },
    { address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', symbol: 'stETH', decimals: 18, name: 'Lido Staked ETH' },
    { address: '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704', symbol: 'cbETH', decimals: 18, name: 'Coinbase Wrapped Staked ETH' },
    { address: '0xae78736Cd615f374D3085123A210448E74Fc6393', symbol: 'rETH', decimals: 18, name: 'Rocket Pool ETH' },
    { address: '0x111111111117dC0aa78b770fA6A738034120C302', symbol: '1INCH', decimals: 18, name: '1inch' },
    { address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', symbol: 'PEPE', decimals: 18, name: 'Pepe' },
    { address: '0x163f8C2467924be0ae7B5347228CABF260318753', symbol: 'WLD', decimals: 18, name: 'Worldcoin' },
    { address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', symbol: 'MATIC', decimals: 18, name: 'Polygon (Matic)' },
  ],
  137: [ // Polygon — top 20
    { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
    { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC.e', decimals: 6, name: 'Bridged USDC' },
    { address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', symbol: 'WBTC', decimals: 8, name: 'Wrapped BTC' },
    { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', symbol: 'DAI', decimals: 18, name: 'Dai' },
    { address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', symbol: 'WPOL', decimals: 18, name: 'Wrapped POL' },
    { address: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B', symbol: 'AAVE', decimals: 18, name: 'Aave' },
    { address: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39', symbol: 'LINK', decimals: 18, name: 'Chainlink' },
    { address: '0xb33EaAd8d922B1083446DC23f610c2567fB5180f', symbol: 'UNI', decimals: 18, name: 'Uniswap' },
    { address: '0x172370d5Cd63279eFa6d502DAB29171933a610AF', symbol: 'CRV', decimals: 18, name: 'Curve DAO' },
    { address: '0x9a71012B13CA4d3D0Cdc72A177DF3ef03b0E76A3', symbol: 'BAL', decimals: 18, name: 'Balancer' },
    { address: '0x50B728D8D964fd00C2d0AAD81718b71311feF68a', symbol: 'SNX', decimals: 18, name: 'Synthetix' },
    { address: '0x6f8a06447Ff6FcF75d803135a7de15CE88C1d4ec', symbol: 'SHIB', decimals: 18, name: 'Shiba Inu' },
    { address: '0xE111178A87A3BFf0c8d18DECBa5798827539Ae99', symbol: 'EURS', decimals: 2, name: 'STASIS EURO' },
    { address: '0xa3Fa99A148fA48D14Ed51d610c367C61876997F1', symbol: 'miMATIC', decimals: 18, name: 'MAI' },
  ],
  42161: [ // Arbitrum — top 18
    { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
    { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', symbol: 'USDC.e', decimals: 6, name: 'Bridged USDC' },
    { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', symbol: 'WBTC', decimals: 8, name: 'Wrapped BTC' },
    { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', decimals: 18, name: 'Dai' },
    { address: '0x912CE59144191C1204E64559FE8253a0e49E6548', symbol: 'ARB', decimals: 18, name: 'Arbitrum' },
    { address: '0xba5DdD1f9d7F570dc94a51479a000E3BCE967196', symbol: 'AAVE', decimals: 18, name: 'Aave' },
    { address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', symbol: 'LINK', decimals: 18, name: 'Chainlink' },
    { address: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0', symbol: 'UNI', decimals: 18, name: 'Uniswap' },
    { address: '0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978', symbol: 'CRV', decimals: 18, name: 'Curve DAO' },
    { address: '0x040d1EdC9569d4Bab2D15287Dc5A4F10F56a56B8', symbol: 'BAL', decimals: 18, name: 'Balancer' },
    { address: '0x3E6648C5a70A150A88bCE65F4aD4d506Fe15d2AF', symbol: 'SPELL', decimals: 18, name: 'Spell Token' },
    { address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', symbol: 'GMX', decimals: 18, name: 'GMX' },
    { address: '0x5979D7b546E38E9aB8950fce0075BcACE80C2774', symbol: 'wstETH', decimals: 18, name: 'Wrapped stETH' },
    { address: '0xEC70Dcb4A1EFa46b8F2D97C310C9c4790ba5ffA8', symbol: 'rETH', decimals: 18, name: 'Rocket Pool ETH' },
  ],
  8453: [ // Base — top 15
    { address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI', decimals: 18, name: 'Dai' },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    { address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', symbol: 'cbETH', decimals: 18, name: 'Coinbase Wrapped Staked ETH' },
    { address: '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452', symbol: 'wstETH', decimals: 18, name: 'Wrapped stETH' },
    { address: '0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c', symbol: 'rETH', decimals: 18, name: 'Rocket Pool ETH' },
    { address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', symbol: 'AERO', decimals: 18, name: 'Aerodrome' },
    { address: '0x236aa50979D5f3De3Bd1Eeb40E81137F22ab794b', symbol: 'tBTC', decimals: 8, name: 'tBTC v2' },
    { address: '0x548f93779fBC992010C07467cBaf329DD5F059B7', symbol: 'BRETT', decimals: 18, name: 'Brett' },
    { address: '0x532f27101965dd16442E59d40670FaF5eBB142E4', symbol: 'WELL', decimals: 18, name: 'Moonwell' },
    { address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', symbol: 'USDbC', decimals: 6, name: 'USD Base Coin' },
    { address: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c', symbol: 'LINK', decimals: 18, name: 'Chainlink' },
    { address: '0x3bB4445D30AC020a84c1b5A8A2C6248ebC9779D0', symbol: 'AAVE', decimals: 18, name: 'Aave' },
  ],
  10: [ // Optimism — top 15
    { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
    { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', symbol: 'USDC.e', decimals: 6, name: 'Bridged USDC' },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', decimals: 18, name: 'Dai' },
    { address: '0x4200000000000000000000000000000000000042', symbol: 'OP', decimals: 18, name: 'Optimism' },
    { address: '0x76FB31fb4af56892A25e32cFC43De717950c9278', symbol: 'AAVE', decimals: 18, name: 'Aave' },
    { address: '0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6', symbol: 'LINK', decimals: 18, name: 'Chainlink' },
    { address: '0x6fd9d7AD17242c41f7131d257212c54A0e816691', symbol: 'UNI', decimals: 18, name: 'Uniswap' },
    { address: '0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb', symbol: 'wstETH', decimals: 18, name: 'Wrapped stETH' },
    { address: '0x9Bcef72be871e61ED4fBbc7630889beE758eb81D', symbol: 'rETH', decimals: 18, name: 'Rocket Pool ETH' },
    { address: '0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4', symbol: 'SNX', decimals: 18, name: 'Synthetix' },
    { address: '0x68f180fcCe6836688e9084f035309E29Bf0A2095', symbol: 'WBTC', decimals: 8, name: 'Wrapped BTC' },
  ],
  56: [ // BSC — top 15
    { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', decimals: 18, name: 'Tether USD' },
    { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', decimals: 18, name: 'USD Coin' },
    { address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', symbol: 'ETH', decimals: 18, name: 'Ethereum' },
    { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', symbol: 'WBNB', decimals: 18, name: 'Wrapped BNB' },
    { address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', symbol: 'BTCB', decimals: 18, name: 'Bitcoin BEP2' },
    { address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', symbol: 'DAI', decimals: 18, name: 'Dai' },
    { address: '0xfb6115445Bff7b52FeB98650C87f44907E58f802', symbol: 'AAVE', decimals: 18, name: 'Aave' },
    { address: '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD', symbol: 'LINK', decimals: 18, name: 'Chainlink' },
    { address: '0xBf5140A22578168FD562DCcF235E5D43A02ce9B1', symbol: 'UNI', decimals: 18, name: 'Uniswap' },
    { address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', symbol: 'CAKE', decimals: 18, name: 'PancakeSwap' },
    { address: '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE', symbol: 'XRP', decimals: 18, name: 'XRP Token' },
    { address: '0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47', symbol: 'ADA', decimals: 18, name: 'Cardano' },
    { address: '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402', symbol: 'DOT', decimals: 18, name: 'Polkadot' },
  ],
  43114: [ // Avalanche — top 12
    { address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
    { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB', symbol: 'WETH.e', decimals: 18, name: 'Wrapped Ether' },
    { address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', symbol: 'WAVAX', decimals: 18, name: 'Wrapped AVAX' },
    { address: '0x63a72806098Bd3D9520cC43356dD78afe5D386D9', symbol: 'AAVE.e', decimals: 18, name: 'Aave' },
    { address: '0x5947BB275c521040051D82396192181b413227A3', symbol: 'LINK.e', decimals: 18, name: 'Chainlink' },
    { address: '0x50b7545627a5162F82A992c33b87aDc75187B218', symbol: 'WBTC.e', decimals: 8, name: 'Wrapped BTC' },
    { address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70', symbol: 'DAI.e', decimals: 18, name: 'Dai' },
    { address: '0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE', symbol: 'sAVAX', decimals: 18, name: 'Staked AVAX' },
    { address: '0x152b9d0FdC40C096DE345963aE19DB304Aa1FcB9', symbol: 'BTC.b', decimals: 8, name: 'Bitcoin' },
  ],
};

/**
 * Canonical token addresses per chain for major tokens.
 * Used to prevent symbol collisions (e.g., multiple "USDC" variants).
 * When looking up a balance by symbol, prefer canonical address.
 */
export const CANONICAL_TOKENS: Record<number, Record<string, string>> = {
  1: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  },
  137: {
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  },
  42161: {
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    WBTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
  8453: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    WETH: '0x4200000000000000000000000000000000000006',
  },
  10: {
    USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    WETH: '0x4200000000000000000000000000000000000006',
    WBTC: '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
  },
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

// RPC URLs per chain — multiple endpoints for failover
const CHAIN_RPC_LIST: Record<number, string[]> = {
  1: ['https://eth.llamarpc.com', 'https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org', 'https://rpc.ankr.com/eth'],
  10: ['https://mainnet.optimism.io', 'https://optimism-rpc.publicnode.com', 'https://optimism.drpc.org'],
  137: ['https://polygon-bor-rpc.publicnode.com', 'https://polygon.drpc.org', 'https://rpc.ankr.com/polygon', 'https://polygon-rpc.com'],
  42161: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one-rpc.publicnode.com', 'https://arbitrum.drpc.org'],
  8453: ['https://mainnet.base.org', 'https://base-rpc.publicnode.com', 'https://base.drpc.org'],
  56: ['https://bsc-dataseed1.binance.org', 'https://bsc-dataseed2.binance.org', 'https://bsc-rpc.publicnode.com'],
  43114: ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche-c-chain-rpc.publicnode.com', 'https://avax.meowrpc.com'],
  250: ['https://rpc.ftm.tools', 'https://fantom-rpc.publicnode.com'],
  100: ['https://rpc.gnosischain.com', 'https://gnosis-rpc.publicnode.com'],
  42220: ['https://forno.celo.org', 'https://celo-rpc.publicnode.com'],
  1284: ['https://rpc.api.moonbeam.network'],
  324: ['https://mainnet.era.zksync.io', 'https://zksync-era-rpc.publicnode.com'],
  59144: ['https://rpc.linea.build', 'https://linea-rpc.publicnode.com'],
  534352: ['https://rpc.scroll.io', 'https://scroll-rpc.publicnode.com'],
  5000: ['https://rpc.mantle.xyz', 'https://mantle-rpc.publicnode.com'],
};

// Legacy compat — first RPC per chain
const CHAIN_RPCS: Record<number, string> = Object.fromEntries(
  Object.entries(CHAIN_RPC_LIST).map(([k, v]) => [k, v[0]])
);

// ─── Token discovery cache (localStorage) ────────────────────────
const DISCOVERED_TOKENS_KEY = 'cdb_discovered_tokens';

interface DiscoveredToken {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

function loadDiscoveredTokens(chainId: number): DiscoveredToken[] {
  try {
    const raw = localStorage.getItem(DISCOVERED_TOKENS_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as Record<string, DiscoveredToken[]>;
    return all[String(chainId)] || [];
  } catch { return []; }
}

function saveDiscoveredTokens(chainId: number, tokens: DiscoveredToken[]): void {
  try {
    const raw = localStorage.getItem(DISCOVERED_TOKENS_KEY);
    const all = raw ? JSON.parse(raw) as Record<string, DiscoveredToken[]> : {};
    // Merge with existing, dedup by address
    const existing = all[String(chainId)] || [];
    const merged = new Map<string, DiscoveredToken>();
    for (const t of [...existing, ...tokens]) {
      merged.set(t.address.toLowerCase(), t);
    }
    all[String(chainId)] = Array.from(merged.values());
    localStorage.setItem(DISCOVERED_TOKENS_KEY, JSON.stringify(all));
  } catch { /* localStorage full or unavailable */ }
}

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
    const response = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
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

  // Step 2: On-chain fallback via JSON-RPC calls with RPC failover
  if (isDev) console.debug('[LiFi Balances] Using on-chain RPC fallback with multi-endpoint failover');
  lastFetchMethod = 'on-chain-rpc';

  // Fetch token prices + discover additional token addresses from LI.FI token list
  let tokenPrices: Record<string, string> = {};
  const lifiDiscoveredTokens: Record<number, KnownToken[]> = {};
  try {
    const priceChains = chainIds.slice(0, 10).join(',');
    const priceData = await fetchWithTimeout<Record<string, unknown>>(
      `${LIFI_BASE_URL}/v1/tokens?chains=${priceChains}`,
      undefined,
      12000
    );
    const tokensMap = (priceData as any)?.tokens || priceData;
    if (tokensMap && typeof tokensMap === 'object') {
      for (const [cid, tokens] of Object.entries(tokensMap)) {
        const chainIdNum = parseInt(cid, 10);
        if (isNaN(chainIdNum) || !Array.isArray(tokens)) continue;
        const knownSet = new Set((KNOWN_TOKENS[chainIdNum] || []).map(t => t.address.toLowerCase()));
        const discovered: KnownToken[] = [];
        for (const t of tokens) {
          if (t?.address && t?.priceUSD) {
            tokenPrices[`${cid}:${t.address.toLowerCase()}`] = String(t.priceUSD);
          }
          // Collect tokens not already in KNOWN_TOKENS for discovery
          if (t?.address && t?.symbol && !knownSet.has(t.address.toLowerCase())) {
            discovered.push({
              address: t.address,
              symbol: t.symbol,
              decimals: typeof t.decimals === 'number' ? t.decimals : 18,
              name: t.name || t.symbol,
            });
          }
        }
        if (discovered.length > 0) {
          lifiDiscoveredTokens[chainIdNum] = discovered;
        }
      }
    }
    if (isDev) console.debug('[LiFi Balances] Loaded prices for', Object.keys(tokenPrices).length, 'tokens, discovered extra tokens for', Object.keys(lifiDiscoveredTokens).length, 'chains');
  } catch (e) {
    if (isDev) console.warn('[LiFi Balances] Price/discovery fetch failed, using known tokens only');
  }

  // Fetch balances on-chain per chain (batched 3 at a time)
  const result: TokenBalancesResponse = {};
  const batchSize = 3;

  for (let i = 0; i < chainIds.length; i += batchSize) {
    const batch = chainIds.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((chainId) => fetchChainBalancesOnChain(walletAddress, chainId, tokenPrices, lifiDiscoveredTokens[chainId]))
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
 * Fetch native + ERC20 balances for one chain with RPC failover + token discovery.
 * Tries multiple RPC endpoints. Also checks LI.FI-discovered tokens + localStorage cached tokens.
 */
async function fetchChainBalancesOnChain(
  walletAddress: string,
  chainId: number,
  tokenPrices: Record<string, string>,
  extraDiscoveredTokens?: KnownToken[]
): Promise<TokenAmount[]> {
  const rpcList = CHAIN_RPC_LIST[chainId];
  if (!rpcList || rpcList.length === 0) return [];

  const nativeMeta = NATIVE_TOKEN_META[chainId] || { symbol: 'ETH', name: 'Native', decimals: 18 };
  
  // Merge: known tokens + localStorage discovered + LI.FI discovered (dedup by address)
  const knownTokens = KNOWN_TOKENS[chainId] || [];
  const cachedDiscovered = loadDiscoveredTokens(chainId);
  const allExtra = [...cachedDiscovered, ...(extraDiscoveredTokens || [])];
  
  const seenAddresses = new Set(knownTokens.map(t => t.address.toLowerCase()));
  const discoveryTokens: KnownToken[] = [];
  for (const t of allExtra) {
    const addr = t.address.toLowerCase();
    if (!seenAddresses.has(addr)) {
      seenAddresses.add(addr);
      discoveryTokens.push(t);
    }
  }

  const allTokensToCheck = [...knownTokens, ...discoveryTokens];
  const balanceOfData = '0x70a08231000000000000000000000000' + walletAddress.slice(2).toLowerCase();

  // RPC call with failover across multiple endpoints
  async function rpcCallWithFailover(method: string, params: unknown[]): Promise<string | null> {
    for (const rpc of rpcList) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const resp = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) {
          if (resp.status === 429) {
            // Rate limited — try next RPC
            if (import.meta.env.DEV) console.warn(`[RPC Failover] ${chainId} rate limited on ${new URL(rpc).hostname}, trying next`);
            continue;
          }
          continue;
        }
        const json = await resp.json();
        if (json?.error) continue;
        const result = json?.result;
        if (typeof result === 'string') return result === '0x' || result === '0x0' ? null : result;
        return null;
      } catch {
        // Network error — try next
        continue;
      }
    }
    return null; // All RPCs failed
  }

  const tokens: TokenAmount[] = [];

  // Fire all balance checks in parallel (native + all ERC20s)
  const allCalls = [
    rpcCallWithFailover('eth_getBalance', [walletAddress, 'latest']),
    ...allTokensToCheck.map((tk) =>
      rpcCallWithFailover('eth_call', [{ to: tk.address, data: balanceOfData }, 'latest'])
    ),
  ];

  const results = await Promise.allSettled(allCalls);

  // Native balance (index 0)
  const nativeResult = results[0];
  if (nativeResult.status === 'fulfilled' && nativeResult.value) {
    try {
      const amount = BigInt(nativeResult.value);
      if (amount > 0n) {
        const nativePrice = tokenPrices[`${chainId}:0x0000000000000000000000000000000000000000`]
          || tokenPrices[`${chainId}:0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`]
          || '';
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
    } catch { /* skip */ }
  }

  // ERC20 balances
  const newlyDiscovered: DiscoveredToken[] = [];
  for (let i = 0; i < allTokensToCheck.length; i++) {
    const r = results[i + 1];
    if (r.status !== 'fulfilled' || !r.value) continue;
    try {
      const amount = BigInt(r.value);
      if (amount > 0n) {
        const tk = allTokensToCheck[i];
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
        // If this was a discovered token (not in KNOWN_TOKENS), cache it
        if (i >= knownTokens.length) {
          newlyDiscovered.push({ address: tk.address, symbol: tk.symbol, decimals: tk.decimals, name: tk.name });
        }
      }
    } catch { /* skip invalid hex */ }
  }

  // Persist newly discovered tokens to localStorage for faster future loads
  if (newlyDiscovered.length > 0) {
    saveDiscoveredTokens(chainId, newlyDiscovered);
    if (import.meta.env.DEV) {
      console.debug(`[Token Discovery] Chain ${chainId}: cached ${newlyDiscovered.length} new tokens:`, newlyDiscovered.map(t => t.symbol));
    }
  }

  if (import.meta.env.DEV) {
    console.debug(`[LiFi Balances] Chain ${chainId}: found ${tokens.length} token(s) (checked ${allTokensToCheck.length} ERC20s + native)`, tokens.map(t => `${t.symbol}=${t.amount}`));
    if (tokens.length === 0) {
      console.warn(`[LiFi Balances] Chain ${chainId}: 0 tokens. RPCs tried: ${rpcList.map(r => new URL(r).hostname).join(', ')}`);
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
// Fees are now managed by LI.FI portal via the integrator string.
// These helpers remain for display purposes only.

export function getIntegratorFee(): number {
  return 0; // Fee is portal-managed, not calculated client-side
}

export function formatFeePercentage(fee: number): string {
  if (fee === 0) return 'Portal-managed';
  return `${(fee * 100).toFixed(2)}%`;
}

export function calculateIntegratorFeeAmount(amount: string, decimals: number): string {
  return '0'; // Fee is portal-managed
}
