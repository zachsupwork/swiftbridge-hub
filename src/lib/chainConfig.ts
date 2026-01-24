/**
 * Earn Chain Configuration - STRICT mapping with RPC + Aave addresses
 * 
 * CRITICAL FIX: Uses DIRECT static access to import.meta.env.VITE_* variables
 * Dynamic access like import.meta.env[key] DOES NOT WORK in Vite production builds!
 * 
 * Each chain is only supported if Aave addresses are present in the address book.
 */

import { getAddress } from 'viem';
import { getAaveAddresses, type AaveV3Addresses } from './aaveAddressBook';

// ============================================
// DIRECT RPC ACCESS - MUST BE STATIC!
// Vite replaces these at build time. Dynamic access fails in production.
// ============================================

const DIRECT_RPC_URLS: Record<number, string | undefined> = {
  1: import.meta.env.VITE_RPC_ETHEREUM,
  42161: import.meta.env.VITE_RPC_ARBITRUM,
  10: import.meta.env.VITE_RPC_OPTIMISM,
  137: import.meta.env.VITE_RPC_POLYGON,
  8453: import.meta.env.VITE_RPC_BASE,
  43114: import.meta.env.VITE_RPC_AVALANCHE,
};

// Validate each is a non-empty string
function getEnvRpc(chainId: number): string | undefined {
  const value = DIRECT_RPC_URLS[chainId];
  if (value && typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

// ============================================
// PUBLIC RPC FALLBACKS (only if env missing)
// ============================================

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

// ============================================
// CHAIN CONFIGURATION
// ============================================

export interface ChainConfig {
  chainId: number;
  name: string;
  logo: string;
  rpcEnvKey: string;
  rpcUrl: string | undefined;
  rpcSource: 'env' | 'fallback' | 'none';
  explorerUrl: string;
  aavePool: `0x${string}`;
  aaveUiPoolDataProvider: `0x${string}`;
  aaveAddressesProvider: `0x${string}`;
  aaveSubgraph: string;
  aaveMarketName: string;
}

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

// RPC env key mapping (for display purposes)
const RPC_ENV_KEYS: Record<number, string> = {
  1: 'VITE_RPC_ETHEREUM',
  42161: 'VITE_RPC_ARBITRUM',
  10: 'VITE_RPC_OPTIMISM',
  137: 'VITE_RPC_POLYGON',
  8453: 'VITE_RPC_BASE',
  43114: 'VITE_RPC_AVALANCHE',
};

// Get RPC URL: prefer env var, fallback to public RPC
function getRpcUrl(chainId: number): { url: string | undefined; source: 'env' | 'fallback' | 'none' } {
  // First try direct env var
  const envValue = getEnvRpc(chainId);
  if (envValue) {
    return { url: envValue, source: 'env' };
  }
  
  // Fallback to public RPC
  const fallbacks = PUBLIC_RPC_FALLBACKS[chainId];
  if (fallbacks && fallbacks.length > 0) {
    return { url: fallbacks[0], source: 'fallback' };
  }
  
  return { url: undefined, source: 'none' };
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
    const { url: rpcUrl, source: rpcSource } = getRpcUrl(chainId);

    // Skip chains without Aave addresses (should not happen with official book)
    if (!aaveAddresses) {
      if (import.meta.env.DEV) {
        console.log(`[Earn] Chain ${chainId} skipped: No Aave addresses in address book`);
      }
      continue;
    }

    // Checksum all addresses using viem
    let checksummedPool: `0x${string}`;
    let checksummedUiProvider: `0x${string}`;
    let checksummedAddressesProvider: `0x${string}`;

    try {
      checksummedPool = getAddress(aaveAddresses.POOL) as `0x${string}`;
      checksummedUiProvider = getAddress(aaveAddresses.UI_POOL_DATA_PROVIDER) as `0x${string}`;
      checksummedAddressesProvider = getAddress(aaveAddresses.POOL_ADDRESSES_PROVIDER) as `0x${string}`;
    } catch (e) {
      console.error(`[Earn] Failed to checksum addresses for chain ${chainId}:`, e);
      continue;
    }

    configs.push({
      chainId,
      name: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
      logo: CHAIN_LOGOS[chainId] || '',
      rpcEnvKey,
      rpcUrl,
      rpcSource,
      explorerUrl: EXPLORER_URLS[chainId] || '',
      aavePool: checksummedPool,
      aaveUiPoolDataProvider: checksummedUiProvider,
      aaveAddressesProvider: checksummedAddressesProvider,
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
  console.log('[Earn] Chain Configuration (DIRECT ENV ACCESS):');
  SUPPORTED_CHAINS.forEach(chain => {
    const rpcPreview = chain.rpcUrl ? chain.rpcUrl.substring(0, 30) + '...' : 'N/A';
    console.log(`  ${chain.name}: RPC (${chain.rpcSource}) ${rpcPreview}`);
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
// RPC HEALTH CHECK
// ============================================

export interface RpcHealthResult {
  chainId: number;
  chainName: string;
  rpcEnvKey: string;
  rpcDefined: boolean;
  rpcPrefix: string;
  rpcSource: 'env' | 'fallback' | 'none';
  testSuccess: boolean | null;
  testResult: string | null;
  testError: string | null;
  httpStatus: number | null;
  latencyMs: number | null;
  errorType: 'none' | 'http' | 'cors' | 'network' | 'timeout' | 'rate_limit' | 'chain_mismatch' | 'unknown';
}

// Mask RPC URL for security (show provider, hide API key)
export function maskRpcUrl(url: string | undefined): string {
  if (!url) return 'NOT SET';
  if (url.length < 25) return url;
  
  // For Alchemy URLs, show the base URL pattern
  if (url.includes('alchemy.com')) {
    const match = url.match(/https:\/\/([^.]+)\.g\.alchemy\.com\/v2\//);
    if (match) {
      return `https://${match[1]}.g.alchemy.com/v2/***`;
    }
  }
  
  // For Infura URLs
  if (url.includes('infura.io')) {
    return url.replace(/\/v3\/[a-f0-9]+$/, '/v3/***');
  }
  
  // Generic masking
  const first = url.substring(0, 20);
  return `${first}...***`;
}

export async function testRpcHealth(chainId: number): Promise<RpcHealthResult> {
  const config = getChainConfig(chainId);
  const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
  const rpcEnvKey = RPC_ENV_KEYS[chainId] || 'UNKNOWN';
  
  if (!config) {
    return {
      chainId,
      chainName,
      rpcEnvKey,
      rpcDefined: false,
      rpcPrefix: 'N/A',
      rpcSource: 'none',
      testSuccess: false,
      testResult: null,
      testError: 'Chain not configured',
      httpStatus: null,
      latencyMs: null,
      errorType: 'unknown',
    };
  }

  const result: RpcHealthResult = {
    chainId,
    chainName: config.name,
    rpcEnvKey: config.rpcEnvKey,
    rpcDefined: !!config.rpcUrl,
    rpcPrefix: maskRpcUrl(config.rpcUrl),
    rpcSource: config.rpcSource,
    testSuccess: null,
    testResult: null,
    testError: null,
    httpStatus: null,
    latencyMs: null,
    errorType: 'none',
  };

  if (!config.rpcUrl) {
    result.testSuccess = false;
    result.testError = `Missing: ${config.rpcEnvKey}`;
    result.errorType = 'network';
    return result;
  }

  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    result.latencyMs = Math.round(performance.now() - startTime);
    result.httpStatus = response.status;

    if (!response.ok) {
      result.testSuccess = false;
      
      if (response.status === 429) {
        result.testError = `Rate limited (HTTP 429)`;
        result.errorType = 'rate_limit';
      } else if (response.status === 403) {
        result.testError = `Access denied (HTTP 403)`;
        result.errorType = 'http';
      } else {
        result.testError = `HTTP ${response.status}: ${response.statusText}`;
        result.errorType = 'http';
      }
      return result;
    }

    const data = await response.json();
    
    if (data.error) {
      result.testSuccess = false;
      result.testError = data.error.message || 'RPC error';
      result.errorType = 'unknown';
      return result;
    }

    const returnedChainId = parseInt(data.result, 16);
    if (returnedChainId !== chainId) {
      result.testSuccess = false;
      result.testError = `Chain ID mismatch: expected ${chainId}, got ${returnedChainId}`;
      result.errorType = 'chain_mismatch';
      return result;
    }

    result.testSuccess = true;
    result.testResult = `Chain ID: ${returnedChainId} (${result.latencyMs}ms)`;
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    result.latencyMs = Math.round(performance.now() - startTime);
    result.testSuccess = false;
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
      result.testError = 'Timeout (10s)';
      result.errorType = 'timeout';
    } else if (errorMessage.includes('CORS') || errorMessage.includes('cross-origin')) {
      result.testError = 'CORS error - blocked by browser';
      result.errorType = 'cors';
    } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
      result.testError = 'Network error - RPC unreachable';
      result.errorType = 'network';
    } else {
      result.testError = errorMessage;
      result.errorType = 'unknown';
    }
    
    return result;
  }
}

export async function testAllRpcHealth(): Promise<RpcHealthResult[]> {
  // Test sequentially to avoid rate limits
  const results: RpcHealthResult[] = [];
  for (const chain of SUPPORTED_CHAINS) {
    const result = await testRpcHealth(chain.chainId);
    results.push(result);
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return results;
}

// Legacy export for backward compatibility
export type RpcTestResult = RpcHealthResult;
export const testRpcEndpoint = testRpcHealth;
