import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, Search, ArrowRightLeft, Coins, Link2, EyeOff, Eye,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SeoHead } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getChains, Chain, lastFetchMethod, lastFetchDebug } from '@/lib/lifiClient';
import { useBalancesContext } from '@/providers/BalancesProvider';
import type { PortfolioTokenBalance } from '@/hooks/useBalances';
import { buildSwapLink } from '@/lib/swapDeepLink';
import { SUPPORTED_CHAINS } from '@/lib/wagmiConfig';
import { cn } from '@/lib/utils';
import { TokenIconStable } from '@/components/common/TokenIconStable';
import { SyncBalancesButton } from '@/components/common/SyncBalancesButton';
import { BalanceSyncingState } from '@/components/common/BalanceSyncingState';

// Testnet IDs to exclude from chain filter tabs
const TESTNET_IDS = new Set([11155111]);

const PORTFOLIO_CHAIN_IDS = SUPPORTED_CHAINS
  .map((c) => c.id as number)
  .filter((id) => !TESTNET_IDS.has(id));

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const {
    totalUSD, isLoading, lastUpdated, error, tokenBalances,
    balancesByChain, refreshBalances, chainIds,
  } = useBalancesContext();
  const [selectedChainFilter, setSelectedChainFilter] = useState<number | 'all'>('all');
  const [chains, setChains] = useState<Chain[]>([]);
  const [debugOpen, setDebugOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hideDust, setHideDust] = useState(false);

  useEffect(() => {
    getChains().then(setChains);
  }, []);

  // Filter tokens by selected chain, search, and dust
  const filteredTokens = useMemo(() => {
    let tokens = tokenBalances;
    if (selectedChainFilter !== 'all') {
      tokens = tokens.filter((t) => t.chainId === selectedChainFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      tokens = tokens.filter((t) =>
        t.token.symbol.toLowerCase().includes(q) ||
        t.token.name.toLowerCase().includes(q) ||
        t.token.address.toLowerCase().includes(q)
      );
    }
    if (hideDust) {
      tokens = tokens.filter((t) => t.balanceUSD >= 1);
    }
    return tokens;
  }, [tokenBalances, selectedChainFilter, searchQuery, hideDust]);

  const filteredTotal = useMemo(() => {
    return filteredTokens.reduce((sum, t) => sum + t.balanceUSD, 0);
  }, [filteredTokens]);

  const chainMap = useMemo(() => {
    const map = new Map<number, Chain>();
    chains.forEach((c) => map.set(c.id, c));
    return map;
  }, [chains]);

  const chainFilterTabs = useMemo(() => {
    return chains
      .filter((c) => PORTFOLIO_CHAIN_IDS.includes(c.id))
      .filter((chain, index, self) => index === self.findIndex((c) => c.id === chain.id));
  }, [chains]);

  const uniqueChains = useMemo(() => new Set(tokenBalances.map((t) => t.chainId)).size, [tokenBalances]);
  const dustCount = useMemo(() => tokenBalances.filter((t) => t.balanceUSD < 1 && t.balanceUSD > 0).length, [tokenBalances]);
  const failedChains = useMemo(() => {
    // Chains we queried but got 0 tokens back (likely RPC failure)
    const chainsWithTokens = new Set(tokenBalances.map((t) => t.chainId));
    return chainIds.filter(id => !chainsWithTokens.has(id) && !new Set([11155111]).has(id));
  }, [tokenBalances, chainIds]);

  const displayTotal = selectedChainFilter === 'all' ? totalUSD : filteredTotal;
  const showDebugEnv = import.meta.env.DEV || import.meta.env.VITE_PORTFOLIO_DEBUG === 'true';

  const handleSwap = (token: PortfolioTokenBalance) => {
    const link = buildSwapLink({
      chainId: token.chainId,
      toTokenAddress: token.token.address,
      toTokenSymbol: token.token.symbol,
    });
    navigate(link);
  };

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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-1">Portfolio</h1>
              <p className="text-muted-foreground font-mono text-sm">{address}</p>
            </div>
            <SyncBalancesButton
              isLoading={isLoading}
              lastUpdated={lastUpdated}
              onRefresh={refreshBalances}
            />
          </div>

          {/* Error banner */}
          {error && !isLoading && tokenBalances.length > 0 && (
            <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-warning/10 border border-warning/30 text-sm">
              <span className="flex-1 text-warning">{error}</span>
              <SyncBalancesButton isLoading={isLoading} lastUpdated={lastUpdated} onRefresh={refreshBalances} variant="compact" />
            </div>
          )}

          {/* Failed chains banner */}
          {!isLoading && failedChains.length > 0 && tokenBalances.length > 0 && (
            <div className="flex items-center gap-3 p-3 mb-6 rounded-xl bg-muted/50 border border-border text-xs text-muted-foreground">
              <span className="flex-1">
                Some chains may be temporarily unavailable ({failedChains.length} chain{failedChains.length > 1 ? 's' : ''} returned no tokens). Tap Refresh to retry.
              </span>
              <SyncBalancesButton isLoading={isLoading} lastUpdated={lastUpdated} onRefresh={refreshBalances} variant="compact" />
            </div>
          )}

          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="glass rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">Total Value</div>
              <div className="text-2xl font-bold text-gradient">
                ${displayTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Coins className="w-3 h-3" /> Tokens
              </div>
              <div className="text-2xl font-bold">{tokenBalances.length}</div>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Link2 className="w-3 h-3" /> Chains
              </div>
              <div className="text-2xl font-bold">{uniqueChains}</div>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">Last Synced</div>
              <div className="text-sm font-medium">
                {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
              </div>
              <SyncBalancesButton isLoading={isLoading} lastUpdated={lastUpdated} onRefresh={refreshBalances} variant="compact" className="mt-1" />
            </div>
          </div>

          {/* Chain filters */}
          <div className="flex flex-wrap gap-2 mb-4">
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
                <span className="hidden sm:inline">{chain.name}</span>
              </button>
            ))}
          </div>

          {/* Search + dust filter */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tokens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card border-border"
              />
            </div>
            <Button
              variant={hideDust ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHideDust(!hideDust)}
              className="whitespace-nowrap"
            >
              {hideDust ? <Eye className="w-4 h-4 mr-1.5" /> : <EyeOff className="w-4 h-4 mr-1.5" />}
              {hideDust ? `Show All (${dustCount} hidden)` : `Hide <$1${dustCount > 0 ? ` (${dustCount})` : ''}`}
            </Button>
          </div>

          {/* Debug section (dev or VITE_PORTFOLIO_DEBUG only) */}
          {showDebugEnv && (
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
                  <p><span className="text-foreground">Address:</span> {address}</p>
                  <p><span className="text-foreground">Chain IDs queried:</span> {chainIds.join(', ')}</p>
                  <p><span className="text-foreground">Fetch method:</span> {lastFetchMethod || 'none'}</p>
                  <p><span className="text-foreground">REST debug:</span> {lastFetchDebug.url ? `${lastFetchDebug.status} → ${lastFetchDebug.url}` : 'n/a'}</p>
                  {lastFetchDebug.error && <p><span className="text-foreground">Fetch error:</span> {lastFetchDebug.error}</p>}
                  <p><span className="text-foreground">Chains in response:</span> {Object.keys(balancesByChain).join(', ') || 'none'}</p>
                  <p><span className="text-foreground">Balances returned:</span> {Object.values(balancesByChain).reduce((s: number, a: any[]) => s + a.length, 0)}</p>
                  <p><span className="text-foreground">Total tokens parsed:</span> {tokenBalances.length}</p>
                  <p><span className="text-foreground">Total USD:</span> ${totalUSD.toFixed(2)}</p>
                  <p><span className="text-foreground">Error:</span> {error || 'none'}</p>
                  {lastFetchDebug.rawSample && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-foreground">REST raw sample</summary>
                      <pre className="mt-1 max-h-40 overflow-auto text-[10px] break-all">{lastFetchDebug.rawSample}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Balances list */}
          {filteredTokens.length === 0 ? (
            <BalanceSyncingState
              isLoading={isLoading}
              error={error}
              onRefresh={refreshBalances}
              chainName={selectedChainFilter !== 'all' ? chainMap.get(selectedChainFilter as number)?.name : undefined}
              walletAddress={address}
              searchActive={!!searchQuery.trim()}
            />
          ) : (
            <div className="glass rounded-2xl divide-y divide-border overflow-hidden">
              {filteredTokens.map((item, idx) => {
                const chain = chainMap.get(item.chainId);
                return (
                  <motion.div
                    key={`${item.chainId}-${item.token.address}-${idx}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                    className="flex items-center gap-3 p-3 sm:p-4 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="relative flex-shrink-0">
                      <TokenIconStable symbol={item.token.symbol} size="lg" />
                      {chain && (
                        <img
                          src={chain.logoURI}
                          alt={chain.name}
                          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-card"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm sm:text-base">{item.token.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.token.name} • {chain?.name || `Chain ${item.chainId}`}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-medium text-sm sm:text-base">{item.balanceFormatted}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.balanceUSD > 0
                          ? `$${item.balanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : item.token.priceUSD && parseFloat(item.token.priceUSD) > 0
                            ? `$${item.balanceUSD.toFixed(2)}`
                            : '—'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSwap(item)}
                      className="flex-shrink-0 p-2 rounded-lg opacity-0 group-hover:opacity-100 sm:opacity-60 hover:opacity-100 hover:bg-primary/10 text-primary transition-all"
                      title={`Swap ${item.token.symbol}`}
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}

          {filteredTokens.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-4 px-2">
              <span>
                Showing {filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''}
                {hideDust && dustCount > 0 && (
                  <button onClick={() => setHideDust(false)} className="ml-2 underline hover:text-foreground transition-colors">
                    + {dustCount} hidden (tap to view)
                  </button>
                )}
              </span>
              <span>Total: ${displayTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}

          {tokenBalances.length > 0 && (
            <div className="mt-6 text-center">
              <Button onClick={() => navigate('/')} variant="outline" size="sm">
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Swap Tokens
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
