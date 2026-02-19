/**
 * Your Supplies Section — Aave V3
 *
 * Rich per-token rows with strong visual identity, explanations, and full action access.
 * Every row opens the AavePositionDrawer on click.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Repeat,
  ShieldCheck,
  Shield,
  TrendingUp,
  ExternalLink,
  RefreshCw,
  ChevronRight,
  Info,
  Sparkles,
  Lock,
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

function aaveCollateralSwapUrl(chainId: number): string {
  const chainMap: Record<number, string> = {
    1: 'ethereum', 42161: 'arbitrum', 10: 'optimism', 137: 'polygon', 8453: 'base', 43114: 'avalanche',
  };
  return `https://app.aave.com/?marketName=proto_${chainMap[chainId] || 'ethereum'}_v3`;
}

interface YourSuppliesSectionProps {
  positions: AavePosition[];
  loading?: boolean;
  accountCollateralUsd?: number;
  onSupply: (market: LendingMarket) => void;
  onWithdraw: (position: AavePosition) => void;
  onSwap: (chainId: number, symbol: string, address: string) => void;
  onManage?: (position: AavePosition) => void;
  onRefresh?: () => void;
}

export function YourSuppliesSection({
  positions,
  loading,
  accountCollateralUsd,
  onSupply,
  onWithdraw,
  onSwap,
  onManage,
  onRefresh,
}: YourSuppliesSectionProps) {
  const supplied = positions
    .filter(p => p.supplyBalance > 0n)
    .sort((a, b) => b.supplyBalanceUsd - a.supplyBalanceUsd);

  const totalSupplied = supplied.reduce((s, p) => s + p.supplyBalanceUsd, 0);
  const totalCollateral = accountCollateralUsd ?? totalSupplied;

  // Loading skeleton
  if (loading && supplied.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <SectionHeader count={0} totalUsd={0} loading />
        <div className="glass rounded-2xl p-5 border border-success/10 animate-pulse space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 bg-muted rounded" />
                <div className="h-3 w-16 bg-muted/60 rounded" />
              </div>
              {accountCollateralUsd && accountCollateralUsd > 0 && (
                <div className="text-sm font-medium text-success">{fmtUsd(accountCollateralUsd)}</div>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  // Not indexed but account data detected
  if (!loading && supplied.length === 0 && accountCollateralUsd && accountCollateralUsd > 0) {
    return (
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <SectionHeader count={0} totalUsd={accountCollateralUsd} />
        <div className="glass rounded-2xl p-5 border border-success/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">
                {fmtUsd(accountCollateralUsd)} collateral detected on-chain
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Your per-asset supply positions are still being indexed from the blockchain.
                This can take a moment when RPC nodes are under load.
              </div>
            </div>
            {onRefresh && (
              <Button size="sm" variant="outline" className="gap-1.5 flex-shrink-0 border-success/30 text-success hover:bg-success/10" onClick={onRefresh}>
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  if (supplied.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <SectionHeader count={supplied.length} totalUsd={totalCollateral} />

      {/* Explanation banner */}
      <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-success/5 border border-success/10 text-xs text-muted-foreground">
        <Sparkles className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
        <span>
          Supplied assets earn <strong className="text-success">interest</strong> and can be used as <strong className="text-success">collateral</strong> to borrow other assets.
          Click any row to manage, withdraw, or use advanced tools.
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block glass rounded-2xl overflow-hidden border border-success/15">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/40 bg-success/5">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Asset</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Supplied Balance</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Supply APY</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Collateral</th>
              <th className="text-right px-4 py-3 w-64"></th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {supplied.map((pos, i) => (
                <SupplyRow
                  key={`${pos.chainId}-${pos.assetAddress}`}
                  pos={pos}
                  index={i}
                  onSupply={onSupply}
                  onWithdraw={onWithdraw}
                  onManage={onManage}
                />
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2.5">
        {supplied.map((pos, i) => (
          <SupplyCard
            key={`${pos.chainId}-${pos.assetAddress}`}
            pos={pos}
            index={i}
            onSupply={onSupply}
            onWithdraw={onWithdraw}
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
        <div className="w-6 h-6 rounded-full bg-success/15 flex items-center justify-center">
          <TrendingUp className="w-3.5 h-3.5 text-success" />
        </div>
        <h2 className="text-sm font-bold text-foreground tracking-tight">Your Supplies</h2>
        {!loading && count > 0 && (
          <Badge className="h-5 px-2 text-[10px] bg-success/15 border-success/30 text-success border">
            {count} asset{count !== 1 ? 's' : ''}
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground">Aave V3</span>
      </div>
      {!loading && totalUsd > 0 && (
        <div className="text-right">
          <div className="text-sm font-bold text-success">{fmtUsd(totalUsd)}</div>
          <div className="text-[10px] text-muted-foreground">Total supplied</div>
        </div>
      )}
      {loading && <div className="h-4 w-20 bg-muted animate-pulse rounded" />}
    </div>
  );
}

function SupplyRow({ pos, index, onSupply, onWithdraw, onManage }: {
  pos: AavePosition;
  index: number;
  onSupply: (m: LendingMarket) => void;
  onWithdraw: (p: AavePosition) => void;
  onManage?: (p: AavePosition) => void;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="border-b border-success/5 hover:bg-success/5 transition-all cursor-pointer group"
      onClick={() => onManage?.(pos)}
    >
      {/* Asset identity */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            {/* Glow ring for supplied */}
            <div className="absolute inset-0 rounded-full bg-success/20 blur-sm scale-110" />
            <TokenIcon
              address={pos.assetAddress}
              symbol={pos.assetSymbol}
              chainId={pos.chainId}
              logoUrl={pos.assetLogo}
              size="md"
              className="relative z-10 ring-2 ring-success/30"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-background overflow-hidden z-20">
              <ChainIcon chainId={pos.chainId} size="sm" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-foreground">{pos.assetSymbol}</span>
              <Badge className="h-4 px-1.5 text-[9px] bg-success/15 border-success/40 text-success border font-semibold">
                SUPPLIED
              </Badge>
              {pos.isCollateralEnabled && (
                <Lock className="w-3 h-3 text-success opacity-70" />
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <ChainIcon chainId={pos.chainId} size="sm" />
              <span className="text-[11px] text-muted-foreground">{pos.chainName}</span>
            </div>
          </div>
        </div>
      </td>

      {/* Balance */}
      <td className="px-4 py-3.5 text-right">
        <div className="font-bold text-sm text-foreground">
          {fmtAmount(pos.supplyBalanceFormatted)} <span className="text-muted-foreground font-normal">{pos.assetSymbol}</span>
        </div>
        {pos.supplyBalanceUsd > 0 && (
          <div className="text-xs font-medium text-success">{fmtUsd(pos.supplyBalanceUsd)}</div>
        )}
      </td>

      {/* APY */}
      <td className="px-4 py-3.5 text-right">
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 border border-success/20">
          <TrendingUp className="w-3 h-3 text-success" />
          <span className="text-sm font-bold text-success">{pos.supplyApy.toFixed(2)}%</span>
        </div>
      </td>

      {/* Collateral status */}
      <td className="px-4 py-3.5 text-center">
        {pos.isCollateralEnabled ? (
          <div className="flex flex-col items-center gap-0.5">
            <ShieldCheck className="w-5 h-5 text-success" />
            <span className="text-[9px] text-success font-medium">Active</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-0.5">
            <Shield className="w-5 h-5 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground">Disabled</span>
          </div>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs gap-1 border-success/30 text-success hover:bg-success/10"
            onClick={() => pos.market && onSupply(pos.market)}
          >
            <ArrowUpRight className="w-3 h-3" /> Supply
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2.5 text-xs gap-1 hover:text-destructive"
            onClick={() => onWithdraw(pos)}
          >
            <ArrowDownLeft className="w-3 h-3" /> Withdraw
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2.5 text-xs gap-1 text-primary"
            title="Collateral Swap via Aave — swap this collateral for another without withdrawing"
            onClick={() => window.open(aaveCollateralSwapUrl(pos.chainId), '_blank')}
          >
            <Repeat className="w-3 h-3" />
            Swap
            <ExternalLink className="w-2.5 h-2.5 opacity-50" />
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
        {/* Always-visible manage hint */}
        <div className="group-hover:hidden flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          <span>Click to manage</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      </td>
    </motion.tr>
  );
}

function SupplyCard({ pos, index, onSupply, onWithdraw, onManage }: {
  pos: AavePosition;
  index: number;
  onSupply: (m: LendingMarket) => void;
  onWithdraw: (p: AavePosition) => void;
  onManage?: (p: AavePosition) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="relative glass rounded-2xl border border-success/20 overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
      onClick={() => onManage?.(pos)}
    >
      {/* Green accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-success via-success/70 to-success/30 rounded-l-2xl" />

      <div className="p-4 pl-5">
        {/* Header row */}
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-full bg-success/20 blur-sm scale-110" />
            <TokenIcon
              address={pos.assetAddress}
              symbol={pos.assetSymbol}
              chainId={pos.chainId}
              logoUrl={pos.assetLogo}
              size="md"
              className="relative z-10 ring-2 ring-success/30"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-background overflow-hidden z-20">
              <ChainIcon chainId={pos.chainId} size="sm" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-base text-foreground">{pos.assetSymbol}</span>
              <Badge className="h-4 px-1.5 text-[9px] bg-success/15 border-success/40 text-success border font-bold">
                SUPPLIED
              </Badge>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <ChainIcon chainId={pos.chainId} size="sm" />
              <span className="text-[11px] text-muted-foreground">{pos.chainName}</span>
              {pos.isCollateralEnabled && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <ShieldCheck className="w-3 h-3 text-success" />
                  <span className="text-[11px] text-success">Collateral</span>
                </>
              )}
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 border border-success/20">
              <TrendingUp className="w-3 h-3 text-success" />
              <span className="text-sm font-bold text-success">{pos.supplyApy.toFixed(2)}%</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 text-right">APY</div>
          </div>
        </div>

        {/* Balance bar */}
        <div className="rounded-xl bg-success/5 border border-success/10 px-3 py-2.5 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Supplied Balance</div>
              <div className="font-bold text-base text-foreground">
                {fmtAmount(pos.supplyBalanceFormatted)} <span className="text-muted-foreground font-normal text-sm">{pos.assetSymbol}</span>
              </div>
            </div>
            {pos.supplyBalanceUsd > 0 && (
              <div className="text-right">
                <div className="font-bold text-lg text-success">{fmtUsd(pos.supplyBalanceUsd)}</div>
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
            className="flex-1 h-8 text-xs gap-1.5 border-success/30 text-success hover:bg-success/10"
            onClick={() => pos.market && onSupply(pos.market)}
          >
            <ArrowUpRight className="w-3 h-3" /> Supply More
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 h-8 text-xs gap-1.5 hover:text-destructive border border-border/40"
            onClick={() => onWithdraw(pos)}
          >
            <ArrowDownLeft className="w-3 h-3" /> Withdraw
          </Button>
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
