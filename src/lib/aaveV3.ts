/**
 * Aave V3 Contract Addresses and ABIs
 * 
 * This module contains the necessary contract addresses for interacting
 * with Aave V3 across supported chains.
 */

// Aave V3 Pool addresses per chain
// Source: https://docs.aave.com/developers/deployed-contracts/v3-mainnet
export const AAVE_V3_POOL_ADDRESSES: Record<number, `0x${string}`> = {
  // Ethereum Mainnet
  1: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
  // Arbitrum One
  42161: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  // Optimism
  10: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  // Polygon
  137: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  // Base
  8453: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
};

// Supported chain IDs for Earn/Lending
export const EARN_SUPPORTED_CHAINS = [1, 42161, 10, 137, 8453] as const;
export type EarnSupportedChainId = typeof EARN_SUPPORTED_CHAINS[number];

// Check if a chain is supported for Earn
export function isEarnChainSupported(chainId: number): boolean {
  return chainId in AAVE_V3_POOL_ADDRESSES;
}

// Get the Aave V3 Pool address for a chain
export function getAavePoolAddress(chainId: number): `0x${string}` | null {
  return AAVE_V3_POOL_ADDRESSES[chainId] || null;
}

// Chain names for display
export const EARN_CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  42161: 'Arbitrum',
  10: 'Optimism',
  137: 'Polygon',
  8453: 'Base',
};

// Chain logos for UI
export const EARN_CHAIN_LOGOS: Record<number, string> = {
  1: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/ethereum.svg',
  42161: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/arbitrum.svg',
  10: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/optimism.svg',
  137: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/polygon.svg',
  8453: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/base.svg',
};

/**
 * Minimal Aave V3 Pool ABI
 * Only includes the functions we need for supply/withdraw operations
 */
export const AAVE_V3_POOL_ABI = [
  {
    name: 'supply',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
      { name: 'referralCode', type: 'uint16' },
    ],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/**
 * Minimal ERC20 ABI
 * For token approvals, balance checks, and transfers
 */
export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// Aave referral code - set to 0 by default
// TODO: Register for official Aave referral code if available
export const AAVE_REFERRAL_CODE = 0;

/**
 * Aave deep link URL generator
 */
export function getAaveDeepLink(chainId: number, assetAddress?: string): string {
  const chainSlug = getAaveChainSlug(chainId);
  
  if (!chainSlug) {
    return 'https://app.aave.com/';
  }
  
  if (assetAddress) {
    return `https://app.aave.com/reserve-overview/?underlyingAsset=${assetAddress.toLowerCase()}&marketName=proto_${chainSlug}_v3`;
  }
  
  return `https://app.aave.com/?marketName=proto_${chainSlug}_v3`;
}

function getAaveChainSlug(chainId: number): string | null {
  switch (chainId) {
    case 1: return 'mainnet';
    case 42161: return 'arbitrum';
    case 10: return 'optimism';
    case 137: return 'polygon';
    case 8453: return 'base';
    default: return null;
  }
}
