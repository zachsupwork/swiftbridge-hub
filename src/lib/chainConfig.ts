/**
 * Earn Chain Configuration - STRICT mapping with RPC + Aave addresses
 * 
 * Uses ONLY Vite env vars (import.meta.env.VITE_*) with fallback public RPCs.
 * A chain is only supported if Aave addresses are present in the address book.
 */

import { getAaveAddresses, type AaveV3Addresses } from './aaveAddressBook';

// ============================================
// CHAIN CONFIGURATION
// ============================================

export interface ChainConfig {
  chainId: number;
  name: string;
  logo: string;
  rpcEnvKey: string;
  rpcUrl: string | undefined;
  explorerUrl: string;
  aavePool: `0x${string}`;
  aaveUiPoolDataProvider: `0x${string}`;
  aaveAddressesProvider: `0x${string}`;
  aaveSubgraph: string;
  aaveMarketName: string;
}

// Fallback public RPCs (when env var not set)
const PUBLIC_RPC_FALLBACKS: Record<number, string[]> = {
  1: [
    'https://ethereum-rpc.publicnode.com',
    'https://eth.drpc.org',
    'https://rpc.ankr.com/eth',
  ],
  42161: [
    'https://arb1.arbitrum.io/rpc',
    'https://arbitrum-one-rpc.publicnode.com',
    'https://arbitrum.drpc.org',
  ],
  10: [
    'https://mainnet.optimism.io',
    'https://optimism-rpc.publicnode.com',
    'https://optimism.drpc.org',
  ],
  137: [
    'https://polygon-rpc.com',
    'https://polygon-bor-rpc.publicnode.com',
    'https://polygon.drpc.org',
  ],
  8453: [
    'https://mainnet.base.org',
    'https://base-rpc.publicnode.com',
    'https://base.drpc.org',
  ],
  43114: [
    'https://api.avax.network/ext/bc/C/rpc',
    'https://avalanche-c-chain-rpc.publicnode.com',
    'https://avax.meowrpc.com',
  ],
};

// Subgraph endpoints
const AAVE_SUBGRAPHS: Record<number, string> = {
  1: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3',
  42161: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-arbitrum',
  10: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-optimism',
  137: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-polygon',
  8453: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-base',
  43114: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-avalanche',
};

// Market names for Aave URLs
const AAVE_MARKET_NAMES: Record<number, string> = {
  1: 'proto_mainnet_v3',
  42161: 'proto_arbitrum_v3',
  10: 'proto_optimism_v3',
  137: 'proto_polygon_v3',
  8453: 'proto_base_v3',
  43114: 'proto_avalanche_v3',
};

// Explorer URLs
const EXPLORER_URLS: Record<number, string> = {
  1: 'https://etherscan.io/tx/',
  42161: 'https://arbiscan.io/tx/',
  10: 'https://optimistic.etherscan.io/tx/',
  137: 'https://polygonscan.com/tx/',
  8453: 'https://basescan.org/tx/',
  43114: 'https://snowtrace.io/tx/',
};

// Chain logos
const CHAIN_LOGOS: Record<number, string> = {
  1: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/ethereum.svg',
  42161: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/arbitrum.svg',
  10: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/optimism.svg',
  137: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/polygon.svg',
  8453: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/base.svg',
  43114: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/avalanche.svg',
};

// Chain names
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  42161: 'Arbitrum',
  10: 'Optimism',
  137: 'Polygon',
  8453: 'Base',
  43114: 'Avalanche',
};

// RPC env key mapping
const RPC_ENV_KEYS: Record<number, string> = {
  1: 'VITE_RPC_ETHEREUM',
  42161: 'VITE_RPC_ARBITRUM',
  10: 'VITE_RPC_OPTIMISM',
  137: 'VITE_RPC_POLYGON',
  8453: 'VITE_RPC_BASE',
  43114: 'VITE_RPC_AVALANCHE',
};

// Get RPC URL from Vite env with fallback to public RPC
function getRpcUrl(envKey: string, chainId: number): string | undefined {
  // First try env var
  const envValue = import.meta.env[envKey];
  if (envValue && typeof envValue === 'string' && envValue.length > 0) {
    return envValue;
  }
  
  // Fallback to public RPC
  const fallbacks = PUBLIC_RPC_FALLBACKS[chainId];
  if (fallbacks && fallbacks.length > 0) {
    return fallbacks[0];
  }
  
  return undefined;
}

// ============================================
// BUILD SUPPORTED CHAINS CONFIG
// ============================================

const ALL_CHAIN_IDS = [1, 42161, 10, 137, 8453, 43114] as const;

export function buildChainConfigs(): ChainConfig[] {
  const configs: ChainConfig[] = [];

  for (const chainId of ALL_CHAIN_IDS) {
    // Get addresses from official address book
    const aaveAddresses = getAaveAddresses(chainId);
    const rpcEnvKey = RPC_ENV_KEYS[chainId];
    const rpcUrl = getRpcUrl(rpcEnvKey, chainId);

    // Skip chains without Aave addresses (should not happen with official book)
    if (!aaveAddresses) {
      if (import.meta.env.DEV) {
        console.log(`[Earn] Chain ${chainId} skipped: No Aave addresses in address book`);
      }
      continue;
    }

    configs.push({
      chainId,
      name: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
      logo: CHAIN_LOGOS[chainId] || '',
      rpcEnvKey,
      rpcUrl,
      explorerUrl: EXPLORER_URLS[chainId] || '',
      aavePool: aaveAddresses.POOL,
      aaveUiPoolDataProvider: aaveAddresses.UI_POOL_DATA_PROVIDER,
      aaveAddressesProvider: aaveAddresses.POOL_ADDRESSES_PROVIDER,
      aaveSubgraph: AAVE_SUBGRAPHS[chainId] || '',
      aaveMarketName: AAVE_MARKET_NAMES[chainId] || '',
    });
  }

  return configs;
}

// Build configs at module load
export const SUPPORTED_CHAINS = buildChainConfigs();
export const SUPPORTED_CHAIN_IDS = SUPPORTED_CHAINS.map(c => c.chainId);

// Dev mode logging
if (import.meta.env.DEV) {
  console.log('[Earn] Chain Configuration:');
  SUPPORTED_CHAINS.forEach(chain => {
    const envValue = import.meta.env[chain.rpcEnvKey];
    const hasEnvVar = envValue && typeof envValue === 'string' && envValue.length > 0;
    const rpcSource = hasEnvVar ? 'env' : 'fallback';
    const rpcPreview = chain.rpcUrl ? chain.rpcUrl.substring(0, 30) + '...' : 'N/A';
    console.log(`  ${chain.name}: RPC (${rpcSource}) ${rpcPreview}`);
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getChainConfig(chainId: number): ChainConfig | undefined {
  return SUPPORTED_CHAINS.find(c => c.chainId === chainId);
}

export function isEarnChainSupported(chainId: number): boolean {
  return SUPPORTED_CHAIN_IDS.includes(chainId);
}

export function getChainRpcUrl(chainId: number): string | undefined {
  return getChainConfig(chainId)?.rpcUrl;
}

export function getAavePoolAddress(chainId: number): `0x${string}` | undefined {
  return getChainConfig(chainId)?.aavePool;
}

export function getExplorerTxUrl(chainId: number, txHash: string): string {
  const config = getChainConfig(chainId);
  return config ? `${config.explorerUrl}${txHash}` : `https://etherscan.io/tx/${txHash}`;
}

// ============================================
// RPC TESTING
// ============================================

export interface RpcTestResult {
  chainId: number;
  chainName: string;
  rpcEnvKey: string;
  rpcDefined: boolean;
  rpcPrefix: string;
  rpcSource: 'env' | 'fallback' | 'none';
  testSuccess: boolean | null;
  testResult: string | null;
  testError: string | null;
}

export async function testRpcEndpoint(chainId: number): Promise<RpcTestResult> {
  const config = getChainConfig(chainId);
  
  if (!config) {
    return {
      chainId,
      chainName: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
      rpcEnvKey: RPC_ENV_KEYS[chainId] || 'UNKNOWN',
      rpcDefined: false,
      rpcPrefix: 'N/A',
      rpcSource: 'none',
      testSuccess: null,
      testResult: null,
      testError: 'Chain not configured',
    };
  }

  const envValue = import.meta.env[config.rpcEnvKey];
  const hasEnvVar = envValue && typeof envValue === 'string' && envValue.length > 0;

  const result: RpcTestResult = {
    chainId,
    chainName: config.name,
    rpcEnvKey: config.rpcEnvKey,
    rpcDefined: !!config.rpcUrl,
    rpcPrefix: config.rpcUrl ? config.rpcUrl.substring(0, 25) + '...' : 'N/A',
    rpcSource: hasEnvVar ? 'env' : (config.rpcUrl ? 'fallback' : 'none'),
    testSuccess: null,
    testResult: null,
    testError: null,
  };

  if (!config.rpcUrl) {
    result.testError = `Missing RPC for ${config.name}`;
    return result;
  }

  try {
    const response = await fetch(config.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_chainId',
        params: [],
      }),
    });

    if (!response.ok) {
      result.testSuccess = false;
      result.testError = `HTTP ${response.status}: ${response.statusText}`;
      return result;
    }

    const data = await response.json();
    
    if (data.error) {
      result.testSuccess = false;
      result.testError = data.error.message || 'RPC error';
      return result;
    }

    const returnedChainId = parseInt(data.result, 16);
    if (returnedChainId !== chainId) {
      result.testSuccess = false;
      result.testError = `Chain ID mismatch: expected ${chainId}, got ${returnedChainId}`;
      return result;
    }

    result.testSuccess = true;
    result.testResult = `Chain ID: ${returnedChainId} ✓`;
    return result;
  } catch (error) {
    result.testSuccess = false;
    result.testError = error instanceof Error ? error.message : 'Unknown error';
    return result;
  }
}

export async function testAllRpcEndpoints(): Promise<RpcTestResult[]> {
  return Promise.all(SUPPORTED_CHAINS.map(c => testRpcEndpoint(c.chainId)));
}
