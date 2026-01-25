/**
 * Morpho Markets Table Component
 * 
 * Displays Morpho Blue lending markets in a table (desktop) or cards (mobile).
 * Supply/Borrow actions open Morpho app in new tab.
 */

import { motion } from 'framer-motion';
import { 
  ArrowUpDown, 
  Loader2, 
  RefreshCw, 
  AlertCircle, 
  ExternalLink,
  Search,
  Copy,
  Check,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { MorphoMarket } from '@/hooks/useMorphoMarkets';
import { getMorphoChainConfig } from '@/lib/morphoConfig';
import { toast } from '@/hooks/use-toast';

// Token logo mapping
const TOKEN_LOGOS: Record<string, string> = {
  ETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/eth.svg',
  WETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg',
  USDC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  USDT: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdt.svg',
  DAI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/dai.svg',
  WBTC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg',
  CBETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/cbeth.svg',
  WSTETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wsteth.svg',
  RETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/reth.svg',
};

const getTokenLogo = (symbol: string): string => {
  const upperSymbol = symbol.toUpperCase().replace('.', '');
  return TOKEN_LOGOS[upperSymbol] || 
    'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
};

interface MorphoMarketsTableProps {
  markets: MorphoMarket[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function MorphoMarketsTable({
  markets,
  loading,
  error,
  onRefresh,
}: MorphoMarketsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'supplyApy' | 'tvl' | 'utilization'>('tvl');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter and sort markets
  const filteredMarkets = useMemo(() => {
    let result = [...markets];

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.loanToken.symbol.toLowerCase().includes(query) ||
        m.loanToken.name.toLowerCase().includes(query) ||
        (m.collateralToken?.symbol.toLowerCase().includes(query))
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'supplyApy':
          comparison = a.supplyApy - b.supplyApy;
          break;
        case 'tvl':
          comparison = a.totalSupply - b.totalSupply;
          break;
        case 'utilization':
          comparison = a.utilization - b.utilization;
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [markets, searchQuery, sortBy, sortDirection]);

  const formatAPY = (apy: number) => {
    if (!Number.isFinite(apy) || apy === 0) return '—';
    if (apy < 0.01) return '<0.01%';
    if (apy > 100) return `${apy.toFixed(1)}%`;
    return `${apy.toFixed(2)}%`;
  };

  const formatTVL = (value: number) => {
    if (!Number.isFinite(value) || value === 0) return '—';
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatUtilization = (util: number) => {
    if (!Number.isFinite(util)) return '—';
    return `${util.toFixed(1)}%`;
  };

  const handleSupply = (market: MorphoMarket) => {
    const config = getMorphoChainConfig(market.chainId);
    const url = config?.morphoAppUrl || 'https://app.morpho.org';
    window.open(url, '_blank');
    toast({
      title: 'Opening Morpho App',
      description: `Supply ${market.loanToken.symbol} on Morpho Blue`,
    });
  };

  const handleBorrow = (market: MorphoMarket) => {
    const config = getMorphoChainConfig(market.chainId);
    const url = config?.morphoAppUrl || 'https://app.morpho.org';
    window.open(url, '_blank');
    toast({
      title: 'Opening Morpho App',
      description: `Borrow ${market.loanToken.symbol} on Morpho Blue`,
    });
  };

  const copyMarketId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: 'Market ID Copied',
      description: id.slice(0, 20) + '...',
    });
  };

  const handleSortChange = (column: 'supplyApy' | 'tvl' | 'utilization') => {
    if (sortBy === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  const SortButton = ({ column, label }: { column: 'supplyApy' | 'tvl' | 'utilization'; label: string }) => (
    <button
      onClick={() => handleSortChange(column)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium transition-colors",
        sortBy === column ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      <ArrowUpDown className={cn(
        "w-3 h-3",
        sortBy === column && sortDirection === 'desc' && "rotate-180"
      )} />
    </button>
  );

  // Loading state
  if (loading && markets.length === 0) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error && markets.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Unable to load markets</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">{error}</p>
        <Button onClick={onRefresh} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
      </div>
    );
  }

  // Empty state
  if (markets.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-lg font-semibold mb-2">No Markets Found</h3>
        <p className="text-muted-foreground">No Morpho markets available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by token symbol..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-10 bg-muted/30 border-border/50"
        />
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredMarkets.length} market{filteredMarkets.length !== 1 ? 's' : ''} found
        </p>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Refreshing...
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-4">
                  <span className="text-xs font-medium text-muted-foreground">Market</span>
                </th>
                <th className="text-right p-4">
                  <SortButton column="supplyApy" label="Supply APY" />
                </th>
                <th className="text-right p-4">
                  <span className="text-xs font-medium text-muted-foreground">Borrow APY</span>
                </th>
                <th className="text-right p-4">
                  <SortButton column="tvl" label="Total Supply" />
                </th>
                <th className="text-right p-4">
                  <SortButton column="utilization" label="Utilization" />
                </th>
                <th className="text-right p-4"></th>
              </tr>
            </thead>
            <tbody>
              {filteredMarkets.map((market, index) => {
                const chainConfig = getMorphoChainConfig(market.chainId);
                return (
                  <motion.tr
                    key={market.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                  >
                    {/* Market pair */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <img
                            src={getTokenLogo(market.loanToken.symbol)}
                            alt={market.loanToken.symbol}
                            className="w-9 h-9 rounded-full bg-muted"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
                            }}
                          />
                          {chainConfig && (
                            <img
                              src={chainConfig.logo}
                              alt={chainConfig.label}
                              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border border-card bg-card"
                            />
                          )}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-1.5">
                            {market.loanToken.symbol}
                            {market.collateralToken && (
                              <span className="text-muted-foreground font-normal">
                                / {market.collateralToken.symbol}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => copyMarketId(market.id)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {market.id.slice(0, 10)}...
                            {copiedId === market.id ? (
                              <Check className="w-3 h-3 text-success" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Supply APY */}
                    <td className="p-4 text-right">
                      <div className="font-semibold text-lg text-primary">
                        {formatAPY(market.supplyApy)}
                      </div>
                    </td>

                    {/* Borrow APY */}
                    <td className="p-4 text-right">
                      <div className="text-sm">
                        {formatAPY(market.borrowApy)}
                      </div>
                    </td>

                    {/* Total Supply */}
                    <td className="p-4 text-right">
                      <div className="text-sm font-medium">
                        {formatTVL(market.totalSupply)}
                      </div>
                    </td>

                    {/* Utilization */}
                    <td className="p-4 text-right">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          market.utilization > 90 ? "bg-destructive/10 text-destructive border-destructive/30" :
                          market.utilization > 70 ? "bg-warning/10 text-warning border-warning/30" :
                          "bg-muted/50"
                        )}
                      >
                        {formatUtilization(market.utilization)}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleSupply(market)}
                          className="h-8 px-3 gap-1"
                        >
                          Supply
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBorrow(market)}
                          className="h-8 px-3 gap-1"
                        >
                          Borrow
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {filteredMarkets.map((market, index) => {
          const chainConfig = getMorphoChainConfig(market.chainId);
          return (
            <motion.div
              key={market.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              className="glass rounded-xl p-4"
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <img
                      src={getTokenLogo(market.loanToken.symbol)}
                      alt={market.loanToken.symbol}
                      className="w-10 h-10 rounded-full bg-muted"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
                      }}
                    />
                    {chainConfig && (
                      <img
                        src={chainConfig.logo}
                        alt={chainConfig.label}
                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border border-card bg-card"
                      />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">
                      {market.loanToken.symbol}
                      {market.collateralToken && (
                        <span className="text-muted-foreground font-normal">
                          {' '}/ {market.collateralToken.symbol}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {chainConfig?.label || 'Unknown Chain'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-lg text-primary">
                    {formatAPY(market.supplyApy)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Supply APY</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/30">
                <div className="grid grid-cols-2 gap-4 text-sm flex-1">
                  <div>
                    <span className="text-muted-foreground">TVL: </span>
                    <span className="font-medium">{formatTVL(market.totalSupply)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Util: </span>
                    <span className="font-medium">{formatUtilization(market.utilization)}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSupply(market)}
                  className="h-8 px-3 gap-1"
                >
                  Supply
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
