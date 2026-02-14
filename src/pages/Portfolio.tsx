import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { Wallet, RefreshCw, Loader2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SeoHead } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { getChains, Chain } from '@/lib/lifiClient';
import { usePortfolioTotal } from '@/hooks/usePortfolioTotal';
import { SUPPORTED_CHAINS } from '@/lib/wagmiConfig';
import { cn } from '@/lib/utils';

// Testnet IDs to exclude from chain filter tabs
const TESTNET_IDS = new Set([11155111]);

const PORTFOLIO_CHAIN_IDS = SUPPORTED_CHAINS
  .map((c) => c.id as number)
  .filter((id) => !TESTNET_IDS.has(id));

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const { totalUSD, loading, lastUpdated, error, tokenBalances, balancesByChain, refresh, chainIds } = usePortfolioTotal();
  const [selectedChainFilter, setSelectedChainFilter] = useState<number | 'all'>('all');
  const [chains, setChains] = useState<Chain[]>([]);
  const [debugOpen, setDebugOpen] = useState(false);

  useEffect(() => {
    getChains().then(setChains);
  }, []);

  // Filter tokens by selected chain
  const filteredTokens = useMemo(() => {
    if (selectedChainFilter === 'all') return tokenBalances;
    return tokenBalances.filter((t) => t.chainId === selectedChainFilter);
  }, [tokenBalances, selectedChainFilter]);

  // Calculate filtered total
  const filteredTotal = useMemo(() => {
    return filteredTokens.reduce((sum, t) => sum + t.balanceUSD, 0);
  }, [filteredTokens]);

  // Build chain map for icons/names
  const chainMap = useMemo(() => {
    const map = new Map<number, Chain>();
    chains.forEach((c) => map.set(c.id, c));
    return map;
  }, [chains]);

  // Show all non-testnet supported chains as filter tabs
  const chainFilterTabs = useMemo(() => {
    return chains
      .filter((c) => PORTFOLIO_CHAIN_IDS.includes(c.id))
      .filter((chain, index, self) => index === self.findIndex((c) => c.id === chain.id));
  }, [chains]);

  const displayTotal = selectedChainFilter === 'all' ? totalUSD : filteredTotal;
  const showDebugEnv = import.meta.env.DEV || import.meta.env.VITE_PORTFOLIO_DEBUG === 'true';

  if (!isConnected) {
    return (
      <Layout>
        <SeoHead />
        <div className="container mx-auto px-4">
          <div className="glass rounded-2xl p-12 text-center max-w-lg mx-auto">
            <Wallet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground">Connect wallet to view portfolio</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SeoHead />
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Portfolio</h1>
              <p className="text-muted-foreground font-mono text-sm">{address}</p>
            </div>
            <Button onClick={() => refresh()} disabled={loading} variant="outline" size="sm">
              <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          {/* Error banner */}
          {error && !loading && (
            <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-destructive/10 border border-destructive/30 text-sm">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <span className="flex-1 text-destructive">{error}</span>
              <Button onClick={() => refresh()} variant="outline" size="sm" className="text-xs">
                Retry
              </Button>
            </div>
          )}

          {/* Total value */}
          <div className="glass rounded-2xl p-8 mb-8">
            <div className="text-sm text-muted-foreground mb-2">
              Total Value{' '}
              {selectedChainFilter !== 'all' && `(${chainMap.get(selectedChainFilter)?.name || 'Selected Chain'})`}
            </div>
            <div className="text-4xl font-bold text-gradient">
              ${displayTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            {lastUpdated && (
              <div className="text-xs text-muted-foreground mt-2">Last updated: {lastUpdated.toLocaleTimeString()}</div>
            )}
          </div>

          {/* Chain filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setSelectedChainFilter('all')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all',
                selectedChainFilter === 'all'
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                  : 'glass hover:bg-muted/50'
              )}
            >
              All Chains
            </button>
            {chainFilterTabs.map((chain) => (
              <button
                key={`chain-filter-${chain.id}`}
                onClick={() => setSelectedChainFilter(chain.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all',
                  selectedChainFilter === chain.id
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                    : 'glass hover:bg-muted/50'
                )}
              >
                <img src={chain.logoURI} alt={chain.name} className="w-5 h-5 rounded-full" />
                {chain.name}
              </button>
            ))}
          </div>

          {/* Debug section (dev or VITE_PORTFOLIO_DEBUG only) */}
          {showDebugEnv && (
            <div className="glass rounded-xl p-4 mb-6 text-xs">
              <button
                onClick={() => setDebugOpen(!debugOpen)}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {debugOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span className="font-medium">Debug: balances source</span>
              </button>
              {debugOpen && (
                <div className="mt-3 space-y-1 font-mono text-muted-foreground border-t border-border pt-3">
                  <p><span className="text-foreground">Address:</span> {address}</p>
                  <p><span className="text-foreground">Chain IDs queried:</span> {chainIds.join(', ')}</p>
                  <p><span className="text-foreground">Chains in response:</span> {Object.keys(balancesByChain).join(', ') || 'none'}</p>
                  <p><span className="text-foreground">Balances returned:</span> {Object.values(balancesByChain).reduce((s, a) => s + a.length, 0)}</p>
                  <p><span className="text-foreground">Total tokens parsed:</span> {tokenBalances.length}</p>
                  <p><span className="text-foreground">Filtered tokens:</span> {filteredTokens.length}</p>
                  <p><span className="text-foreground">Filter:</span> {selectedChainFilter === 'all' ? 'All Chains' : selectedChainFilter}</p>
                  <p><span className="text-foreground">Total USD (all):</span> ${totalUSD.toFixed(2)}</p>
                  <p><span className="text-foreground">Total USD (filtered):</span> ${filteredTotal.toFixed(2)}</p>
                  <p><span className="text-foreground">Error:</span> {error || 'none'}</p>
                  <p><span className="text-foreground">Last fetch:</span> {lastUpdated?.toLocaleString() || 'never'}</p>
                  {/* Show first 2 raw items */}
                  {Object.keys(balancesByChain).length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-foreground">Raw items (first 2 per chain)</summary>
                      <pre className="mt-1 max-h-60 overflow-auto text-[10px]">
                        {JSON.stringify(
                          Object.fromEntries(
                            Object.entries(balancesByChain).map(([k, v]) => [k, v.slice(0, 2)])
                          ),
                          null, 2
                        )}
                      </pre>
                    </details>
                  )}
                  {tokenBalances.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-foreground">Parsed token details</summary>
                      <pre className="mt-1 max-h-60 overflow-auto text-[10px]">
                        {JSON.stringify(tokenBalances.map((t) => ({
                          chain: t.chainId,
                          symbol: t.token.symbol,
                          balance: t.balanceFormatted,
                          usd: t.balanceUSD.toFixed(2),
                          price: t.token.priceUSD,
                        })), null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Balances list */}
          {loading ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-muted-foreground">Loading balances from {selectedChainFilter === 'all' ? 'all chains' : 'selected chain'}...</p>
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {error
                  ? 'Unable to load balances right now'
                  : `No tokens found on ${selectedChainFilter === 'all' ? 'any chain' : chainMap.get(selectedChainFilter as number)?.name || 'selected chain'}`}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-2">Try selecting a different chain or click Refresh</p>
            </div>
          ) : (
            <div className="glass rounded-2xl divide-y divide-border overflow-hidden">
              {filteredTokens.map((item, idx) => {
                const chain = chainMap.get(item.chainId);
                return (
                  <motion.div
                    key={`${item.chainId}-${item.token.address}-${idx}`}
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
                      {chain && (
                        <img
                          src={chain.logoURI}
                          alt={chain.name}
                          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-card"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{item.token.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate">{chain?.name || `Chain ${item.chainId}`}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{item.balanceFormatted}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.balanceUSD > 0 ? `$${item.balanceUSD.toFixed(2)}` : '—'}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {filteredTokens.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-4 px-2">
              <span>Showing {filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''}</span>
              <span>Total: ${displayTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
