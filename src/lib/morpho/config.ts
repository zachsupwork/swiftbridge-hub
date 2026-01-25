/**
 * Morpho Blue Chain Configuration
 * 
 * Defines supported chains and contract addresses.
 */

import type { MorphoChainConfig } from './types';

// Official Morpho Blue contract addresses
// Source: https://docs.morpho.org/addresses
export const MORPHO_BLUE_ADDRESS = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' as const;

// Morpho API endpoint (no API key required)
export const MORPHO_API_URL = 'https://api.morpho.org/graphql';

// Supported chains with Morpho Blue deployment
export const MORPHO_CHAINS: MorphoChainConfig[] = [
  {
    chainId: 1,
    label: 'Ethereum',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg',
    enabled: true,
    morphoBlue: MORPHO_BLUE_ADDRESS,
  },
  {
    chainId: 8453,
    label: 'Base',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_base.jpg',
    enabled: true,
    morphoBlue: MORPHO_BLUE_ADDRESS,
  },
  {
    chainId: 42161,
    label: 'Arbitrum',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg',
    enabled: true,
    morphoBlue: MORPHO_BLUE_ADDRESS,
  },
  {
    chainId: 10,
    label: 'Optimism',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_optimism.jpg',
    enabled: false, // Not yet deployed
    morphoBlue: MORPHO_BLUE_ADDRESS,
  },
  {
    chainId: 137,
    label: 'Polygon',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_polygon.jpg',
    enabled: false, // Not yet deployed
    morphoBlue: MORPHO_BLUE_ADDRESS,
  },
];

export function getMorphoChainConfig(chainId: number): MorphoChainConfig | undefined {
  return MORPHO_CHAINS.find(c => c.chainId === chainId);
}

export function getEnabledMorphoChains(): MorphoChainConfig[] {
  return MORPHO_CHAINS.filter(c => c.enabled);
}

export function isMorphoSupported(chainId: number): boolean {
  const config = getMorphoChainConfig(chainId);
  return config?.enabled ?? false;
}

export function getAllMorphoChains(): MorphoChainConfig[] {
  return MORPHO_CHAINS;
}

// RPC environment variable mapping
export const RPC_ENV_VARS: Record<number, string> = {
  1: 'VITE_RPC_ETHEREUM',
  8453: 'VITE_RPC_BASE',
  42161: 'VITE_RPC_ARBITRUM',
  10: 'VITE_RPC_OPTIMISM',
  137: 'VITE_RPC_POLYGON',
};

export function getChainRpcUrl(chainId: number): string | undefined {
  const envVar = RPC_ENV_VARS[chainId];
  if (!envVar) return undefined;
  
  // Access env vars dynamically
  const envVars: Record<string, string | undefined> = {
    VITE_RPC_ETHEREUM: import.meta.env.VITE_RPC_ETHEREUM,
    VITE_RPC_BASE: import.meta.env.VITE_RPC_BASE,
    VITE_RPC_ARBITRUM: import.meta.env.VITE_RPC_ARBITRUM,
    VITE_RPC_OPTIMISM: import.meta.env.VITE_RPC_OPTIMISM,
    VITE_RPC_POLYGON: import.meta.env.VITE_RPC_POLYGON,
  };
  
  return envVars[envVar];
}
