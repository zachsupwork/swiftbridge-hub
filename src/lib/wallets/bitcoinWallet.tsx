import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Bitcoin wallet provider types
interface BitcoinProvider {
  requestAccounts: () => Promise<string[]>;
  getAccounts: () => Promise<string[]>;
  disconnect?: () => Promise<void>;
  on?: (event: string, callback: (...args: any[]) => void) => void;
  removeListener?: (event: string, callback: (...args: any[]) => void) => void;
}

interface BitcoinWalletState {
  connected: boolean;
  address: string | null;
  provider: BitcoinProvider | null;
  providerName: string | null;
  isAvailable: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const BitcoinWalletContext = createContext<BitcoinWalletState | null>(null);

// Detect available Bitcoin wallet providers
function detectBitcoinProvider(): { provider: BitcoinProvider | null; name: string | null } {
  const win = window as any;
  
  // Check UniSat first (most popular)
  if (win.unisat) {
    return { provider: win.unisat, name: 'UniSat' };
  }
  
  // Check Xverse
  if (win.XverseProviders?.BitcoinProvider) {
    return { provider: win.XverseProviders.BitcoinProvider, name: 'Xverse' };
  }
  
  // Check Leather (formerly Hiro)
  if (win.LeatherProvider) {
    return { provider: win.LeatherProvider, name: 'Leather' };
  }
  
  // Check OKX
  if (win.okxwallet?.bitcoin) {
    return { provider: win.okxwallet.bitcoin, name: 'OKX' };
  }

  return { provider: null, name: null };
}

export function BitcoinWalletProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<BitcoinProvider | null>(null);
  const [providerName, setProviderName] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);

  // Detect provider on mount
  useEffect(() => {
    const { provider, name } = detectBitcoinProvider();
    setProvider(provider);
    setProviderName(name);
    setIsAvailable(provider !== null);

    // Check if already connected
    if (provider) {
      provider.getAccounts().then((accounts) => {
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
          setConnected(true);
        }
      }).catch(() => {
        // Ignore errors on initial check
      });
    }
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (!provider?.on) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setConnected(false);
        setAddress(null);
      } else {
        setAddress(accounts[0]);
        setConnected(true);
      }
    };

    provider.on('accountsChanged', handleAccountsChanged);

    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
    };
  }, [provider]);

  const connect = useCallback(async () => {
    const { provider: currentProvider, name } = detectBitcoinProvider();
    
    if (!currentProvider) {
      throw new Error('No Bitcoin wallet detected. Please install UniSat, Xverse, or Leather wallet.');
    }

    setProvider(currentProvider);
    setProviderName(name);

    const accounts = await currentProvider.requestAccounts();
    
    if (accounts && accounts.length > 0) {
      setAddress(accounts[0]);
      setConnected(true);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (provider?.disconnect) {
      await provider.disconnect();
    }
    setConnected(false);
    setAddress(null);
  }, [provider]);

  return (
    <BitcoinWalletContext.Provider
      value={{
        connected,
        address,
        provider,
        providerName,
        isAvailable,
        connect,
        disconnect,
      }}
    >
      {children}
    </BitcoinWalletContext.Provider>
  );
}

export function useBitcoinWallet() {
  const context = useContext(BitcoinWalletContext);
  if (!context) {
    throw new Error('useBitcoinWallet must be used within a BitcoinWalletProvider');
  }
  return context;
}
