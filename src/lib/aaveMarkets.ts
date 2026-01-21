/**
 * Curated list of Aave V3 supported assets
 * 
 * Multi-chain support for Ethereum, Arbitrum, Optimism, Polygon, Base, Avalanche
 */

export interface AaveMarket {
  chainId: number;
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  logo: string;
  isNative?: boolean;
}

// Token logo URLs
const TOKEN_LOGOS: Record<string, string> = {
  ETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/eth.svg',
  WETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg',
  USDC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  USDT: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdt.svg',
  DAI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/dai.svg',
  WBTC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg',
  WMATIC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/matic.svg',
  WAVAX: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/avax.svg',
};

/**
 * Ethereum Mainnet Markets
 */
const MAINNET_MARKETS: AaveMarket[] = [
  {
    chainId: 1,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals: 18,
    logo: TOKEN_LOGOS.WETH,
  },
  {
    chainId: 1,
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    logo: TOKEN_LOGOS.USDC,
  },
  {
    chainId: 1,
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    logo: TOKEN_LOGOS.USDT,
  },
  {
    chainId: 1,
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    address: '0x6B175474E89094C44Da98b954EescdecB5f90d4f',
    decimals: 18,
    logo: TOKEN_LOGOS.DAI,
  },
  {
    chainId: 1,
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8,
    logo: TOKEN_LOGOS.WBTC,
  },
];

/**
 * Arbitrum Markets
 */
const ARBITRUM_MARKETS: AaveMarket[] = [
  {
    chainId: 42161,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    decimals: 18,
    logo: TOKEN_LOGOS.WETH,
  },
  {
    chainId: 42161,
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    decimals: 6,
    logo: TOKEN_LOGOS.USDC,
  },
  {
    chainId: 42161,
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    decimals: 6,
    logo: TOKEN_LOGOS.USDT,
  },
  {
    chainId: 42161,
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    decimals: 18,
    logo: TOKEN_LOGOS.DAI,
  },
];

/**
 * Optimism Markets
 */
const OPTIMISM_MARKETS: AaveMarket[] = [
  {
    chainId: 10,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x4200000000000000000000000000000000000006',
    decimals: 18,
    logo: TOKEN_LOGOS.WETH,
  },
  {
    chainId: 10,
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    decimals: 6,
    logo: TOKEN_LOGOS.USDC,
  },
  {
    chainId: 10,
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    decimals: 6,
    logo: TOKEN_LOGOS.USDT,
  },
  {
    chainId: 10,
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    decimals: 18,
    logo: TOKEN_LOGOS.DAI,
  },
];

/**
 * Polygon Markets
 */
const POLYGON_MARKETS: AaveMarket[] = [
  {
    chainId: 137,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    decimals: 18,
    logo: TOKEN_LOGOS.WETH,
  },
  {
    chainId: 137,
    symbol: 'WMATIC',
    name: 'Wrapped Matic',
    address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    decimals: 18,
    logo: TOKEN_LOGOS.WMATIC,
  },
  {
    chainId: 137,
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    decimals: 6,
    logo: TOKEN_LOGOS.USDC,
  },
  {
    chainId: 137,
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    decimals: 6,
    logo: TOKEN_LOGOS.USDT,
  },
  {
    chainId: 137,
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    decimals: 18,
    logo: TOKEN_LOGOS.DAI,
  },
];

/**
 * Base Markets
 */
const BASE_MARKETS: AaveMarket[] = [
  {
    chainId: 8453,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x4200000000000000000000000000000000000006',
    decimals: 18,
    logo: TOKEN_LOGOS.WETH,
  },
  {
    chainId: 8453,
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    logo: TOKEN_LOGOS.USDC,
  },
];

/**
 * Avalanche Markets
 */
const AVALANCHE_MARKETS: AaveMarket[] = [
  {
    chainId: 43114,
    symbol: 'WAVAX',
    name: 'Wrapped AVAX',
    address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    decimals: 18,
    logo: TOKEN_LOGOS.WAVAX,
  },
  {
    chainId: 43114,
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    decimals: 6,
    logo: TOKEN_LOGOS.USDC,
  },
  {
    chainId: 43114,
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    decimals: 6,
    logo: TOKEN_LOGOS.USDT,
  },
  {
    chainId: 43114,
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70',
    decimals: 18,
    logo: TOKEN_LOGOS.DAI,
  },
];

/**
 * All markets combined
 */
export const ALL_AAVE_MARKETS: AaveMarket[] = [
  ...MAINNET_MARKETS,
  ...ARBITRUM_MARKETS,
  ...OPTIMISM_MARKETS,
  ...POLYGON_MARKETS,
  ...BASE_MARKETS,
  ...AVALANCHE_MARKETS,
];

/**
 * Get markets for a specific chain
 */
export function getMarketsForChain(chainId: number): AaveMarket[] {
  return ALL_AAVE_MARKETS.filter(m => m.chainId === chainId);
}

/**
 * Get a specific market by chain and symbol
 */
export function getMarket(chainId: number, symbol: string): AaveMarket | undefined {
  return ALL_AAVE_MARKETS.find(
    m => m.chainId === chainId && m.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

/**
 * Get a specific market by chain and address
 */
export function getMarketByAddress(chainId: number, address: string): AaveMarket | undefined {
  return ALL_AAVE_MARKETS.find(
    m => m.chainId === chainId && m.address.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Get unique chain IDs with markets
 */
export function getAvailableChainIds(): number[] {
  return [...new Set(ALL_AAVE_MARKETS.map(m => m.chainId))];
}
