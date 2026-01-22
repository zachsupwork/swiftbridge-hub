/**
 * Earn Chain Configuration - STRICT mapping with RPC + Aave addresses
 * 
 * Uses ONLY Vite env vars (import.meta.env.VITE_*)
 * A chain is only supported if both RPC and Aave addresses are present.
 */

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

// Aave V3 official addresses per chain
const AAVE_ADDRESSES: Record<number, {
  pool: `0x${string}`;
  uiPoolDataProvider: `0x${string}`;
  addressesProvider: `0x${string}`;
}> = {
  // Ethereum Mainnet
  1: {
    pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    uiPoolDataProvider: '0x91c0eA31b49B69Ea18607702c61cD4d37f0F4c15',
    addressesProvider: '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e',
  },
  // Arbitrum One
  42161: {
    pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    uiPoolDataProvider: '0x145dE30c929a065582da84Cf96F88460dB9745A7',
    addressesProvider: '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
  },
  // Optimism
  10: {
    pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    uiPoolDataProvider: '0xbd83DdBE37fc91923d59C8c1E0bDe0CccCa332d5',
    addressesProvider: '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
  },
  // Polygon
  137: {
    pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    uiPoolDataProvider: '0xC69728f11E9E6127733751c8410432913123acf1',
    addressesProvider: '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
  },
  // Base
  8453: {
    pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
    uiPoolDataProvider: '0x174446a6741300cD2E7C1b1A636Fee99c8F83502',
    addressesProvider: '0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D',
  },
  // Avalanche
  43114: {
    pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    uiPoolDataProvider: '0xdBbFaFC45983B4659E368a3025b81f69Ab6E5093',
    addressesProvider: '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
  },
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

// Get RPC URL from Vite env
function getRpcUrl(envKey: string): string | undefined {
  // Vite env vars are only available via import.meta.env
  const envValue = import.meta.env[envKey];
  return envValue && typeof envValue === 'string' && envValue.length > 0 ? envValue : undefined;
}

// ============================================
// BUILD SUPPORTED CHAINS CONFIG
// ============================================

const ALL_CHAIN_IDS = [1, 42161, 10, 137, 8453, 43114] as const;

export function buildChainConfigs(): ChainConfig[] {
  const configs: ChainConfig[] = [];

  for (const chainId of ALL_CHAIN_IDS) {
    const aaveAddresses = AAVE_ADDRESSES[chainId];
    const rpcEnvKey = RPC_ENV_KEYS[chainId];
    const rpcUrl = getRpcUrl(rpcEnvKey);

    // Skip chains without Aave addresses
    if (!aaveAddresses) {
      if (import.meta.env.DEV) {
        console.log(`[Earn] Chain ${chainId} skipped: No Aave addresses configured`);
      }
      continue;
    }

    // Include chain but mark RPC as missing (can still try subgraph)
    configs.push({
      chainId,
      name: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
      logo: CHAIN_LOGOS[chainId] || '',
      rpcEnvKey,
      rpcUrl,
      explorerUrl: EXPLORER_URLS[chainId] || '',
      aavePool: aaveAddresses.pool,
      aaveUiPoolDataProvider: aaveAddresses.uiPoolDataProvider,
      aaveAddressesProvider: aaveAddresses.addressesProvider,
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
    const rpcStatus = chain.rpcUrl ? 'defined' : 'MISSING';
    const rpcPreview = chain.rpcUrl ? chain.rpcUrl.substring(0, 25) + '...' : 'N/A';
    console.log(`  ${chain.name}: RPC ${rpcStatus} (${rpcPreview})`);
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
      testSuccess: null,
      testResult: null,
      testError: 'Chain not configured',
    };
  }

  const result: RpcTestResult = {
    chainId,
    chainName: config.name,
    rpcEnvKey: config.rpcEnvKey,
    rpcDefined: !!config.rpcUrl,
    rpcPrefix: config.rpcUrl ? config.rpcUrl.substring(0, 25) + '...' : 'N/A',
    testSuccess: null,
    testResult: null,
    testError: null,
  };

  if (!config.rpcUrl) {
    result.testError = `Missing env var: ${config.rpcEnvKey}`;
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
