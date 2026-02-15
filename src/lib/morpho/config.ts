/**
 * Morpho Blue Chain Configuration
 * 
 * Defines supported chains and contract addresses.
 * Source: https://docs.morpho.org/get-started/resources/addresses/
 * 
 * Morpho Blue is deployed at the SAME address on all chains:
 * 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb
 */

import type { MorphoChainConfig } from './types';

// Official Morpho Blue contract address (same on all chains)
export const MORPHO_BLUE_ADDRESS = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' as const;

// Morpho API endpoint (no API key required)
export const MORPHO_API_URL = import.meta.env.VITE_MORPHO_API_URL || 'https://blue-api.morpho.org/graphql';

// All Morpho Blue deployments
// Only enable chains that have meaningful market activity
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
  // Uncomment as these chains get meaningful Morpho market activity:
  // {
  //   chainId: 42161,
  //   label: 'Arbitrum',
  //   logo: 'https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg',
  //   enabled: false,
  //   morphoBlue: MORPHO_BLUE_ADDRESS,
  // },
  // {
  //   chainId: 10,
  //   label: 'Optimism',
  //   logo: 'https://icons.llamao.fi/icons/chains/rsz_optimism.jpg',
  //   enabled: false,
  //   morphoBlue: MORPHO_BLUE_ADDRESS,
  // },
  // {
  //   chainId: 59144,
  //   label: 'Linea',
  //   logo: 'https://icons.llamao.fi/icons/chains/rsz_linea.jpg',
  //   enabled: false,
  //   morphoBlue: MORPHO_BLUE_ADDRESS,
  // },
  // {
  //   chainId: 534352,
  //   label: 'Scroll',
  //   logo: 'https://icons.llamao.fi/icons/chains/rsz_scroll.jpg',
  //   enabled: false,
  //   morphoBlue: MORPHO_BLUE_ADDRESS,
  // },
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
};

export function getChainRpcUrl(chainId: number): string | undefined {
  const envVar = RPC_ENV_VARS[chainId];
  if (!envVar) return undefined;
  
  const envVars: Record<string, string | undefined> = {
    VITE_RPC_ETHEREUM: import.meta.env.VITE_RPC_ETHEREUM,
    VITE_RPC_BASE: import.meta.env.VITE_RPC_BASE,
    VITE_RPC_ARBITRUM: import.meta.env.VITE_RPC_ARBITRUM,
    VITE_RPC_OPTIMISM: import.meta.env.VITE_RPC_OPTIMISM,
  };
  
  return envVars[envVar];
}
