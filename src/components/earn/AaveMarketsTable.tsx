/**
 * Aave V3 Markets Table — Aave-style layout
 * 
 * Shows supply and borrow sections with on-chain reserve data.
 * Matches app.aave.com UX: borrow tab shows all borrowable assets
 * with "supply collateral first" banner, swap CTAs.
 */

import { useState, useMemo, memo, useCallback } from 'react';
import { openSwapIntent } from '@/lib/swapIntent';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpDown,
  Loader2,
  RefreshCw,
  AlertCircle,
  Search,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  Repeat,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ChainIcon } from '@/components/common/ChainIcon';
import { TokenIcon } from '@/components/common/TokenIcon';
import type { LendingMarket } from '@/hooks/useLendingMarkets';

interface AaveMarketsTableProps {
  markets: LendingMarket[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSupply?: (market: LendingMarket) => void;
  onBorrow?: (market: LendingMarket) => void;
  onDetails?: (market: LendingMarket) => void;
  walletBalances?: Record<string, number>;
  hasCollateral?: boolean;
}

function formatAPY(apy: number): string {
  if (!Number.isFinite(apy) || apy === 0) return '0.00%';
  if (apy < 0.01) return '<0.01%';
  if (apy > 100) return `${apy.toFixed(1)}%`;
  return `${apy.toFixed(2)}%`;
}

function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (value === 0) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatPrice(value: number): string {
  if (value >= 10000) return `$${value.toFixed(0)}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
}

type SortKey = 'supplyAPY' | 'borrowAPY' | 'tvl' | 'priceUsd' | 'availableLiquidityUsd';

// ============================================
// DETAIL PANEL (expanded row)
// ============================================

const ReserveDetails = memo(function ReserveDetails({ market }: { market: LendingMarket }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="px-4 pb-4 pt-1">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="glass rounded-lg p-2.5">
            <div className="text-muted-foreground mb-0.5">Oracle Price</div>
            <div className="font-medium">{market.priceUsd > 0 ? formatPrice(market.priceUsd) : '—'}</div>
          </div>
          <div className="glass rounded-lg p-2.5">
            <div className="text-muted-foreground mb-0.5">LTV</div>
            <div className="font-medium">{market.ltv > 0 ? `${market.ltv.toFixed(0)}%` : '—'}</div>
          </div>
          <div className="glass rounded-lg p-2.5">
            <div className="text-muted-foreground mb-0.5">Liquidation Threshold</div>
            <div className="font-medium">{market.liquidationThreshold > 0 ? `${market.liquidationThreshold.toFixed(0)}%` : '—'}</div>
          </div>
          <div className="glass rounded-lg p-2.5">
            <div className="text-muted-foreground mb-0.5">Liquidation Bonus</div>
            <div className="font-medium">{market.liquidationBonus > 0 ? `${market.liquidationBonus.toFixed(1)}%` : '—'}</div>
          </div>
          <div className="glass rounded-lg p-2.5">
            <div className="text-muted-foreground mb-0.5">Utilization Rate</div>
            <div className="font-medium">{market.utilizationRate.toFixed(1)}%</div>
          </div>
          <div className="glass rounded-lg p-2.5">
            <div className="text-muted-foreground mb-0.5">Reserve Factor</div>
            <div className="font-medium">{market.reserveFactor > 0 ? `${market.reserveFactor.toFixed(0)}%` : '—'}</div>
          </div>
          <div className="glass rounded-lg p-2.5">
            <div className="text-muted-foreground mb-0.5">Supply Cap</div>
            <div className="font-medium">{market.supplyCap > 0 ? market.supplyCap.toLocaleString() : '∞'}</div>
          </div>
          <div className="glass rounded-lg p-2.5">
            <div className="text-muted-foreground mb-0.5">Borrow Cap</div>
            <div className="font-medium">{market.borrowCap > 0 ? market.borrowCap.toLocaleString() : '∞'}</div>
          </div>
          {market.eModeCategoryId > 0 && (
            <div className="glass rounded-lg p-2.5">
              <div className="text-muted-foreground mb-0.5">E-Mode Category</div>
              <div className="font-medium">{market.eModeCategoryId}</div>
            </div>
          )}
          <div className="glass rounded-lg p-2.5">
            <div className="text-muted-foreground mb-0.5">Total Supply</div>
            <div className="font-medium">{formatUsd(market.totalSupplyUsd)}</div>
          </div>
          <div className="glass rounded-lg p-2.5">
            <div className="text-muted-foreground mb-0.5">Total Borrow</div>
            <div className="font-medium">{formatUsd(market.totalBorrowUsd)}</div>
          </div>
          <div className="glass rounded-lg p-2.5">
            <div className="text-muted-foreground mb-0.5">Available Liquidity</div>
            <div className="font-medium">{formatUsd(market.availableLiquidityUsd)}</div>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {market.isFrozen && <Badge variant="outline" className="text-destructive border-destructive/30">Frozen</Badge>}
          {market.isPaused && <Badge variant="outline" className="text-destructive border-destructive/30">Paused</Badge>}
          {!market.borrowingEnabled && <Badge variant="outline" className="text-muted-foreground">Borrow Disabled</Badge>}
          <a href={market.protocolUrl} target="_blank" rel="noopener noreferrer"
            className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
            View on Aave <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </motion.div>
  );
});

// ============================================
// SUPPLY ROW
// ============================================

const SupplyRow = memo(function SupplyRow({
  market, onSupply, onSwap, expanded, onToggle, walletBalanceUsd,
}: {
  market: LendingMarket;
  onSupply?: (m: LendingMarket) => void;
  onSwap?: (m: LendingMarket) => void;
  expanded: boolean;
  onToggle: () => void;
  walletBalanceUsd?: number;
}) {
  return (
    <>
      <tr className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer"
        onClick={onToggle}>
        <td className="p-3">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <TokenIcon address={market.assetAddress} symbol={market.assetSymbol} chainId={market.chainId}
                logoUrl={market.assetLogo} size="sm"
                className="w-7 h-7" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-background overflow-hidden">
                <ChainIcon chainId={market.chainId} size="sm" />
              </div>
            </div>
            <div>
              <div className="font-medium text-sm">{market.assetSymbol}</div>
              <div className="text-[11px] text-muted-foreground">{market.chainName}</div>
            </div>
          </div>
        </td>
        <td className="p-3 text-right">
          <span className={cn("font-medium text-sm", market.supplyAPY > 0 ? "text-success" : "text-muted-foreground")}>
            {formatAPY(market.supplyAPY)}
          </span>
        </td>
        <td className="p-3 text-right hidden md:table-cell">
          <span className="text-sm">{formatUsd(market.tvl)}</span>
        </td>
        <td className="p-3 text-center hidden lg:table-cell">
          {market.collateralEnabled ? (
            <ShieldCheck className="w-4 h-4 text-success mx-auto" />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
        <td className="p-3 text-right hidden lg:table-cell">
          {walletBalanceUsd && walletBalanceUsd > 0 ? (
            <span className="text-sm font-medium text-foreground">{formatUsd(walletBalanceUsd)}</span>
          ) : (
            <span className="text-xs text-muted-foreground">0</span>
          )}
        </td>
        <td className="p-3 text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <Button size="sm" variant="outline" className="h-7 px-3 text-xs gap-1"
              onClick={(e) => { e.stopPropagation(); onSupply?.(market); }}>
              <ArrowUpRight className="w-3 h-3" />
              Supply
            </Button>
            {(!walletBalanceUsd || walletBalanceUsd === 0) && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 text-primary"
                onClick={(e) => { e.stopPropagation(); onSwap?.(market); }}>
                <Repeat className="w-3 h-3" /> Get
              </Button>
            )}
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
        </td>
      </tr>
      <AnimatePresence>
        {expanded && (
          <tr><td colSpan={6}>
            <ReserveDetails market={market} />
          </td></tr>
        )}
      </AnimatePresence>
    </>
  );
});

// ============================================
// BORROW ROW
// ============================================

const BorrowRow = memo(function BorrowRow({
  market, onBorrow, hasCollateral, expanded, onToggle,
}: {
  market: LendingMarket;
  onBorrow?: (m: LendingMarket) => void;
  hasCollateral: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer"
        onClick={onToggle}>
        <td className="p-3">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <TokenIcon address={market.assetAddress} symbol={market.assetSymbol} chainId={market.chainId}
                logoUrl={market.assetLogo} size="sm"
                className="w-7 h-7" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-background overflow-hidden">
                <ChainIcon chainId={market.chainId} size="sm" />
              </div>
            </div>
            <div>
              <div className="font-medium text-sm">{market.assetSymbol}</div>
              <div className="text-[11px] text-muted-foreground">{market.chainName}</div>
            </div>
          </div>
        </td>
        <td className="p-3 text-right">
          <div>
            <div className="text-xs text-muted-foreground">Available to borrow</div>
            <div className="text-sm font-medium">
              {hasCollateral ? formatUsd(market.availableLiquidityUsd) : '0'}
            </div>
          </div>
        </td>
        <td className="p-3 text-right hidden md:table-cell">
          <div>
            <div className="text-xs text-muted-foreground">APY, variable</div>
            <span className="font-medium text-sm text-warning">
              {formatAPY(market.borrowAPY)}
            </span>
          </div>
        </td>
        <td className="p-3 text-right hidden lg:table-cell">
          <span className="text-sm">{market.utilizationRate.toFixed(1)}%</span>
        </td>
        <td className="p-3 text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <Button size="sm" variant="outline" className="h-7 px-3 text-xs gap-1"
              disabled={!hasCollateral || !market.borrowingEnabled || market.isFrozen}
              onClick={(e) => { e.stopPropagation(); onBorrow?.(market); }}>
              <ArrowDownLeft className="w-3 h-3" />
              Borrow
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
              onClick={(e) => { e.stopPropagation(); onToggle(); }}>
              Details
            </Button>
          </div>
        </td>
      </tr>
      <AnimatePresence>
        {expanded && (
          <tr><td colSpan={6}>
            <ReserveDetails market={market} />
          </td></tr>
        )}
      </AnimatePresence>
    </>
  );
});

// ============================================
// MOBILE CARD
// ============================================

const MobileCard = memo(function MobileCard({
  market, onSupply, onBorrow, onSwap, mode, hasCollateral, walletBalanceUsd,
}: {
  market: LendingMarket;
  onSupply?: (m: LendingMarket) => void;
  onBorrow?: (m: LendingMarket) => void;
  onSwap?: (m: LendingMarket) => void;
  mode: 'supply' | 'borrow';
  hasCollateral: boolean;
  walletBalanceUsd?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass rounded-xl p-3.5" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="relative">
          <TokenIcon address={market.assetAddress} symbol={market.assetSymbol} chainId={market.chainId}
            logoUrl={market.assetLogo} size="sm"
            className="w-8 h-8" />
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-background overflow-hidden">
            <ChainIcon chainId={market.chainId} size="sm" />
          </div>
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">{market.assetSymbol}</div>
          <div className="text-[11px] text-muted-foreground">{market.chainName}</div>
        </div>
        <div className="text-right">
          <div className={cn("text-sm font-medium", mode === 'supply' ? "text-success" : "text-warning")}>
            {mode === 'supply' ? formatAPY(market.supplyAPY) : formatAPY(market.borrowAPY)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {mode === 'supply' ? 'Supply APY' : 'APY, variable'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2.5 text-xs">
        <div>
          <div className="text-muted-foreground">{mode === 'supply' ? 'Total Size' : 'Available'}</div>
          <div className="font-medium">
            {mode === 'supply' ? formatUsd(market.tvl) : (hasCollateral ? formatUsd(market.availableLiquidityUsd) : '0')}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Price</div>
          <div className="font-medium">{market.priceUsd > 0 ? formatPrice(market.priceUsd) : '—'}</div>
        </div>
        <div>
          <div className="text-muted-foreground">{mode === 'supply' ? 'Wallet' : 'Utilization'}</div>
          <div className="font-medium">
            {mode === 'supply'
              ? (walletBalanceUsd && walletBalanceUsd > 0 ? `$${walletBalanceUsd.toFixed(2)}` : '0')
              : `${market.utilizationRate.toFixed(0)}%`}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-2.5"
          >
            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/30">
              <div><span className="text-muted-foreground">LTV:</span> {market.ltv > 0 ? `${market.ltv.toFixed(0)}%` : '—'}</div>
              <div><span className="text-muted-foreground">Liq. Threshold:</span> {market.liquidationThreshold > 0 ? `${market.liquidationThreshold.toFixed(0)}%` : '—'}</div>
              <div><span className="text-muted-foreground">Reserve Factor:</span> {market.reserveFactor > 0 ? `${market.reserveFactor.toFixed(0)}%` : '—'}</div>
              <div><span className="text-muted-foreground">Liq. Bonus:</span> {market.liquidationBonus > 0 ? `${market.liquidationBonus.toFixed(1)}%` : '—'}</div>
              <div><span className="text-muted-foreground">Supply Cap:</span> {market.supplyCap > 0 ? market.supplyCap.toLocaleString() : '∞'}</div>
              <div><span className="text-muted-foreground">Borrow Cap:</span> {market.borrowCap > 0 ? market.borrowCap.toLocaleString() : '∞'}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-8 text-xs gap-1"
          disabled={mode === 'borrow' && (!hasCollateral || !market.borrowingEnabled || market.isFrozen)}
          onClick={(e) => {
            e.stopPropagation();
            mode === 'supply' ? onSupply?.(market) : onBorrow?.(market);
          }}
        >
          {mode === 'supply' ? (
            <><ArrowUpRight className="w-3 h-3" /> Supply</>
          ) : (
            <><ArrowDownLeft className="w-3 h-3" /> Borrow</>
          )}
        </Button>
        {mode === 'supply' && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs gap-1 text-primary"
            onClick={(e) => { e.stopPropagation(); onSwap?.(market); }}
          >
            <Repeat className="w-3 h-3" /> Get via Swap
          </Button>
        )}
      </div>
    </div>
  );
});

// ============================================
// MAIN COMPONENT
// ============================================

export function AaveMarketsTable({
  markets,
  loading,
  error,
  onRefresh,
  onSupply,
  onBorrow,
  hasCollateral = false,
  walletBalances,
}: AaveMarketsTableProps) {
  const navigate = undefined; // removed — using openSwapIntent instead
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('tvl');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [marketMode, setMarketMode] = useState<'supply' | 'borrow'>('supply');

  const handleSort = useCallback((key: SortKey) => {
    if (sortBy === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  }, [sortBy]);

  const handleSwapForToken = useCallback((market: LendingMarket) => {
    openSwapIntent({
      intentType: 'acquire_token',
      targetChainId: market.chainId,
      targetTokenAddress: market.assetAddress,
      targetSymbol: market.assetSymbol,
      returnTo: { view: 'earn', tab: 'markets', marketId: market.id },
    });
  }, []);

  const filtered = useMemo(() => {
    let result = [...markets].filter(m => m.isActive);
    // For borrow: show ALL borrowable assets (even without collateral) — like Aave does
    if (marketMode === 'borrow') {
      result = result.filter(m => m.borrowingEnabled && !m.isFrozen);
    }
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
        case 'priceUsd': cmp = a.priceUsd - b.priceUsd; break;
        case 'availableLiquidityUsd': cmp = a.availableLiquidityUsd - b.availableLiquidityUsd; break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return result;
  }, [markets, searchQuery, sortBy, sortDir, marketMode]);

  const SortBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button onClick={() => handleSort(col)}
      className={cn("flex items-center gap-1 text-xs font-medium transition-colors whitespace-nowrap",
        sortBy === col ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
      {label}
      <ArrowUpDown className={cn("w-3 h-3", sortBy === col && sortDir === 'desc' && "rotate-180")} />
    </button>
  );

  if (loading && markets.length === 0) {
    return (
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-7 w-16" />
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
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button onClick={onRefresh} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Supply / Borrow toggle */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <Tabs value={marketMode} onValueChange={(v) => setMarketMode(v as 'supply' | 'borrow')}>
          <TabsList className="h-9">
            <TabsTrigger value="supply" className="text-xs gap-1.5 px-4">
              <ArrowUpRight className="w-3.5 h-3.5" />
              Assets to Supply
            </TabsTrigger>
            <TabsTrigger value="borrow" className="text-xs gap-1.5 px-4">
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Assets to Borrow
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search token or chain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9 bg-muted/30 border-border/50 text-sm"
          />
        </div>
      </div>

      {/* Borrow info banner — like Aave */}
      {marketMode === 'borrow' && !hasCollateral && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-primary/10 border border-primary/20">
          <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-foreground">
              To borrow you need to supply any asset to be used as collateral.
            </p>
          </div>
        </div>
      )}

      {/* Count + status */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{filtered.length} {marketMode === 'supply' ? 'assets' : 'borrowable assets'}</span>
        {loading && (
          <span className="flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Refreshing...
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <Info className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No markets match your search.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block glass rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-3"><span className="text-xs font-medium text-muted-foreground">Asset</span></th>
                  {marketMode === 'supply' ? (
                    <>
                      <th className="text-right p-3"><SortBtn col="supplyAPY" label="Supply APY" /></th>
                      <th className="text-right p-3 hidden md:table-cell"><SortBtn col="tvl" label="Total Market Size" /></th>
                      <th className="text-center p-3 hidden lg:table-cell"><span className="text-xs font-medium text-muted-foreground">Collateral</span></th>
                      <th className="text-right p-3 hidden lg:table-cell"><span className="text-xs font-medium text-muted-foreground">Wallet</span></th>
                    </>
                  ) : (
                    <>
                      <th className="text-right p-3"><span className="text-xs font-medium text-muted-foreground">Available</span></th>
                      <th className="text-right p-3 hidden md:table-cell"><span className="text-xs font-medium text-muted-foreground">APY, variable</span></th>
                      <th className="text-right p-3 hidden lg:table-cell"><span className="text-xs font-medium text-muted-foreground">Utilization</span></th>
                    </>
                  )}
                  <th className="text-right p-3 w-44"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(market => (
                  marketMode === 'supply' ? (
                    <SupplyRow
                      key={market.id}
                      market={market}
                      onSupply={onSupply}
                      onSwap={handleSwapForToken}
                      expanded={expandedId === market.id}
                      onToggle={() => setExpandedId(expandedId === market.id ? null : market.id)}
                      walletBalanceUsd={walletBalances?.[`${market.chainId}:${market.assetAddress.toLowerCase()}`]}
                    />
                  ) : (
                    <BorrowRow
                      key={market.id}
                      market={market}
                      onBorrow={onBorrow}
                      hasCollateral={hasCollateral}
                      expanded={expandedId === market.id}
                      onToggle={() => setExpandedId(expandedId === market.id ? null : market.id)}
                    />
                  )
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map(market => (
              <MobileCard
                key={market.id}
                market={market}
                onSupply={onSupply}
                onBorrow={onBorrow}
                onSwap={handleSwapForToken}
                mode={marketMode}
                hasCollateral={hasCollateral}
                walletBalanceUsd={walletBalances?.[`${market.chainId}:${market.assetAddress.toLowerCase()}`]}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
