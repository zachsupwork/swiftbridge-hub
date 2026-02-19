/**
 * Your Borrows Section — Aave V3
 *
 * Rich per-token rows with strong visual identity, danger indicators,
 * clear explanations, and full action access via click-through drawer.
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDownLeft,
  TrendingDown,
  ExternalLink,
  CreditCard,
  RefreshCw,
  ChevronRight,
  Info,
  Zap,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChainIcon } from '@/components/common/ChainIcon';
import { TokenIcon } from '@/components/common/TokenIcon';
import type { AavePosition } from '@/hooks/useAavePositions';
import type { LendingMarket } from '@/hooks/useLendingMarkets';

function fmtAmount(val: string): string {
  const n = parseFloat(val);
  if (!Number.isFinite(n) || n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtUsd(val: number): string {
  if (!Number.isFinite(val) || val === 0) return '$0.00';
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

function aaveRepayWithCollateralUrl(chainId: number): string {
  const chainMap: Record<number, string> = {
    1: 'ethereum', 42161: 'arbitrum', 10: 'optimism', 137: 'polygon', 8453: 'base', 43114: 'avalanche',
  };
  return `https://app.aave.com/?marketName=proto_${chainMap[chainId] || 'ethereum'}_v3`;
}

interface YourBorrowsSectionProps {
  positions: AavePosition[];
  loading?: boolean;
  accountDebtUsd?: number;
  onBorrow: (market: LendingMarket) => void;
  onRepay: (position: AavePosition) => void;
  onSwap: (chainId: number, symbol: string, address: string) => void;
  onManage?: (position: AavePosition) => void;
  onRefresh?: () => void;
}

export function YourBorrowsSection({
  positions,
  loading,
  accountDebtUsd,
  onBorrow,
  onRepay,
  onSwap,
  onManage,
  onRefresh,
}: YourBorrowsSectionProps) {
  const borrowed = positions
    .filter(p => p.variableDebt > 0n)
    .sort((a, b) => b.variableDebtUsd - a.variableDebtUsd);

  const totalBorrowed = borrowed.reduce((s, p) => s + p.variableDebtUsd, 0);
  const totalDebt = accountDebtUsd ?? totalBorrowed;

  // Loading skeleton
  if (loading && borrowed.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <SectionHeader count={0} totalUsd={0} loading />
        <div className="glass rounded-2xl p-5 border border-warning/10 animate-pulse space-y-3">
          {[1].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 bg-muted rounded" />
                <div className="h-3 w-16 bg-muted/60 rounded" />
              </div>
              {accountDebtUsd && accountDebtUsd > 0 && (
                <div className="text-sm font-medium text-warning">{fmtUsd(accountDebtUsd)}</div>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  // Not indexed but debt detected
  if (!loading && borrowed.length === 0 && accountDebtUsd && accountDebtUsd > 0) {
    return (
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <SectionHeader count={0} totalUsd={accountDebtUsd} />
        <div className="glass rounded-2xl p-5 border border-warning/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">
                {fmtUsd(accountDebtUsd)} active debt detected on-chain
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Per-asset borrow positions are still indexing. Refresh to try again.
              </div>
            </div>
            {onRefresh && (
              <Button size="sm" variant="outline" className="gap-1.5 flex-shrink-0 border-warning/30 text-warning hover:bg-warning/10" onClick={onRefresh}>
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  if (borrowed.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <SectionHeader count={borrowed.length} totalUsd={totalDebt} />

      {/* Explanation banner */}
      <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-warning/5 border border-warning/15 text-xs text-muted-foreground">
        <Zap className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
        <span>
          Borrowed assets accrue <strong className="text-warning">interest</strong> (variable rate) against your collateral.
          Repay to reduce your debt and improve your <strong className="text-warning">Health Factor</strong>.
          Click any row for full management options.
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block glass rounded-2xl overflow-hidden border border-warning/15">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/40 bg-warning/5">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Asset</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outstanding Debt</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Borrow APY</th>
              <th className="text-right px-4 py-3 w-72"></th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {borrowed.map((pos, i) => (
                <BorrowRow
                  key={`${pos.chainId}-${pos.assetAddress}`}
                  pos={pos}
                  index={i}
                  onBorrow={onBorrow}
                  onRepay={onRepay}
                  onManage={onManage}
                />
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2.5">
        {borrowed.map((pos, i) => (
          <BorrowCard
            key={`${pos.chainId}-${pos.assetAddress}`}
            pos={pos}
            index={i}
            onBorrow={onBorrow}
            onRepay={onRepay}
            onManage={onManage}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function SectionHeader({ count, totalUsd, loading }: { count: number; totalUsd: number; loading?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-warning/15 flex items-center justify-center">
          <TrendingDown className="w-3.5 h-3.5 text-warning" />
        </div>
        <h2 className="text-sm font-bold text-foreground tracking-tight">Your Borrows</h2>
        {!loading && count > 0 && (
          <Badge className="h-5 px-2 text-[10px] bg-warning/15 border-warning/30 text-warning border">
            {count} asset{count !== 1 ? 's' : ''}
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground">Aave V3</span>
      </div>
      {!loading && totalUsd > 0 && (
        <div className="text-right">
          <div className="text-sm font-bold text-warning">{fmtUsd(totalUsd)}</div>
          <div className="text-[10px] text-muted-foreground">Total debt</div>
        </div>
      )}
      {loading && <div className="h-4 w-20 bg-muted animate-pulse rounded" />}
    </div>
  );
}

function BorrowRow({ pos, index, onBorrow, onRepay, onManage }: {
  pos: AavePosition;
  index: number;
  onBorrow: (m: LendingMarket) => void;
  onRepay: (p: AavePosition) => void;
  onManage?: (p: AavePosition) => void;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="border-b border-warning/5 hover:bg-warning/5 transition-all cursor-pointer group"
      onClick={() => onManage?.(pos)}
    >
      {/* Asset identity */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            {/* Warning glow ring for borrowed */}
            <div className="absolute inset-0 rounded-full bg-warning/20 blur-sm scale-110" />
            <TokenIcon
              address={pos.assetAddress}
              symbol={pos.assetSymbol}
              chainId={pos.chainId}
              logoUrl={pos.assetLogo}
              size="md"
              className="relative z-10 ring-2 ring-warning/30"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-background overflow-hidden z-20">
              <ChainIcon chainId={pos.chainId} size="sm" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-foreground">{pos.assetSymbol}</span>
              <Badge className="h-4 px-1.5 text-[9px] bg-warning/15 border-warning/40 text-warning border font-semibold">
                BORROWED
              </Badge>
              <AlertTriangle className="w-3 h-3 text-warning opacity-70" />
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <ChainIcon chainId={pos.chainId} size="sm" />
              <span className="text-[11px] text-muted-foreground">{pos.chainName}</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-[11px] text-muted-foreground">Variable rate</span>
            </div>
          </div>
        </div>
      </td>

      {/* Debt */}
      <td className="px-4 py-3.5 text-right">
        <div className="font-bold text-sm text-warning">
          {fmtAmount(pos.variableDebtFormatted)} <span className="text-muted-foreground font-normal">{pos.assetSymbol}</span>
        </div>
        {pos.variableDebtUsd > 0 && (
          <div className="text-xs font-medium text-muted-foreground">{fmtUsd(pos.variableDebtUsd)}</div>
        )}
      </td>

      {/* APY */}
      <td className="px-4 py-3.5 text-right">
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 border border-warning/20">
          <TrendingDown className="w-3 h-3 text-warning" />
          <span className="text-sm font-bold text-warning">{pos.borrowApy.toFixed(2)}%</span>
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs gap-1 border-warning/30 text-warning hover:bg-warning/10"
            onClick={() => onRepay(pos)}
          >
            <CreditCard className="w-3 h-3" /> Repay
          </Button>
          {pos.market && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs gap-1"
              onClick={() => onBorrow(pos.market!)}
            >
              <ArrowDownLeft className="w-3 h-3" /> Borrow More
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2.5 text-xs gap-1 text-primary"
            title="Repay with Collateral — repay this debt using your supplied collateral via Aave"
            onClick={() => window.open(aaveRepayWithCollateralUrl(pos.chainId), '_blank')}
          >
            <ExternalLink className="w-3 h-3" />
            Repay w/ Collateral
          </Button>
          <div className="w-px h-4 bg-border/50 mx-0.5" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs gap-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => onManage?.(pos)}
          >
            Manage
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="group-hover:hidden flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          <span>Click to manage</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      </td>
    </motion.tr>
  );
}

function BorrowCard({ pos, index, onBorrow, onRepay, onManage }: {
  pos: AavePosition;
  index: number;
  onBorrow: (m: LendingMarket) => void;
  onRepay: (p: AavePosition) => void;
  onManage?: (p: AavePosition) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="relative glass rounded-2xl border border-warning/20 overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
      onClick={() => onManage?.(pos)}
    >
      {/* Warning accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-warning via-warning/70 to-warning/30 rounded-l-2xl" />

      <div className="p-4 pl-5">
        {/* Header row */}
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-full bg-warning/20 blur-sm scale-110" />
            <TokenIcon
              address={pos.assetAddress}
              symbol={pos.assetSymbol}
              chainId={pos.chainId}
              logoUrl={pos.assetLogo}
              size="md"
              className="relative z-10 ring-2 ring-warning/30"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-background overflow-hidden z-20">
              <ChainIcon chainId={pos.chainId} size="sm" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-base text-foreground">{pos.assetSymbol}</span>
              <Badge className="h-4 px-1.5 text-[9px] bg-warning/15 border-warning/40 text-warning border font-bold">
                BORROWED
              </Badge>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <ChainIcon chainId={pos.chainId} size="sm" />
              <span className="text-[11px] text-muted-foreground">{pos.chainName}</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-[11px] text-muted-foreground">Variable rate</span>
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 border border-warning/20">
              <TrendingDown className="w-3 h-3 text-warning" />
              <span className="text-sm font-bold text-warning">{pos.borrowApy.toFixed(2)}%</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 text-right">Borrow APY</div>
          </div>
        </div>

        {/* Debt bar */}
        <div className="rounded-xl bg-warning/5 border border-warning/10 px-3 py-2.5 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Outstanding Debt</div>
              <div className="font-bold text-base text-warning">
                {fmtAmount(pos.variableDebtFormatted)} <span className="text-muted-foreground font-normal text-sm">{pos.assetSymbol}</span>
              </div>
            </div>
            {pos.variableDebtUsd > 0 && (
              <div className="text-right">
                <div className="font-bold text-lg text-warning">{fmtUsd(pos.variableDebtUsd)}</div>
                <div className="text-[10px] text-muted-foreground">USD value</div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs gap-1.5 border-warning/30 text-warning hover:bg-warning/10"
            onClick={() => onRepay(pos)}
          >
            <CreditCard className="w-3 h-3" /> Repay
          </Button>
          {pos.market && (
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 h-8 text-xs gap-1.5 border border-border/40"
              onClick={() => onBorrow(pos.market!)}
            >
              <ArrowDownLeft className="w-3 h-3" /> Borrow More
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-xs gap-1 text-primary border border-border/40"
            onClick={() => onManage?.(pos)}
          >
            Manage <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
