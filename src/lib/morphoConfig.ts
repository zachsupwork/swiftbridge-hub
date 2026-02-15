/**
 * Morpho Blue Configuration (legacy re-export)
 * 
 * This file re-exports from the canonical config at src/lib/morpho/config.ts.
 * Kept for backward compatibility with files importing from this path.
 */

export {
  MORPHO_API_URL,
  MORPHO_CHAINS,
  getMorphoChainConfig,
  getEnabledMorphoChains,
  isMorphoSupported,
} from './morpho/config';

export type { MorphoChainConfig } from './morpho/types';
