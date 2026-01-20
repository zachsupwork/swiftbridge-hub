import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useCurrentAccount as useSuiCurrentAccount } from '@mysten/dapp-kit';
import { useBitcoinWallet } from './bitcoinWallet';
import { WalletType, shortenAddress } from './types';

interface WalletConnection {
  type: WalletType;
  connected: boolean;
  address: string | null;
  shortAddress: string | null;
}

interface MultiWalletContextValue {
  evm: WalletConnection;
  solana: WalletConnection;
  bitcoin: WalletConnection;
  sui: WalletConnection;
  // Helper to check if a specific wallet type is connected
  isWalletConnected: (type: WalletType) => boolean;
  // Get address for a wallet type
  getAddress: (type: WalletType) => string | null;
  // Check if ANY wallet is connected
  anyWalletConnected: boolean;
}

const MultiWalletContext = createContext<MultiWalletContextValue | null>(null);

export function MultiWalletProvider({ children }: { children: ReactNode }) {
  // EVM wallet from wagmi
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  
  // Solana wallet
  const { publicKey: solanaPublicKey, connected: solanaConnected } = useSolanaWallet();
  
  // Bitcoin wallet
  const { address: btcAddress, connected: btcConnected } = useBitcoinWallet();
  
  // Sui wallet
  const suiAccount = useSuiCurrentAccount();

  const value = useMemo<MultiWalletContextValue>(() => {
    const solanaAddress = solanaPublicKey?.toBase58() || null;
    const suiAddress = suiAccount?.address || null;

    const wallets: MultiWalletContextValue = {
      evm: {
        type: 'evm',
        connected: evmConnected,
        address: evmAddress || null,
        shortAddress: evmAddress ? shortenAddress(evmAddress) : null,
      },
      solana: {
        type: 'solana',
        connected: solanaConnected,
        address: solanaAddress,
        shortAddress: solanaAddress ? shortenAddress(solanaAddress) : null,
      },
      bitcoin: {
        type: 'bitcoin',
        connected: btcConnected,
        address: btcAddress,
        shortAddress: btcAddress ? shortenAddress(btcAddress) : null,
      },
      sui: {
        type: 'sui',
        connected: !!suiAccount,
        address: suiAddress,
        shortAddress: suiAddress ? shortenAddress(suiAddress) : null,
      },
      isWalletConnected: (type: WalletType) => {
        switch (type) {
          case 'evm': return evmConnected;
          case 'solana': return solanaConnected;
          case 'bitcoin': return btcConnected;
          case 'sui': return !!suiAccount;
          default: return false;
        }
      },
      getAddress: (type: WalletType) => {
        switch (type) {
          case 'evm': return evmAddress || null;
          case 'solana': return solanaAddress;
          case 'bitcoin': return btcAddress;
          case 'sui': return suiAddress;
          default: return null;
        }
      },
      anyWalletConnected: evmConnected || solanaConnected || btcConnected || !!suiAccount,
    };

    return wallets;
  }, [evmAddress, evmConnected, solanaPublicKey, solanaConnected, btcAddress, btcConnected, suiAccount]);

  return (
    <MultiWalletContext.Provider value={value}>
      {children}
    </MultiWalletContext.Provider>
  );
}

export function useMultiWallet() {
  const context = useContext(MultiWalletContext);
  if (!context) {
    throw new Error('useMultiWallet must be used within a MultiWalletProvider');
  }
  return context;
}
