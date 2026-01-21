/**
 * Curated list of Aave V3 supported assets
 * 
 * Only Ethereum Mainnet and Sepolia Testnet are supported.
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
    address: '0x6B175474E89094C44Da98b954EescdeCB5f90d4f',
    decimals: 18,
    logo: TOKEN_LOGOS.DAI,
  },
];

/**
 * Sepolia Testnet Markets
 */
const SEPOLIA_MARKETS: AaveMarket[] = [
  {
    chainId: 11155111,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c',
    decimals: 18,
    logo: TOKEN_LOGOS.WETH,
  },
  {
    chainId: 11155111,
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
    decimals: 6,
    logo: TOKEN_LOGOS.USDC,
  },
  {
    chainId: 11155111,
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    address: '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357',
    decimals: 18,
    logo: TOKEN_LOGOS.DAI,
  },
];

/**
 * All markets combined
 */
export const ALL_AAVE_MARKETS: AaveMarket[] = [
  ...MAINNET_MARKETS,
  ...SEPOLIA_MARKETS,
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
