import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { Wallet, RefreshCw, ExternalLink, Loader2 } from 'lucide-react';
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

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [selectedChains, setSelectedChains] = useState<number[]>([1, 10, 137, 42161, 8453]);
  const [chains, setChains] = useState<Chain[]>([]);

  useEffect(() => {
    getChains().then(setChains);
  }, []);

  const fetchBalances = async () => {
    if (!address) return;
    
    setLoading(true);
    const allBalances: TokenBalance[] = [];

    try {
      for (const chainId of selectedChains) {
        const chain = chains.find(c => c.id === chainId);
        if (!chain) continue;

        const tokens = await getTokens(chainId);
        
        // For demo, show popular tokens with mock balances
        // In production, you'd use multicall or balance API
        const popularTokens = tokens.slice(0, 5);
        
        for (const token of popularTokens) {
          // Mock balance for demo
          const mockBalance = Math.random() * 10;
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
  };

  useEffect(() => {
    if (isConnected && address && chains.length > 0) {
      fetchBalances();
    }
  }, [isConnected, address, chains.length, selectedChains]);

  const totalValueUSD = balances.reduce((sum, b) => sum + parseFloat(b.balanceUSD), 0);

  const mainChains = chains.filter(c => [1, 10, 137, 42161, 8453].includes(c.id));

  if (!isConnected) {
    return (
      <Layout>
        <div className="container mx-auto px-4">
          <div className="glass rounded-2xl p-12 text-center max-w-lg mx-auto">
            <Wallet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground">
              Connect your wallet to view your portfolio across multiple chains.
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
              <p className="text-muted-foreground">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
            </div>
            <Button
              onClick={fetchBalances}
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

          {/* Chain filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {mainChains.map((chain) => (
              <button
                key={chain.id}
                onClick={() => {
                  setSelectedChains(prev =>
                    prev.includes(chain.id)
                      ? prev.filter(id => id !== chain.id)
                      : [...prev, chain.id]
                  );
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  selectedChains.includes(chain.id)
                    ? "bg-primary text-primary-foreground"
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
            ))}
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
                  key={`${item.chain.id}-${item.token.address}`}
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
