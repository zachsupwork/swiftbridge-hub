/**
 * Aave V3 Contract Addresses and ABIs
 * 
 * OFFICIAL Aave V3 Pool addresses - DO NOT MODIFY
 * Only Ethereum Mainnet and Sepolia are supported.
 */

// Aave V3 Pool addresses per chain - OFFICIAL ADDRESSES
export const AAVE_V3_POOL_ADDRESSES: Record<number, `0x${string}`> = {
  // Ethereum Mainnet
  1: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
  // Sepolia Testnet
  11155111: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951',
};

// Supported chain IDs for Earn/Lending (only Mainnet + Sepolia)
export const EARN_SUPPORTED_CHAINS = [1, 11155111] as const;
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
  1: 'Ethereum Mainnet',
  11155111: 'Sepolia Testnet',
};

// Chain logos for UI
export const EARN_CHAIN_LOGOS: Record<number, string> = {
  1: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/ethereum.svg',
  11155111: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/ethereum.svg',
};

// Block explorer URLs
export const EARN_CHAIN_EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io/tx/',
  11155111: 'https://sepolia.etherscan.io/tx/',
};

/**
 * Minimal Aave V3 Pool ABI
 * Only includes the functions we need for supply operations
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

// Aave referral code - MUST be 0
export const AAVE_REFERRAL_CODE = 0;
