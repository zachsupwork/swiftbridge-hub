/**
 * Markets Table Component - Aave-style
 * Displays lending markets in a table (desktop) or cards (mobile)
 */

import { motion } from 'framer-motion';
import { ArrowUpDown, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { LendingMarket } from '@/hooks/useLendingMarkets';

interface EarnMarketsTableProps {
  markets: LendingMarket[];
  loading: boolean;
  error: string | null;
  onSupplyClick: (market: LendingMarket) => void;
  onRefresh: () => void;
  walletBalances?: Record<string, { balance: bigint; formatted: string }>;
  sortBy: 'apy' | 'tvl' | 'name';
  sortDirection: 'asc' | 'desc';
  onSortChange: (sortBy: 'apy' | 'tvl' | 'name') => void;
}

export function EarnMarketsTable({
  markets,
  loading,
  error,
  onSupplyClick,
  onRefresh,
  walletBalances = {},
  sortBy,
  sortDirection,
  onSortChange,
}: EarnMarketsTableProps) {
  const formatAPY = (apy: number) => {
    if (apy < 0.01) return '<0.01%';
    if (apy > 100) return '>100%';
    return `${apy.toFixed(2)}%`;
  };

  const formatTVL = (tvl: number | null, symbol: string) => {
    if (tvl === null) return '-';
    // For stablecoins, show USD value directly
    const isStablecoin = ['USDC', 'USDT', 'DAI', 'FRAX', 'LUSD', 'GHO'].includes(symbol.toUpperCase());
    if (isStablecoin) {
      if (tvl >= 1_000_000_000) return `$${(tvl / 1_000_000_000).toFixed(2)}B`;
      if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(2)}M`;
      if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(1)}K`;
      return `$${tvl.toFixed(0)}`;
    }
    // For other tokens, show token amount
    if (tvl >= 1_000_000) return `${(tvl / 1_000_000).toFixed(2)}M`;
    if (tvl >= 1_000) return `${(tvl / 1_000).toFixed(1)}K`;
    return tvl.toFixed(2);
  };

  const getBalance = (market: LendingMarket) => {
    const key = `${market.chainId}-${market.assetAddress}`;
    return walletBalances[key]?.formatted || '0';
  };

  const SortButton = ({ 
    column, 
    label 
  }: { 
    column: 'apy' | 'tvl' | 'name'; 
    label: string;
  }) => (
    <button
      onClick={() => onSortChange(column)}
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
        <AlertCircle className="w-12 h-12 text-warning mx-auto mb-3" />
        <h3 className="text-lg font-semibold mb-2">Markets Unavailable</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={onRefresh} variant="outline" className="gap-2">
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
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Markets Found</h3>
        <p className="text-muted-foreground">
          No lending markets match your search criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Loading indicator for refresh */}
      {loading && markets.length > 0 && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Refreshing markets...
        </div>
      )}

      {/* Warning banner if using mock data */}
      {error && markets.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
          <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
          <span className="text-warning">{error}</span>
          <Button onClick={onRefresh} variant="ghost" size="sm" className="ml-auto gap-1 h-7">
            <RefreshCw className="w-3 h-3" />
            Retry
          </Button>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-4">
                  <SortButton column="name" label="Asset" />
                </th>
                <th className="text-right p-4">
                  <SortButton column="apy" label="Supply APY" />
                </th>
                <th className="text-right p-4">
                  <span className="text-xs font-medium text-muted-foreground">Wallet Balance</span>
                </th>
                <th className="text-right p-4">
                  <SortButton column="tvl" label="TVL" />
                </th>
                <th className="text-center p-4">
                  <span className="text-xs font-medium text-muted-foreground">Collateral</span>
                </th>
                <th className="text-right p-4"></th>
              </tr>
            </thead>
            <tbody>
              {markets.map((market, index) => (
                <motion.tr
                  key={market.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => onSupplyClick(market)}
                >
                  {/* Asset */}
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <img
                          src={market.assetLogo}
                          alt={market.assetSymbol}
                          className="w-9 h-9 rounded-full bg-muted"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
                          }}
                        />
                        <img
                          src={market.chainLogo}
                          alt={market.chainName}
                          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border border-card bg-card"
                        />
                      </div>
                      <div>
                        <div className="font-medium">{market.assetSymbol}</div>
                        <div className="text-xs text-muted-foreground">{market.chainName}</div>
                      </div>
                    </div>
                  </td>

                  {/* Supply APY */}
                  <td className="p-4 text-right">
                    <div className="font-semibold text-lg text-primary">
                      {formatAPY(market.supplyAPY)}
                    </div>
                    {market.isVariable && (
                      <div className="text-[10px] text-muted-foreground">Variable</div>
                    )}
                  </td>

                  {/* Wallet Balance */}
                  <td className="p-4 text-right">
                    <div className="text-sm">
                      {parseFloat(getBalance(market)).toFixed(4)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {market.assetSymbol}
                    </div>
                  </td>

                  {/* TVL */}
                  <td className="p-4 text-right">
                    <div className="text-sm font-medium">
                      {formatTVL(market.tvl, market.assetSymbol)}
                    </div>
                  </td>

                  {/* Collateral */}
                  <td className="p-4 text-center">
                    {market.collateralEnabled ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px]">
                        Yes
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-[10px]">
                        No
                      </Badge>
                    )}
                  </td>

                  {/* Action */}
                  <td className="p-4 text-right">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSupplyClick(market);
                      }}
                      className="h-8 px-4"
                    >
                      Supply
                    </Button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {markets.map((market, index) => (
          <motion.div
            key={market.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
            className="glass rounded-xl p-4 hover:bg-muted/20 transition-colors"
            onClick={() => onSupplyClick(market)}
          >
            <div className="flex items-center justify-between gap-3">
              {/* Asset info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative flex-shrink-0">
                  <img
                    src={market.assetLogo}
                    alt={market.assetSymbol}
                    className="w-10 h-10 rounded-full bg-muted"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
                    }}
                  />
                  <img
                    src={market.chainLogo}
                    alt={market.chainName}
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border border-card bg-card"
                  />
                </div>
                <div className="min-w-0">
                  <div className="font-medium">{market.assetSymbol}</div>
                  <div className="text-xs text-muted-foreground">{market.chainName}</div>
                </div>
              </div>

              {/* APY */}
              <div className="text-right">
                <div className="font-semibold text-lg text-primary">
                  {formatAPY(market.supplyAPY)}
                </div>
                <div className="text-[10px] text-muted-foreground">APY</div>
              </div>
            </div>

            {/* Bottom row */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
              <div className="text-sm">
                <span className="text-muted-foreground">Balance: </span>
                <span>{parseFloat(getBalance(market)).toFixed(4)}</span>
              </div>
              <Button size="sm" className="h-8 px-4">
                Supply
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
