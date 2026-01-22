/**
 * Environment Mode Detection
 * 
 * This file has been deprecated. 
 * The app now always attempts to fetch real Aave V3 data.
 * No preview/demo mode - production behavior only.
 */

// DEPRECATED: Preview mode has been removed
// The app now always fetches real Aave V3 data from subgraphs
export function isPreviewMode(): boolean {
  return false; // Always return false - no preview mode
}

// DEPRECATED: Demo markets removed - never used
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
  isDemo: true;
}

// Empty array - demo markets completely removed
export const DEMO_MARKETS: DemoMarket[] = [];
