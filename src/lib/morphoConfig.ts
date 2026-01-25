/**
 * Morpho Blue Configuration
 * 
 * Uses official Morpho API - no API key required.
 */

export interface MorphoChainConfig {
  chainId: number;
  label: string;
  logo: string;
  enabled: boolean;
  morphoAppUrl: string;
}

// Official Morpho API endpoint (supports all chains)
export const MORPHO_API_URL = 'https://api.morpho.org/graphql';

export const MORPHO_CHAINS: MorphoChainConfig[] = [
  {
    chainId: 8453,
    label: 'Base',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_base.jpg',
    enabled: true,
    morphoAppUrl: 'https://app.morpho.org/?network=base',
  },
  {
    chainId: 1,
    label: 'Ethereum',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg',
    enabled: false,
    morphoAppUrl: 'https://app.morpho.org/?network=mainnet',
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
