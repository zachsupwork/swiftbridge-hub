// Multi-chain wallet types

export type WalletType = 'evm' | 'solana' | 'bitcoin' | 'sui';

export interface WalletInfo {
  type: WalletType;
  address: string;
  connected: boolean;
  chainId?: number | string;
}

// Chain type classification based on LI.FI chain types
export const CHAIN_TYPES: Record<string, WalletType> = {
  'EVM': 'evm',
  'SOL': 'solana', 
  'SVM': 'solana',
  'BTC': 'bitcoin',
  'UTXO': 'bitcoin',
  'SUI': 'sui',
};

// Known non-EVM chain IDs from LI.FI
export const SOLANA_CHAIN_ID = 1151111081099710; // LI.FI's Solana chain ID
export const BITCOIN_CHAIN_ID = 20000000000001; // LI.FI's Bitcoin chain ID  
export const SUI_CHAIN_ID = 101; // Sui mainnet

// Helper to determine wallet type needed for a chain
export function getWalletTypeForChain(chainId: number, chainType?: string): WalletType {
  // Check by chain type first
  if (chainType && CHAIN_TYPES[chainType.toUpperCase()]) {
    return CHAIN_TYPES[chainType.toUpperCase()];
  }
  
  // Check by known chain IDs
  if (chainId === SOLANA_CHAIN_ID) return 'solana';
  if (chainId === BITCOIN_CHAIN_ID) return 'bitcoin';
  if (chainId === SUI_CHAIN_ID) return 'sui';
  
  // Default to EVM for standard numeric chain IDs
  return 'evm';
}

// Check if chain is EVM-compatible
export function isEVMChain(chainId: number, chainType?: string): boolean {
  return getWalletTypeForChain(chainId, chainType) === 'evm';
}

// Shorten address for display
export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}
