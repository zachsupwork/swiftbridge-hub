import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { Wallet, RefreshCw, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SeoHead } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { getChains, getTokenBalances, Chain, TokenAmount } from '@/lib/lifiClient';
import { cn } from '@/lib/utils';

interface TokenBalance {
  token: TokenAmount;
  chain: Chain;
  balance: string;
  balanceUSD: string;
}

// Define main chain IDs - deduplicated
const MAIN_CHAIN_IDS = [1, 10, 137, 42161, 8453] as const;
type MainChainId = typeof MAIN_CHAIN_IDS[number];

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [selectedChainFilter, setSelectedChainFilter] = useState<number | 'all'>('all');
  const [chains, setChains] = useState<Chain[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [fetchInfo, setFetchInfo] = useState<{
    address: string;
    chainId: number;
    tokenCount: number;
    timestamp: Date;
  } | null>(null);
  
  // Track previous address to detect account changes
  const prevAddressRef = useRef<string | undefined>(undefined);
  const prevChainIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    getChains().then(setChains);
  }, []);

  const fetchBalances = useCallback(async (walletAddress: string, forceRefresh = false) => {
    if (!walletAddress) return;
    
    setLoading(true);
    const allBalances: TokenBalance[] = [];

    try {
      // Determine which chains to fetch based on filter
      const chainsToFetch = selectedChainFilter === 'all' 
        ? [...MAIN_CHAIN_IDS] 
        : [selectedChainFilter];

      // Fetch real token balances from LI.FI API
      const tokenBalances = await getTokenBalances(walletAddress, chainsToFetch);

      // Process balances for each chain
      for (const chainIdStr of Object.keys(tokenBalances)) {
        const chainIdNum = parseInt(chainIdStr, 10);
        const chain = chains.find(c => c.id === chainIdNum);
        if (!chain) continue;

        const tokens = tokenBalances[chainIdStr] || [];
        
        for (const token of tokens) {
          // Calculate balance from raw amount
          const rawAmount = BigInt(token.amount || '0');
          if (rawAmount === 0n) continue;

          const balance = formatUnits(rawAmount, token.decimals);
          const balanceNum = parseFloat(balance);
          const priceUSD = parseFloat(token.priceUSD || '0');
          const balanceUSD = balanceNum * priceUSD;

          // Only show tokens with > $0.01 value
          if (balanceUSD > 0.01) {
            allBalances.push({
              token,
              chain,
              balance: balanceNum.toFixed(balanceNum < 0.0001 ? 8 : 4),
              balanceUSD: balanceUSD.toFixed(2),
            });
          }
        }
      }

      // Sort by USD value (highest first)
      allBalances.sort((a, b) => parseFloat(b.balanceUSD) - parseFloat(a.balanceUSD));
      setBalances(allBalances);
      setLastUpdated(new Date());
      
      // Update debug info
      setFetchInfo({
        address: walletAddress,
        chainId: chainId,
        tokenCount: allBalances.length,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to fetch balances:', error);
      setBalances([]);
    } finally {
      setLoading(false);
    }
  }, [chains, selectedChainFilter, chainId]);

  // Clear balances when disconnected
  useEffect(() => {
    if (!isConnected || !address) {
      setBalances([]);
      setLastUpdated(null);
      setFetchInfo(null);
      prevAddressRef.current = undefined;
      return;
    }
  }, [isConnected, address]);

  // Handle account changes - refetch when address changes
  useEffect(() => {
    if (!isConnected || !address || chains.length === 0) return;

    // Check if address changed (account switch)
    if (prevAddressRef.current !== address) {
      console.log('[Portfolio] Account changed:', prevAddressRef.current, '->', address);
      // Clear old balances immediately for new account
      if (prevAddressRef.current !== undefined) {
        setBalances([]);
        setLastUpdated(null);
      }
      prevAddressRef.current = address;
      fetchBalances(address);
    }
  }, [isConnected, address, chains.length, fetchBalances]);

  // Handle chain changes from wallet
  useEffect(() => {
    if (!isConnected || !address || chains.length === 0) return;

    if (prevChainIdRef.current !== chainId && prevChainIdRef.current !== undefined) {
      console.log('[Portfolio] Chain changed:', prevChainIdRef.current, '->', chainId);
      fetchBalances(address);
    }
    prevChainIdRef.current = chainId;
  }, [isConnected, address, chainId, chains.length, fetchBalances]);

  // Refetch when chain filter changes
  useEffect(() => {
    if (isConnected && address && chains.length > 0 && prevAddressRef.current === address) {
      fetchBalances(address);
    }
  }, [selectedChainFilter]);

  // Calculate total from displayed balances
  const totalValueUSD = balances.reduce((sum, b) => sum + parseFloat(b.balanceUSD), 0);

  // Get unique main chains (deduplicated)
  const uniqueMainChains = chains
    .filter(c => MAIN_CHAIN_IDS.includes(c.id as MainChainId))
    .filter((chain, index, self) => index === self.findIndex(c => c.id === chain.id));

  const isDev = import.meta.env.DEV;

  if (!isConnected) {
    return (
      <Layout>
        <SeoHead />
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
      <SeoHead />
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
                {address}
              </p>
            </div>
            <Button
              onClick={() => address && fetchBalances(address, true)}
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
            <div className="text-sm text-muted-foreground mb-2">
              Total Value {selectedChainFilter !== 'all' && `(${uniqueMainChains.find(c => c.id === selectedChainFilter)?.name || 'Selected Chain'})`}
            </div>
            <div className="text-4xl font-bold text-gradient">
              ${totalValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            {lastUpdated && (
              <div className="text-xs text-muted-foreground mt-2">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>

          {/* Chain filters - with All Chains option */}
          <div className="flex flex-wrap gap-2 mb-6">
            {/* All Chains button */}
            <button
              onClick={() => setSelectedChainFilter('all')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                selectedChainFilter === 'all'
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                  : "glass hover:bg-muted/50"
              )}
            >
              All Chains
            </button>
            
            {/* Individual chain buttons - deduplicated */}
            {uniqueMainChains.map((chain) => {
              const isSelected = selectedChainFilter === chain.id;
              return (
                <button
                  key={`chain-filter-${chain.id}`}
                  onClick={() => setSelectedChainFilter(chain.id)}
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

          {/* Debug section (dev only) */}
          {isDev && fetchInfo && (
            <div className="glass rounded-xl p-4 mb-6 text-xs">
              <button 
                onClick={() => setDebugOpen(!debugOpen)}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {debugOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span className="font-medium">Debug Info</span>
              </button>
              {debugOpen && (
                <div className="mt-3 space-y-1 font-mono text-muted-foreground border-t border-border pt-3">
                  <p><span className="text-foreground">Address:</span> {fetchInfo.address}</p>
                  <p><span className="text-foreground">Wallet Chain ID:</span> {fetchInfo.chainId}</p>
                  <p><span className="text-foreground">Tokens Fetched:</span> {fetchInfo.tokenCount}</p>
                  <p><span className="text-foreground">Filter:</span> {selectedChainFilter === 'all' ? 'All Chains' : selectedChainFilter}</p>
                  <p><span className="text-foreground">Last Fetch:</span> {fetchInfo.timestamp.toLocaleString()}</p>
                </div>
              )}
            </div>
          )}

          {/* Balances list */}
          {loading ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-muted-foreground">Loading real balances from {selectedChainFilter === 'all' ? 'all chains' : 'selected chain'}...</p>
            </div>
          ) : balances.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No tokens found on {selectedChainFilter === 'all' ? 'any chain' : 'selected chain'}</p>
              <p className="text-xs text-muted-foreground/60 mt-2">
                Try selecting a different chain or check if your wallet has tokens
              </p>
            </div>
          ) : (
            <div className="glass rounded-2xl divide-y divide-border overflow-hidden">
              {balances.map((item, idx) => (
                <motion.div
                  key={`${item.chain.id}-${item.token.address}-${idx}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
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
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{item.token.symbol}</div>
                    <div className="text-xs text-muted-foreground truncate">{item.chain.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{item.balance}</div>
                    <div className="text-sm text-muted-foreground">${item.balanceUSD}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Verification note */}
          {balances.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-4 px-2">
              <span>Showing {balances.length} token{balances.length !== 1 ? 's' : ''}</span>
              <span>Total: ${totalValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
