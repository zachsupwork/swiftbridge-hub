/**
 * Aave V3 Markets Table
 * 
 * Displays Aave V3 lending markets with supply/borrow actions.
 * Similar aesthetic to Aave's official UI.
 */

import { useState, useMemo, memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpDown,
  Loader2,
  RefreshCw,
  AlertCircle,
  Search,
  TrendingUp,
  Wallet,
  ExternalLink,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ChainIcon } from '@/components/common/ChainIcon';
import type { LendingMarket } from '@/hooks/useLendingMarkets';

interface AaveMarketsTableProps {
  markets: LendingMarket[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSupply?: (market: LendingMarket) => void;
  onBorrow?: (market: LendingMarket) => void;
  onDetails?: (market: LendingMarket) => void;
}

function formatAPY(apy: number): string {
  if (!Number.isFinite(apy) || apy === 0) return '—';
  if (apy < 0.01) return '<0.01%';
  if (apy > 100) return `${apy.toFixed(1)}%`;
  return `${apy.toFixed(2)}%`;
}

function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value === 0) return '—';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

type SortKey = 'supplyAPY' | 'borrowAPY' | 'tvl';

const DesktopRow = memo(function DesktopRow({
  market,
  onSupply,
  onBorrow,
}: {
  market: LendingMarket;
  onSupply?: (m: LendingMarket) => void;
  onBorrow?: (m: LendingMarket) => void;
}) {
  return (
    <tr className="border-b border-border/30 hover:bg-muted/20 transition-colors">
      {/* Asset */}
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={market.assetLogo}
              alt={market.assetSymbol}
              className="w-8 h-8 rounded-full"
              onError={(e) => { (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg'; }}
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border border-background overflow-hidden">
              <ChainIcon chainId={market.chainId} size="sm" />
            </div>
          </div>
          <div>
            <div className="font-medium text-sm">{market.assetSymbol}</div>
            <div className="text-xs text-muted-foreground">{market.chainName}</div>
          </div>
        </div>
      </td>
      {/* Supply APY */}
      <td className="p-4 text-right">
        <span className={cn("font-medium text-sm", market.supplyAPY > 0 ? "text-success" : "text-muted-foreground")}>
          {formatAPY(market.supplyAPY)}
        </span>
      </td>
      {/* Borrow APY */}
      <td className="p-4 text-right">
        <span className="font-medium text-sm text-warning">
          {formatAPY(market.borrowAPY)}
        </span>
      </td>
      {/* TVL */}
      <td className="p-4 text-right">
        <span className="text-sm">{formatUsd(market.tvl)}</span>
      </td>
      {/* Collateral */}
      <td className="p-4 text-center">
        {market.collateralEnabled ? (
          <ShieldCheck className="w-4 h-4 text-success mx-auto" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      {/* Actions */}
      <td className="p-4 text-right">
        <div className="flex items-center gap-1.5 justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs gap-1"
            onClick={() => onSupply?.(market)}
          >
            <ArrowUpRight className="w-3 h-3" />
            Supply
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-3 text-xs gap-1"
            onClick={() => onBorrow?.(market)}
          >
            <ArrowDownLeft className="w-3 h-3" />
            Borrow
          </Button>
          <a
            href={market.protocolUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted/50 transition-colors"
          >
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
          </a>
        </div>
      </td>
    </tr>
  );
});

const MobileCard = memo(function MobileCard({
  market,
  onSupply,
  onBorrow,
}: {
  market: LendingMarket;
  onSupply?: (m: LendingMarket) => void;
  onBorrow?: (m: LendingMarket) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <img
            src={market.assetLogo}
            alt={market.assetSymbol}
            className="w-9 h-9 rounded-full"
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg'; }}
          />
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border border-background overflow-hidden">
            <ChainIcon chainId={market.chainId} size="sm" />
          </div>
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">{market.assetSymbol}</div>
          <div className="text-xs text-muted-foreground">{market.chainName}</div>
        </div>
        {market.collateralEnabled && (
          <Badge variant="outline" className="h-5 text-[10px] gap-1 border-success/30 text-success">
            <ShieldCheck className="w-3 h-3" />
            Collateral
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <div className="text-xs text-muted-foreground">Supply APY</div>
          <div className={cn("text-sm font-medium", market.supplyAPY > 0 ? "text-success" : "text-muted-foreground")}>
            {formatAPY(market.supplyAPY)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Borrow APY</div>
          <div className="text-sm font-medium text-warning">{formatAPY(market.borrowAPY)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">TVL</div>
          <div className="text-sm font-medium">{formatUsd(market.tvl)}</div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-8 text-xs gap-1"
          onClick={() => onSupply?.(market)}
        >
          <ArrowUpRight className="w-3 h-3" />
          Supply
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="flex-1 h-8 text-xs gap-1"
          onClick={() => onBorrow?.(market)}
        >
          <ArrowDownLeft className="w-3 h-3" />
          Borrow
        </Button>
      </div>
    </motion.div>
  );
});

export function AaveMarketsTable({
  markets,
  loading,
  error,
  onRefresh,
  onSupply,
  onBorrow,
}: AaveMarketsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('tvl');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = useCallback((key: SortKey) => {
    if (sortBy === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  }, [sortBy]);

  const filtered = useMemo(() => {
    let result = [...markets];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.assetSymbol.toLowerCase().includes(q) ||
        m.assetName.toLowerCase().includes(q) ||
        m.chainName.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'supplyAPY': cmp = a.supplyAPY - b.supplyAPY; break;
        case 'borrowAPY': cmp = a.borrowAPY - b.borrowAPY; break;
        case 'tvl': cmp = (a.tvl || 0) - (b.tvl || 0); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return result;
  }, [markets, searchQuery, sortBy, sortDir]);

  const SortBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button
      onClick={() => handleSort(col)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium transition-colors whitespace-nowrap",
        sortBy === col ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      <ArrowUpDown className={cn("w-3 h-3", sortBy === col && sortDir === 'desc' && "rotate-180")} />
    </button>
  );

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

  if (error && markets.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h3 className="text-lg font-semibold mb-2">Unable to load markets</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={onRefresh} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </Button>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-lg font-semibold mb-2">No Markets Found</h3>
        <p className="text-muted-foreground">No Aave V3 markets available on this chain.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by token or chain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-muted/30 border-border/50"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-success" />
          <span>Aave V3 verified markets</span>
        </div>
      </div>

      {/* Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} market{filtered.length !== 1 ? 's' : ''}
        </p>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Refreshing...
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-4"><span className="text-xs font-medium text-muted-foreground">Asset</span></th>
                <th className="text-right p-4"><SortBtn col="supplyAPY" label="Supply APY" /></th>
                <th className="text-right p-4"><SortBtn col="borrowAPY" label="Borrow APY" /></th>
                <th className="text-right p-4"><SortBtn col="tvl" label="Total Market Size" /></th>
                <th className="text-center p-4"><span className="text-xs font-medium text-muted-foreground">Can Collateral</span></th>
                <th className="text-right p-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(market => (
                <DesktopRow
                  key={market.id}
                  market={market}
                  onSupply={onSupply}
                  onBorrow={onBorrow}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.map(market => (
          <MobileCard
            key={market.id}
            market={market}
            onSupply={onSupply}
            onBorrow={onBorrow}
          />
        ))}
      </div>
    </div>
  );
}
