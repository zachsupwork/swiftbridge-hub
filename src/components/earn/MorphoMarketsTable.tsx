/**
 * Enhanced Markets Table — Morpho Parity
 *
 * Columns aligned with app.morpho.org:
 *  Market (Collateral / Loan), LLTV, Supply APY, Borrow APR,
 *  Total Supply, Total Borrow, Liquidity, Utilization, IRM.
 *
 * Column customization persisted in localStorage.
 * Parity debug logging via ?parityDebug=true.
 *
 * Field definitions:
 *  - Utilization = TotalBorrow / TotalSupply
 *  - Market Liquidity = TotalSupply − TotalBorrow
 *  - Borrow APR = Instant Rate on LOAN asset
 *  - Supply APY = BorrowAPR × Utilization × (1 − protocolFee)
 *  - All rates are 2-decimal formatted; large values use compact notation.
 *
 * Data source: Morpho GraphQL API (api.morpho.org/graphql)
 * Reference parity markets: WETH / wstETH, sUSDe / USDtb
 */

import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowUpDown,
  Loader2,
  RefreshCw,
  AlertCircle,
  Search,
  TrendingUp,
  Wallet,
  Info,
  ShieldAlert,
  Copy,
  Check,
  Settings2,
  ExternalLink,
  HelpCircle,
} from 'lucide-react';
import { useState, useMemo, useCallback, memo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { MorphoMarket } from '@/lib/morpho/types';
import { getMorphoChainConfig } from '@/lib/morpho/config';
import { isMarketTrusted, sortMarkets } from '@/hooks/useMorphoMarkets';
import { getExplorerAddressUrl } from '@/lib/wagmiConfig';

interface MorphoMarketsTableProps {
  markets: MorphoMarket[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSupply?: (market: MorphoMarket) => void;
  onBorrow?: (market: MorphoMarket) => void;
  onMarketDetails?: (market: MorphoMarket) => void;
}

/* ─── Column visibility (persisted) ─── */
interface ColumnVisibility {
  totalBorrow: boolean;
  liquidity: boolean;
  irm: boolean;
}

const COLUMN_KEY = 'morpho-columns-v1';

function loadColumns(): ColumnVisibility {
  try {
    const raw = localStorage.getItem(COLUMN_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { totalBorrow: false, liquidity: false, irm: false };
}

function saveColumns(cols: ColumnVisibility) {
  try { localStorage.setItem(COLUMN_KEY, JSON.stringify(cols)); } catch { /* ignore */ }
}

/* ─── APY helpers ─── */
function normalizeAPY(apy: number): number {
  if (!Number.isFinite(apy) || apy === 0) return 0;
  if (apy > 0 && apy <= 1.5) return apy * 100;
  return apy;
}

function formatAPY(apy: number): string {
  const n = normalizeAPY(apy);
  if (!Number.isFinite(n) || n === 0) return '—';
  if (n < 0.01) return '<0.01%';
  if (n > 100) return `${n.toFixed(1)}%`;
  return `${n.toFixed(2)}%`;
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '—';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatTokenAmount(amount: number, symbol: string): string {
  if (!Number.isFinite(amount) || amount === 0) return '—';
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M ${symbol}`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K ${symbol}`;
  if (amount >= 1) return `${amount.toFixed(2)} ${symbol}`;
  return `${amount.toFixed(4)} ${symbol}`;
}

function formatUtilization(util: number): string {
  if (!Number.isFinite(util)) return '—';
  return `${util.toFixed(1)}%`;
}

function truncAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/* ─── Parity debug logging ─── */
function runParityDebug(markets: MorphoMarket[]) {
  const refPairs = [
    ['wstETH', 'WETH'],
    ['USDtb', 'sUSDe'],
    ['sUSDe', 'USDtb'],
  ];

  markets.forEach(m => {
    const collSym = m.collateralAsset?.symbol || '';
    const loanSym = m.loanAsset.symbol;
    const isRef = refPairs.some(([c, l]) => collSym === c && loanSym === l);

    const computedUtil = m.totalSupplyUsd > 0
      ? (m.totalBorrowUsd / m.totalSupplyUsd) * 100
      : 0;
    const computedLiq = m.totalSupplyUsd - m.totalBorrowUsd;
    const utilDiff = Math.abs(computedUtil - m.utilization);
    const liqDiff = Math.abs(computedLiq - m.availableLiquidityUsd);

    if (isRef || utilDiff > 2 || liqDiff > m.totalSupplyUsd * 0.05) {
      console.log(
        `[Morpho Parity] ${collSym}/${loanSym}`,
        JSON.stringify({
          TotalSupply: m.totalSupplyUsd,
          TotalBorrow: m.totalBorrowUsd,
          Utilization: m.utilization,
          ComputedUtil: computedUtil,
          UtilDiff: utilDiff.toFixed(2),
          Liquidity: m.availableLiquidityUsd,
          ComputedLiq: computedLiq,
          InstantRate: m.borrowApy,
          SupplyAPY: m.supplyApy,
          Fee: m.fee,
        }, null, 2)
      );

      if (utilDiff > 2) {
        console.warn(`[Morpho Parity] ⚠ Utilization mismatch: API=${m.utilization.toFixed(2)}%, Computed=${computedUtil.toFixed(2)}%`);
      }
    }
  });
}

/* ─── Component ─── */
export function MorphoMarketsTable({
  markets,
  loading,
  error,
  onRefresh,
  onSupply,
  onBorrow,
  onMarketDetails,
}: MorphoMarketsTableProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parityDebug = searchParams.get('parityDebug') === 'true';

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'supplyApy' | 'tvl' | 'utilization' | 'borrowApy'>('tvl');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columns, setColumns] = useState<ColumnVisibility>(loadColumns);
  const [copiedIrm, setCopiedIrm] = useState<string | null>(null);

  // Persist column visibility
  useEffect(() => { saveColumns(columns); }, [columns]);

  // Parity debug
  useEffect(() => {
    if (parityDebug && markets.length > 0) {
      runParityDebug(markets);
    }
  }, [parityDebug, markets]);

  // Filter and sort
  const filteredMarkets = useMemo(() => {
    let result = sortMarkets(markets).map(m => ({
      ...m,
      normalizedSupplyApy: normalizeAPY(m.supplyApy),
      normalizedBorrowApy: normalizeAPY(m.borrowApy),
    }));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.loanAsset.symbol.toLowerCase().includes(q) ||
        m.loanAsset.name.toLowerCase().includes(q) ||
        (m.collateralAsset?.symbol.toLowerCase().includes(q))
      );
    }

    if (sortBy !== 'tvl' || sortDirection !== 'desc') {
      const verified = result.filter(m => isMarketTrusted(m));
      const unverified = result.filter(m => !isMarketTrusted(m));

      const sorter = (a: typeof result[0], b: typeof result[0]) => {
        let cmp = 0;
        switch (sortBy) {
          case 'supplyApy': cmp = a.normalizedSupplyApy - b.normalizedSupplyApy; break;
          case 'borrowApy': cmp = a.normalizedBorrowApy - b.normalizedBorrowApy; break;
          case 'tvl': cmp = a.totalSupplyUsd - b.totalSupplyUsd; break;
          case 'utilization': cmp = a.utilization - b.utilization; break;
        }
        return sortDirection === 'desc' ? -cmp : cmp;
      };

      verified.sort(sorter);
      unverified.sort(sorter);
      result = [...verified, ...unverified];
    }

    return result;
  }, [markets, searchQuery, sortBy, sortDirection]);

  const handleSortChange = useCallback((column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection(column === 'supplyApy' ? 'asc' : 'desc');
    }
  }, [sortBy]);

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIrm(id);
    setTimeout(() => setCopiedIrm(null), 1500);
  }, []);

  const SortButton = memo(function SortButton({ column, label }: { column: typeof sortBy; label: string }) {
    return (
      <button
        onClick={() => handleSortChange(column)}
        className={cn(
          "flex items-center gap-1 text-xs font-medium transition-colors whitespace-nowrap",
          sortBy === column ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {label}
        <ArrowUpDown className={cn("w-3 h-3", sortBy === column && sortDirection === 'desc' && "rotate-180")} />
      </button>
    );
  });

  // Loading / Error / Empty states
  if (loading && markets.length === 0) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={`skeleton-${i}`} className="glass rounded-xl p-4 animate-pulse">
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

  if (markets.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-lg font-semibold mb-2">No Markets Found</h3>
        <p className="text-muted-foreground">No Morpho markets available on this chain.</p>
      </div>
    );
  }

  // Count extra visible columns for colSpan
  const extraCols = (columns.totalBorrow ? 1 : 0) + (columns.liquidity ? 1 : 0) + (columns.irm ? 1 : 0);
  const totalDesktopCols = 6 + extraCols; // Market + SupplyAPY + BorrowAPR + TotalSupply + Utilization + Actions + extras

  return (
    <div className="space-y-4">
      {/* Search + Column customization */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by token symbol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-muted/30 border-border/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
                <Settings2 className="w-3.5 h-3.5" />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="end">
              <p className="text-xs font-medium text-muted-foreground mb-3">Show / Hide Columns</p>
              <div className="space-y-3">
                {([
                  ['totalBorrow', 'Total Borrow'],
                  ['liquidity', 'Liquidity'],
                  ['irm', 'IRM Address'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label htmlFor={`col-${key}`} className="text-sm">{label}</Label>
                    <Switch
                      id={`col-${key}`}
                      checked={columns[key]}
                      onCheckedChange={(v) => setColumns(prev => ({ ...prev, [key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="w-3.5 h-3.5 text-success" />
            <span className="hidden sm:inline">Verified markets prioritized • Sorted by TVL &amp; APY</span>
          </div>
        </div>
      </div>

      {/* Rate tooltip note */}
      <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p><strong>Collateral / Loan</strong> — rates apply to the <strong>Loan</strong> asset. Supply the loan asset to earn APY.</p>
            <p><strong>Borrow:</strong> Deposit collateral first, then borrow the loan asset. Max borrow depends on LLTV.</p>
          </div>
        </div>
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

      {/* Parity debug banner */}
      {parityDebug && (
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-xs text-warning">
          <strong>⚡ Parity Debug Mode</strong> — Check browser console for formula validation logs. Reference markets: WETH/wstETH, sUSDe/USDtb.
        </div>
      )}

      {/* ─── Desktop Table ─── */}
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
                  <SortButton column="borrowApy" label="Borrow APR" />
                </th>
                <th className="text-right p-4">
                  <SortButton column="tvl" label="Total Supply" />
                </th>
                {columns.totalBorrow && (
                  <th className="text-right p-4">
                    <span className="text-xs font-medium text-muted-foreground">Total Borrow</span>
                  </th>
                )}
                {columns.liquidity && (
                  <th className="text-right p-4">
                    <span className="text-xs font-medium text-muted-foreground">Liquidity</span>
                  </th>
                )}
                <th className="text-right p-4">
                  <SortButton column="utilization" label="Utilization" />
                </th>
                {columns.irm && (
                  <th className="text-right p-4">
                    <span className="text-xs font-medium text-muted-foreground">IRM</span>
                  </th>
                )}
                <th className="text-right p-4"></th>
              </tr>
            </thead>
            <tbody>
              {filteredMarkets.map((market, index) => {
                const trusted = isMarketTrusted(market);
                const prevTrusted = index > 0 ? isMarketTrusted(filteredMarkets[index - 1]) : true;
                const showDivider = !trusted && prevTrusted;

                return (
                  <DesktopRow
                    key={`${market.chainId}-${market.id}`}
                    market={market}
                    index={index}
                    trusted={trusted}
                    showDivider={showDivider}
                    columns={columns}
                    totalDesktopCols={totalDesktopCols}
                    copiedIrm={copiedIrm}
                    onSupply={onSupply}
                    onBorrow={onBorrow}
                    onMarketDetails={onMarketDetails}
                    onCopy={copyToClipboard}
                    navigate={navigate}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Mobile Cards ─── */}
      <div className="md:hidden space-y-2">
        {filteredMarkets.map((market, index) => {
          const trusted = isMarketTrusted(market);
          const prevTrusted = index > 0 ? isMarketTrusted(filteredMarkets[index - 1]) : true;
          const showDivider = !trusted && prevTrusted;

          return (
            <div key={`mobile-${market.chainId}-${market.id}`}>
              {showDivider && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-3 mt-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-warning" />
                  <span className="font-medium">Unverified / Higher Risk Markets</span>
                </div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.3) }}
                className={cn("glass rounded-xl p-4", !trusted && "opacity-60")}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div
                    className="cursor-pointer hover:text-primary transition-colors flex-1"
                    onClick={() => navigate(`/market/${market.uniqueKey || market.id}`)}
                  >
                    <div className="font-medium flex items-center gap-1.5 flex-wrap">
                      {market.collateralAsset ? (
                        <>
                          {market.collateralAsset.symbol}
                          <span className="text-muted-foreground font-normal">/ {market.loanAsset.symbol}</span>
                        </>
                      ) : (
                        market.loanAsset.symbol
                      )}
                      {!trusted && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-warning/10 text-warning border-warning/30 gap-0.5">
                          <ShieldAlert className="w-2.5 h-2.5" />
                          Unverified
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">LLTV: {market.lltv.toFixed(0)}%</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-lg text-success">{formatAPY(market.supplyApy)}</div>
                    <div className="text-[10px] text-muted-foreground">Supply APY</div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between pt-3 border-t border-border/30">
                  <div className="grid grid-cols-3 gap-3 text-sm flex-1">
                    <div>
                      <span className="text-muted-foreground text-xs">TVL </span>
                      <span className="font-medium text-xs">{formatUsd(market.totalSupplyUsd)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Borrow </span>
                      <span className="font-medium text-xs text-warning">{formatAPY(market.borrowApy)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Util </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs h-5",
                          market.utilization > 90 ? "bg-destructive/10 text-destructive border-destructive/30" :
                          market.utilization > 70 ? "bg-warning/10 text-warning border-warning/30" :
                          "bg-muted/50"
                        )}
                      >
                        {formatUtilization(market.utilization)}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => onSupply?.(market)} className="flex-1 h-9 gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Supply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onBorrow?.(market)}
                    className="flex-1 h-9 gap-1"
                    disabled={!market.collateralAsset}
                  >
                    <Wallet className="w-3 h-3" />
                    Borrow
                  </Button>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Desktop Row (extracted to avoid inline fragments) ─── */
interface DesktopRowProps {
  market: MorphoMarket & { normalizedSupplyApy: number; normalizedBorrowApy: number };
  index: number;
  trusted: boolean;
  showDivider: boolean;
  columns: ColumnVisibility;
  totalDesktopCols: number;
  copiedIrm: string | null;
  onSupply?: (m: MorphoMarket) => void;
  onBorrow?: (m: MorphoMarket) => void;
  onMarketDetails?: (m: MorphoMarket) => void;
  onCopy: (text: string, id: string) => void;
  navigate: ReturnType<typeof useNavigate>;
}

const DesktopRow = memo(function DesktopRow({
  market, index, trusted, showDivider, columns, totalDesktopCols,
  copiedIrm, onSupply, onBorrow, onMarketDetails, onCopy, navigate,
}: DesktopRowProps) {
  return (
    <>
      {showDivider && (
        <tr key={`unverified-divider-${index}`}>
          <td colSpan={totalDesktopCols} className="px-4 py-3 bg-muted/20 border-y border-border/40">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="w-3.5 h-3.5 text-warning" />
              <span className="font-medium">Unverified / Higher Risk Markets</span>
            </div>
          </td>
        </tr>
      )}
      <motion.tr
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.02, 0.3) }}
        className={cn(
          "border-b border-border/30 hover:bg-muted/20 transition-colors",
          !trusted && "opacity-60"
        )}
      >
        {/* Market pair — Collateral / Loan */}
        <td className="p-4">
          <div
            className="cursor-pointer hover:text-primary transition-colors"
            onClick={() => navigate(`/market/${market.uniqueKey || market.id}`)}
          >
            <div className="font-medium flex items-center gap-1.5">
              {market.collateralAsset ? (
                <>
                  {market.collateralAsset.symbol}
                  <span className="text-muted-foreground font-normal">/ {market.loanAsset.symbol}</span>
                </>
              ) : (
                market.loanAsset.symbol
              )}
              {!trusted && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-warning/10 text-warning border-warning/30 gap-0.5">
                  <ShieldAlert className="w-2.5 h-2.5" />
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">LLTV: {market.lltv.toFixed(0)}%</div>
          </div>
        </td>

        {/* Supply APY */}
        <td className="p-4 text-right">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-semibold text-lg text-success cursor-default">{formatAPY(market.supplyApy)}</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[220px]">
                Rates apply to the LOAN asset ({market.loanAsset.symbol}). Fee: {market.fee.toFixed(1)}%.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </td>

        {/* Borrow APR */}
        <td className="p-4 text-right">
          <span className="text-sm text-warning">{formatAPY(market.borrowApy)}</span>
        </td>

        {/* Total Supply */}
        <td className="p-4 text-right">
          <div className="text-sm font-medium">{formatUsd(market.totalSupplyUsd)}</div>
          {market.totalSupplyAssets > 0 && (
            <div className="text-[10px] text-muted-foreground">{formatTokenAmount(market.totalSupplyAssets, market.loanAsset.symbol)}</div>
          )}
        </td>

        {/* Total Borrow (optional) */}
        {columns.totalBorrow && (
          <td className="p-4 text-right">
            <div className="text-sm font-medium">{formatUsd(market.totalBorrowUsd)}</div>
            {market.totalBorrowAssets > 0 && (
              <div className="text-[10px] text-muted-foreground">{formatTokenAmount(market.totalBorrowAssets, market.loanAsset.symbol)}</div>
            )}
          </td>
        )}

        {/* Liquidity (optional) */}
        {columns.liquidity && (
          <td className="p-4 text-right">
            <div className="text-sm font-medium">{formatUsd(market.availableLiquidityUsd)}</div>
            {market.liquidityAssets > 0 && (
              <div className="text-[10px] text-muted-foreground">{formatTokenAmount(market.liquidityAssets, market.loanAsset.symbol)}</div>
            )}
          </td>
        )}

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

        {/* IRM (optional) */}
        {columns.irm && (
          <td className="p-4 text-right">
            <div className="flex items-center gap-1 justify-end">
              <a
                href={getExplorerAddressUrl(market.chainId, market.irm)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] text-primary hover:underline"
              >
                {truncAddr(market.irm)}
              </a>
              <button
                onClick={(e) => { e.stopPropagation(); onCopy(market.irm, market.id); }}
                className="p-0.5 text-muted-foreground hover:text-foreground"
              >
                {copiedIrm === market.id ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </td>
        )}

        {/* Actions */}
        <td className="p-4 text-right">
          <div className="flex items-center gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onMarketDetails?.(market)}
              className="h-8 w-8 p-0"
              title="Market details"
            >
              <Info className="w-4 h-4" />
            </Button>
            <Button size="sm" onClick={() => onSupply?.(market)} className="h-8 px-3 gap-1">
              <TrendingUp className="w-3 h-3" />
              Supply
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onBorrow?.(market)}
              className="h-8 px-3 gap-1"
              disabled={!market.collateralAsset}
            >
              <Wallet className="w-3 h-3" />
              Borrow
            </Button>
          </div>
        </td>
      </motion.tr>
    </>
  );
});
