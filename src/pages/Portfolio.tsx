import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, RefreshCw, Loader2, ChevronDown, ChevronUp, AlertCircle,
  Search, ArrowRightLeft, Coins, Link2, EyeOff, Eye,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SeoHead } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getChains, Chain, lastFetchMethod, lastFetchDebug } from '@/lib/lifiClient';
import { usePortfolioTotal, PortfolioTokenBalance } from '@/hooks/usePortfolioTotal';
import { buildSwapLink } from '@/lib/swapDeepLink';
import { SUPPORTED_CHAINS } from '@/lib/wagmiConfig';
import { cn } from '@/lib/utils';

// Testnet IDs to exclude from chain filter tabs
const TESTNET_IDS = new Set([11155111]);

const PORTFOLIO_CHAIN_IDS = SUPPORTED_CHAINS
  .map((c) => c.id as number)
  .filter((id) => !TESTNET_IDS.has(id));

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const { totalUSD, loading, lastUpdated, error, tokenBalances, balancesByChain, refresh, chainIds } = usePortfolioTotal();
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

  // Stats
  const uniqueChains = useMemo(() => new Set(tokenBalances.map((t) => t.chainId)).size, [tokenBalances]);
  const dustCount = useMemo(() => tokenBalances.filter((t) => t.balanceUSD < 1 && t.balanceUSD > 0).length, [tokenBalances]);

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
              <div className="text-xs text-muted-foreground mb-1">Last Updated</div>
              <div className="text-sm font-medium">
                {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
              </div>
              {loading && <Loader2 className="w-3 h-3 animate-spin text-primary mt-1" />}
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
              {hideDust ? 'Show All' : `Hide <$1${dustCount > 0 ? ` (${dustCount})` : ''}`}
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
                  <p><span className="text-foreground">Balances returned:</span> {Object.values(balancesByChain).reduce((s, a) => s + a.length, 0)}</p>
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
          {loading && tokenBalances.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-muted-foreground">Loading balances across {chainIds.length} chains...</p>
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No tokens match your search' : error
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
                    transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                    className="flex items-center gap-3 p-3 sm:p-4 hover:bg-muted/30 transition-colors group"
                  >
                    {/* Token icon with chain badge */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={item.token.logoURI || `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${item.token.address}/logo.png`}
                        alt={item.token.symbol}
                        className="w-10 h-10 rounded-full bg-muted"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
                        }}
                      />
                      {chain && (
                        <img
                          src={chain.logoURI}
                          alt={chain.name}
                          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-card"
                        />
                      )}
                    </div>
                    {/* Token info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm sm:text-base">{item.token.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.token.name} • {chain?.name || `Chain ${item.chainId}`}
                      </div>
                    </div>
                    {/* Amounts */}
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
                    {/* Swap button */}
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
              <span>Showing {filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''}</span>
              <span>Total: ${displayTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}

          {/* Swap CTA at bottom */}
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

/*
 * Manual test instructions:
 * 1. Connect a wallet with Polygon balances (WBTC, USDT, POL, etc.)
 * 2. Navigate to /portfolio
 * 3. Enable debug section (auto in DEV mode)
 * 4. Confirm:
 *    - Balances returned > 0
 *    - Total tokens parsed > 0
 *    - Fetch method shows "on-chain-rpc" or "lifi-rest"
 *    - Total Value is non-zero
 * 5. Click chain filter tabs and verify filtering works
 * 6. Use search bar to find specific tokens
 * 7. Toggle "Hide <$1" to filter dust
 * 8. Click Swap button on a token row to verify swap deep link
 */
