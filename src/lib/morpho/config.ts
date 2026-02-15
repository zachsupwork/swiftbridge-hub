/**
 * Morpho Blue Chain Configuration
 * 
 * All chains where Morpho Blue is deployed.
 * Source: https://docs.morpho.org/get-started/resources/addresses/
 * Chain IDs from: https://github.com/morpho-org/morpho-blue-api-metadata
 * 
 * Morpho Blue is deployed at the SAME address on all chains:
 * 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb
 */

import type { MorphoChainConfig } from './types';

// Official Morpho Blue contract address (same on all chains)
export const MORPHO_BLUE_ADDRESS = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' as const;

// Morpho API endpoint (no API key required)
export const MORPHO_API_URL = import.meta.env.VITE_MORPHO_API_URL || 'https://blue-api.morpho.org/graphql';

// All Morpho Blue deployments — matches app.morpho.org chain list
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
    chainId: 137,
    label: 'Polygon',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_polygon.jpg',
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
    label: 'OP Mainnet',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_optimism.jpg',
    enabled: true,
    morphoBlue: MORPHO_BLUE_ADDRESS,
  },
  {
    chainId: 130,
    label: 'Unichain',
    logo: 'https://raw.githubusercontent.com/uniswap/assets/master/blockchains/unichain/info/logo.png',
    enabled: true,
    morphoBlue: MORPHO_BLUE_ADDRESS,
  },
  {
    chainId: 143,
    label: 'Katana',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_ronin.jpg',
    enabled: true,
    morphoBlue: MORPHO_BLUE_ADDRESS,
  },
  {
    chainId: 999,
    label: 'HyperEVM',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_hyperliquid.jpg',
    enabled: true,
    morphoBlue: MORPHO_BLUE_ADDRESS,
  },
  {
    chainId: 747474,
    label: 'Monad',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_monad.jpg',
    enabled: true,
    morphoBlue: MORPHO_BLUE_ADDRESS,
  },
  {
    chainId: 98866,
    label: 'Stable',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_stable.jpg',
    enabled: true,
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
  137: 'VITE_RPC_POLYGON',
  42161: 'VITE_RPC_ARBITRUM',
  10: 'VITE_RPC_OPTIMISM',
  130: 'VITE_RPC_UNICHAIN',
  143: 'VITE_RPC_KATANA',
  999: 'VITE_RPC_HYPEREVM',
  747474: 'VITE_RPC_MONAD',
  98866: 'VITE_RPC_STABLE',
};

export function getChainRpcUrl(chainId: number): string | undefined {
  const envVar = RPC_ENV_VARS[chainId];
  if (!envVar) return undefined;
  
  const envVars: Record<string, string | undefined> = {
    VITE_RPC_ETHEREUM: import.meta.env.VITE_RPC_ETHEREUM,
    VITE_RPC_BASE: import.meta.env.VITE_RPC_BASE,
    VITE_RPC_POLYGON: import.meta.env.VITE_RPC_POLYGON,
    VITE_RPC_ARBITRUM: import.meta.env.VITE_RPC_ARBITRUM,
    VITE_RPC_OPTIMISM: import.meta.env.VITE_RPC_OPTIMISM,
    VITE_RPC_UNICHAIN: import.meta.env.VITE_RPC_UNICHAIN,
    VITE_RPC_KATANA: import.meta.env.VITE_RPC_KATANA,
    VITE_RPC_HYPEREVM: import.meta.env.VITE_RPC_HYPEREVM,
    VITE_RPC_MONAD: import.meta.env.VITE_RPC_MONAD,
    VITE_RPC_STABLE: import.meta.env.VITE_RPC_STABLE,
  };
  
  return envVars[envVar];
}
