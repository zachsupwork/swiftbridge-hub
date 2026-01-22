/**
 * Preview Mode Detection
 * 
 * Detects whether the app is running in Lovable Preview (missing RPC env vars)
 * vs Production (Vercel with RPC env vars configured).
 */

import { SUPPORTED_CHAINS } from './chainConfig';

// Check how many RPC env vars are defined
function countDefinedRpcVars(): number {
  return SUPPORTED_CHAINS.filter(c => c.rpcUrl && c.rpcUrl.length > 0).length;
}

// Preview mode = no RPC env vars are defined
export function isPreviewMode(): boolean {
  const definedCount = countDefinedRpcVars();
  const isPreview = definedCount === 0;
  
  if (import.meta.env.DEV) {
    console.log(`[Preview Mode] RPC vars defined: ${definedCount}/${SUPPORTED_CHAINS.length}, isPreview: ${isPreview}`);
  }
  
  return isPreview;
}

// Demo markets for preview mode - clearly labeled as examples
export interface DemoMarket {
  id: string;
  protocol: 'aave';
  chainId: number;
  chainName: string;
  chainLogo: string;
  assetSymbol: string;
  assetName: string;
  assetAddress: `0x${string}`;
  assetLogo: string;
  supplyAPY: number;
  borrowAPY: number;
  isVariable: boolean;
  tvl: number | null;
  availableLiquidity: number | null;
  collateralEnabled: boolean;
  decimals: number;
  marketId: string;
  protocolUrl: string;
  isDemo: true; // Always true for demo markets
}

export const DEMO_MARKETS: DemoMarket[] = [
  {
    id: 'demo-eth',
    protocol: 'aave',
    chainId: 1,
    chainName: 'Ethereum',
    chainLogo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/ethereum.svg',
    assetSymbol: 'ETH',
    assetName: 'Ethereum',
    assetAddress: '0x0000000000000000000000000000000000000000',
    assetLogo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/eth.svg',
    supplyAPY: 1.82, // Example APY
    borrowAPY: 2.45,
    isVariable: true,
    tvl: 1250000000,
    availableLiquidity: 450000000,
    collateralEnabled: true,
    decimals: 18,
    marketId: 'demo-eth',
    protocolUrl: 'https://app.aave.com',
    isDemo: true,
  },
  {
    id: 'demo-usdc',
    protocol: 'aave',
    chainId: 1,
    chainName: 'Ethereum',
    chainLogo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/ethereum.svg',
    assetSymbol: 'USDC',
    assetName: 'USD Coin',
    assetAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    assetLogo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
    supplyAPY: 4.35, // Example APY
    borrowAPY: 5.12,
    isVariable: true,
    tvl: 2100000000,
    availableLiquidity: 850000000,
    collateralEnabled: true,
    decimals: 6,
    marketId: 'demo-usdc',
    protocolUrl: 'https://app.aave.com',
    isDemo: true,
  },
  {
    id: 'demo-weth',
    protocol: 'aave',
    chainId: 42161,
    chainName: 'Arbitrum',
    chainLogo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/arbitrum.svg',
    assetSymbol: 'WETH',
    assetName: 'Wrapped Ether',
    assetAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    assetLogo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg',
    supplyAPY: 2.15, // Example APY
    borrowAPY: 2.89,
    isVariable: true,
    tvl: 680000000,
    availableLiquidity: 220000000,
    collateralEnabled: true,
    decimals: 18,
    marketId: 'demo-weth',
    protocolUrl: 'https://app.aave.com',
    isDemo: true,
  },
  {
    id: 'demo-dai',
    protocol: 'aave',
    chainId: 137,
    chainName: 'Polygon',
    chainLogo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/polygon.svg',
    assetSymbol: 'DAI',
    assetName: 'Dai Stablecoin',
    assetAddress: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    assetLogo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/dai.svg',
    supplyAPY: 3.92, // Example APY
    borrowAPY: 4.68,
    isVariable: true,
    tvl: 320000000,
    availableLiquidity: 125000000,
    collateralEnabled: true,
    decimals: 18,
    marketId: 'demo-dai',
    protocolUrl: 'https://app.aave.com',
    isDemo: true,
  },
];
