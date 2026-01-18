import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useChainId } from 'wagmi';
import { Wallet, RefreshCw, Loader2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { getChains, getTokens, Chain, Token } from '@/lib/lifiClient';
import { cn } from '@/lib/utils';

interface TokenBalance {
  token: Token;
  chain: Chain;
  balance: string;
  balanceUSD: string;
}

// Define main chain IDs to prevent duplicates
const MAIN_CHAIN_IDS = [1, 10, 137, 42161, 8453] as const;

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [selectedChains, setSelectedChains] = useState<number[]>([...MAIN_CHAIN_IDS]);
  const [chains, setChains] = useState<Chain[]>([]);
  
  // Track previous address to detect account changes
  const prevAddressRef = useRef<string | undefined>(undefined);
  const prevChainIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    getChains().then(setChains);
  }, []);

  const fetchBalances = useCallback(async (walletAddress: string) => {
    if (!walletAddress) return;
    
    setLoading(true);
    const allBalances: TokenBalance[] = [];

    try {
      for (const selectedChainId of selectedChains) {
        const chain = chains.find(c => c.id === selectedChainId);
        if (!chain) continue;

        const tokens = await getTokens(selectedChainId);
        
        // For demo, show popular tokens with mock balances
        // In production, you'd use multicall or balance API
        const popularTokens = tokens.slice(0, 5);
        
        for (const token of popularTokens) {
          // Generate consistent mock balance based on address + token for demo
          // This ensures the same wallet shows same balances on refresh
          const seed = walletAddress.toLowerCase() + token.address.toLowerCase();
          const hash = seed.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
          }, 0);
          const mockBalance = Math.abs(hash % 1000) / 100;
          const mockUSD = mockBalance * parseFloat(token.priceUSD || '0');
          
          if (mockUSD > 0.01) {
            allBalances.push({
              token,
              chain,
              balance: mockBalance.toFixed(4),
              balanceUSD: mockUSD.toFixed(2),
            });
          }
        }
      }

      // Sort by USD value
      allBalances.sort((a, b) => parseFloat(b.balanceUSD) - parseFloat(a.balanceUSD));
      setBalances(allBalances);
    } catch (error) {
      console.error('Failed to fetch balances:', error);
    } finally {
      setLoading(false);
    }
  }, [chains, selectedChains]);

  // Clear balances and reset when disconnected
  useEffect(() => {
    if (!isConnected || !address) {
      setBalances([]);
      prevAddressRef.current = undefined;
      return;
    }
  }, [isConnected, address]);

  // Handle account changes - refetch when address changes
  useEffect(() => {
    if (!isConnected || !address || chains.length === 0) return;

    // Check if address changed (account switch)
    if (prevAddressRef.current !== address) {
      console.log('Account changed:', prevAddressRef.current, '->', address);
      // Clear old balances immediately for new account
      if (prevAddressRef.current !== undefined) {
        setBalances([]);
      }
      prevAddressRef.current = address;
      fetchBalances(address);
    }
  }, [isConnected, address, chains.length, fetchBalances]);

  // Handle chain changes - refetch when chain changes
  useEffect(() => {
    if (!isConnected || !address || chains.length === 0) return;

    if (prevChainIdRef.current !== chainId && prevChainIdRef.current !== undefined) {
      console.log('Chain changed:', prevChainIdRef.current, '->', chainId);
      fetchBalances(address);
    }
    prevChainIdRef.current = chainId;
  }, [isConnected, address, chainId, chains.length, fetchBalances]);

  // Refetch when selected chains filter changes
  useEffect(() => {
    if (isConnected && address && chains.length > 0) {
      fetchBalances(address);
    }
  }, [selectedChains]);

  const totalValueUSD = balances.reduce((sum, b) => sum + parseFloat(b.balanceUSD), 0);

  // Get unique main chains (deduplicated)
  const mainChains = chains.filter(c => MAIN_CHAIN_IDS.includes(c.id as typeof MAIN_CHAIN_IDS[number]));
  const uniqueMainChains = mainChains.filter((chain, index, self) => 
    index === self.findIndex(c => c.id === chain.id)
  );

  if (!isConnected) {
    return (
      <Layout>
        <div className="container mx-auto px-4">
          <div className="glass rounded-2xl p-12 text-center max-w-lg mx-auto">
            <Wallet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground">
              Connect wallet to view portfolio
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Portfolio</h1>
              <p className="text-muted-foreground font-mono text-sm">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
            </div>
            <Button
              onClick={() => address && fetchBalances(address)}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {/* Total value */}
          <div className="glass rounded-2xl p-8 mb-8">
            <div className="text-sm text-muted-foreground mb-2">Total Value</div>
            <div className="text-4xl font-bold text-gradient">
              ${totalValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Chain filters - deduplicated */}
          <div className="flex flex-wrap gap-2 mb-6">
            {uniqueMainChains.map((chain) => {
              const isSelected = selectedChains.includes(chain.id);
              return (
                <button
                  key={`chain-filter-${chain.id}`}
                  onClick={() => {
                    setSelectedChains(prev =>
                      prev.includes(chain.id)
                        ? prev.filter(id => id !== chain.id)
                        : [...prev, chain.id]
                    );
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                    isSelected
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                      : "glass hover:bg-muted/50"
                  )}
                >
                  <img
                    src={chain.logoURI}
                    alt={chain.name}
                    className="w-5 h-5 rounded-full"
                  />
                  {chain.name}
                </button>
              );
            })}
          </div>

          {/* Balances list */}
          {loading ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-muted-foreground">Loading balances...</p>
            </div>
          ) : balances.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No tokens found on selected chains</p>
            </div>
          ) : (
            <div className="glass rounded-2xl divide-y divide-border overflow-hidden">
              {balances.map((item, idx) => (
                <motion.div
                  key={`${item.chain.id}-${item.token.address}-${idx}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="relative">
                    <img
                      src={item.token.logoURI || 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg'}
                      alt={item.token.symbol}
                      className="w-10 h-10 rounded-full bg-muted"
                    />
                    <img
                      src={item.chain.logoURI}
                      alt={item.chain.name}
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-card"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{item.token.symbol}</div>
                    <div className="text-xs text-muted-foreground">{item.chain.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{item.balance}</div>
                    <div className="text-sm text-muted-foreground">${item.balanceUSD}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Note */}
          <p className="text-xs text-muted-foreground text-center mt-6">
            Note: Balances shown are for demonstration. Connect to live APIs for real balances.
          </p>
        </motion.div>
      </div>
    </Layout>
  );
}
