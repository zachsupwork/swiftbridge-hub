/**
 * Curated list of top Aave V3 markets
 * 
 * This is a static, curated list to ensure stability.
 * For v1, we focus on the most liquid and widely-used assets.
 */

export interface AaveMarket {
  chainId: number;
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  logo: string;
}

// Token logo URLs
const TOKEN_LOGOS: Record<string, string> = {
  USDC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  USDT: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdt.svg',
  DAI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/dai.svg',
  WETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg',
  WBTC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg',
  USDbC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  'USDC.e': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
};

/**
 * Ethereum Mainnet Markets
 */
const MAINNET_MARKETS: AaveMarket[] = [
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
    address: '0x6B175474E89094C44Da98b954EescdeCB5f90d4f',
    decimals: 18,
    logo: TOKEN_LOGOS.DAI,
  },
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
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    decimals: 6,
    logo: TOKEN_LOGOS.USDC,
  },
  {
    chainId: 42161,
    symbol: 'USDC.e',
    name: 'Bridged USDC',
    address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    decimals: 6,
    logo: TOKEN_LOGOS['USDC.e'],
  },
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
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    decimals: 6,
    logo: TOKEN_LOGOS.USDT,
  },
];

/**
 * Optimism Markets
 */
const OPTIMISM_MARKETS: AaveMarket[] = [
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
    symbol: 'USDC.e',
    name: 'Bridged USDC',
    address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    decimals: 6,
    logo: TOKEN_LOGOS['USDC.e'],
  },
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
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    decimals: 6,
    logo: TOKEN_LOGOS.USDT,
  },
];

/**
 * Polygon Markets
 */
const POLYGON_MARKETS: AaveMarket[] = [
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
    symbol: 'USDC.e',
    name: 'Bridged USDC',
    address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    decimals: 6,
    logo: TOKEN_LOGOS['USDC.e'],
  },
  {
    chainId: 137,
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    decimals: 18,
    logo: TOKEN_LOGOS.DAI,
  },
  {
    chainId: 137,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    decimals: 18,
    logo: TOKEN_LOGOS.WETH,
  },
];

/**
 * Base Markets
 */
const BASE_MARKETS: AaveMarket[] = [
  {
    chainId: 8453,
    symbol: 'USDbC',
    name: 'USD Base Coin',
    address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    decimals: 6,
    logo: TOKEN_LOGOS.USDbC,
  },
  {
    chainId: 8453,
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    logo: TOKEN_LOGOS.USDC,
  },
  {
    chainId: 8453,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x4200000000000000000000000000000000000006',
    decimals: 18,
    logo: TOKEN_LOGOS.WETH,
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
