/**
 * Transaction Safety Policy
 * 
 * Reduces MetaMask "deceptive request" warnings by:
 * 1. Using exact approval amounts (never infinite)
 * 2. Validating routes use official LI.FI router contracts
 * 3. Providing contract verification metadata for UI display
 */

// Official LI.FI Diamond contract addresses per chain
// Source: https://docs.li.fi/smart-contracts/deployments
const LIFI_DIAMOND_ADDRESSES: Record<number, string[]> = {
  1:     ['0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'], // Ethereum
  10:    ['0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'], // Optimism
  137:   ['0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'], // Polygon
  42161: ['0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'], // Arbitrum
  8453:  ['0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'], // Base
  43114: ['0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'], // Avalanche
  56:    ['0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'], // BSC
  250:   ['0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'], // Fantom
  100:   ['0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'], // Gnosis
  324:   ['0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'], // zkSync
  59144: ['0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'], // Linea
  534352:['0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'], // Scroll
  5000:  ['0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'], // Mantle
};

// Trusted bridge/DEX tool names from LI.FI
const TRUSTED_TOOLS = new Set([
  'stargate', 'stargatev2', 'hop', 'across', 'cbridge', 'multichain',
  'connext', 'allbridge', 'satellite', 'circle', 'cctp', 'axelar',
  'layerzero', 'wormhole', 'debridge', 'symbiosis',
  // Top-tier DEXes
  'uniswap', 'uniswapV3', 'sushiswap', 'curve', '1inch', 'paraswap',
  'odos', '0x', 'openocean', 'kyberswap', 'balancer', 'dodo',
  'camelot', 'pancakeswap', 'velodrome', 'aerodrome', 'traderjoe',
  // LI.FI aggregation
  'lifi', 'lifuel',
]);

export interface RouteVerification {
  isTrusted: boolean;
  routerAddress: string;
  routerLabel: string;
  toolNames: string[];
  warnings: string[];
}

/**
 * Verify that a route only uses trusted contracts and bridges/DEXes.
 */
export function verifyRoute(route: {
  steps: Array<{
    tool: string;
    toolDetails?: { name: string };
    estimate: { approvalAddress?: string };
    action: { fromChainId: number; toChainId: number };
    transactionRequest?: { to?: string };
  }>;
}): RouteVerification {
  const warnings: string[] = [];
  const toolNames: string[] = [];
  let routerAddress = '';
  let routerLabel = 'LI.FI Diamond';

  for (const step of route.steps) {
    const tool = step.tool.toLowerCase();
    toolNames.push(step.toolDetails?.name || step.tool);

    // Check if tool is in trusted set
    if (!TRUSTED_TOOLS.has(tool)) {
      warnings.push(`Tool "${step.toolDetails?.name || step.tool}" is not in the verified list`);
    }

    // Check approval address against known LI.FI diamond
    const approvalAddr = step.estimate.approvalAddress?.toLowerCase();
    if (approvalAddr) {
      routerAddress = approvalAddr;
      const chainId = step.action.fromChainId;
      const knownAddrs = LIFI_DIAMOND_ADDRESSES[chainId]?.map(a => a.toLowerCase()) || [];
      if (knownAddrs.length > 0 && !knownAddrs.includes(approvalAddr)) {
        warnings.push(`Approval address ${approvalAddr.slice(0, 10)}... is not the known LI.FI Diamond for chain ${chainId}`);
      }
    }

    // Check transaction target
    const txTo = step.transactionRequest?.to?.toLowerCase();
    if (txTo) {
      routerAddress = txTo;
      const chainId = step.action.fromChainId;
      const knownAddrs = LIFI_DIAMOND_ADDRESSES[chainId]?.map(a => a.toLowerCase()) || [];
      if (knownAddrs.length > 0 && !knownAddrs.includes(txTo)) {
        warnings.push(`Transaction target ${txTo.slice(0, 10)}... differs from known LI.FI Diamond`);
      }
    }
  }

  return {
    isTrusted: warnings.length === 0,
    routerAddress,
    routerLabel,
    toolNames,
    warnings,
  };
}

/**
 * Get the exact approval amount (with small buffer for gas/slippage).
 * Never use infinite approval.
 */
export function getExactApprovalAmount(requiredAmount: bigint): bigint {
  // Add 0.1% buffer to handle minor rounding differences
  return requiredAmount + (requiredAmount / 1000n);
}

/**
 * Format contract address for display
 */
export function formatContractLabel(address: string, chainId: number): string {
  const lifi = LIFI_DIAMOND_ADDRESSES[chainId]?.map(a => a.toLowerCase()) || [];
  if (lifi.includes(address.toLowerCase())) {
    return 'LI.FI Diamond (Verified ✓)';
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Check if an address is a known LI.FI contract
 */
export function isKnownLiFiContract(address: string, chainId: number): boolean {
  const known = LIFI_DIAMOND_ADDRESSES[chainId]?.map(a => a.toLowerCase()) || [];
  return known.includes(address.toLowerCase());
}
