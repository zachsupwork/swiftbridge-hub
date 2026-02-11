import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useAccount } from 'wagmi';
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
  isWalletConnected: (type: WalletType) => boolean;
  getAddress: (type: WalletType) => string | null;
  anyWalletConnected: boolean;
}

const MultiWalletContext = createContext<MultiWalletContextValue | null>(null);

export function MultiWalletProvider({ children }: { children: ReactNode }) {
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { address: btcAddress, connected: btcConnected } = useBitcoinWallet();

  const value = useMemo<MultiWalletContextValue>(() => {
    const wallets: MultiWalletContextValue = {
      evm: {
        type: 'evm',
        connected: evmConnected,
        address: evmAddress || null,
        shortAddress: evmAddress ? shortenAddress(evmAddress) : null,
      },
      solana: {
        type: 'solana',
        connected: false,
        address: null,
        shortAddress: null,
      },
      bitcoin: {
        type: 'bitcoin',
        connected: btcConnected,
        address: btcAddress,
        shortAddress: btcAddress ? shortenAddress(btcAddress) : null,
      },
      sui: {
        type: 'sui',
        connected: false,
        address: null,
        shortAddress: null,
      },
      isWalletConnected: (type: WalletType) => {
        switch (type) {
          case 'evm': return evmConnected;
          case 'bitcoin': return btcConnected;
          default: return false;
        }
      },
      getAddress: (type: WalletType) => {
        switch (type) {
          case 'evm': return evmAddress || null;
          case 'bitcoin': return btcAddress;
          default: return null;
        }
      },
      anyWalletConnected: evmConnected || btcConnected,
    };

    return wallets;
  }, [evmAddress, evmConnected, btcAddress, btcConnected]);

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