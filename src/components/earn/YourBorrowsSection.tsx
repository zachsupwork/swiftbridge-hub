/**
 * Your Borrows Section — Aave-style
 *
 * Shows the user's active borrow positions.
 * Actions: Repay, Borrow More, Repay with Collateral (opens Aave UI), Manage (drawer).
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDownLeft,
  TrendingDown,
  ExternalLink,
  CreditCard,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

/** Build Aave App URL for Repay with Collateral */
function aaveRepayWithCollateralUrl(chainId: number): string {
  const chainMap: Record<number, string> = {
    1: 'ethereum', 42161: 'arbitrum', 10: 'optimism', 137: 'polygon', 8453: 'base', 43114: 'avalanche',
  };
  return `https://app.aave.com/?marketName=proto_${chainMap[chainId] || 'ethereum'}_v3`;
}

interface YourBorrowsSectionProps {
  positions: AavePosition[];
  /** When true: positions not yet loaded but account data shows debt */
  loading?: boolean;
  /** Authoritative debt USD from getUserAccountData (shown as fallback) */
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

  // Loading skeleton
  if (loading && borrowed.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-warning" />
          <h2 className="text-sm font-semibold text-foreground">Your Borrows</h2>
          <span className="text-[10px] text-muted-foreground ml-1">Aave V3 · Loading positions…</span>
        </div>
        <div className="glass rounded-xl p-4 border border-warning/10 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 bg-muted rounded" />
            {accountDebtUsd && accountDebtUsd > 0 && (
              <div className="text-sm font-medium text-warning">{fmtUsd(accountDebtUsd)} total debt</div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Positions not indexed yet: account data shows debt but scan finished empty
  if (!loading && borrowed.length === 0 && accountDebtUsd && accountDebtUsd > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-warning" />
          <h2 className="text-sm font-semibold text-foreground">Your Borrows</h2>
          <Badge variant="outline" className="h-4 px-1.5 text-[10px] bg-warning/10 border-warning/30 text-warning">
            Aave V3
          </Badge>
        </div>
        <div className="glass rounded-xl p-4 border border-warning/15">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-foreground">
                {fmtUsd(accountDebtUsd)} total debt detected
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Per-asset positions could not be indexed. This may be due to RPC rate limits.
              </div>
            </div>
            {onRefresh && (
              <Button size="sm" variant="outline" className="gap-1.5 flex-shrink-0" onClick={onRefresh}>
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
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      {/* Section header */}
      <div className="flex items-center gap-2">
        <TrendingDown className="w-4 h-4 text-warning" />
        <h2 className="text-sm font-semibold text-foreground">Your Borrows</h2>
        <Badge variant="outline" className="h-4 px-1.5 text-[10px] bg-warning/10 border-warning/30 text-warning">
          {borrowed.length}
        </Badge>
        <span className="text-[10px] text-muted-foreground ml-1">Aave V3</span>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block glass rounded-xl overflow-hidden border border-warning/10">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/40 bg-warning/5">
              <th className="text-left p-3 text-xs font-medium text-muted-foreground">Asset</th>
              <th className="text-right p-3 text-xs font-medium text-muted-foreground">Debt</th>
              <th className="text-right p-3 text-xs font-medium text-muted-foreground">APY (variable)</th>
              <th className="text-right p-3 w-72"></th>
            </tr>
          </thead>
          <tbody>
            {borrowed.map((pos, i) => (
              <motion.tr
                key={`${pos.chainId}-${pos.assetAddress}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="border-b border-border/20 hover:bg-warning/5 transition-colors cursor-pointer"
                onClick={() => onManage?.(pos)}
              >
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <TokenIcon
                        address={pos.assetAddress}
                        symbol={pos.assetSymbol}
                        chainId={pos.chainId}
                        logoUrl={pos.assetLogo}
                        size="sm"
                        className="w-7 h-7"
                      />
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-background overflow-hidden">
                        <ChainIcon chainId={pos.chainId} size="sm" />
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-sm">{pos.assetSymbol}</div>
                      <div className="text-[11px] text-muted-foreground">{pos.chainName}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-right">
                  <div className="text-sm font-medium text-warning">
                    {fmtAmount(pos.variableDebtFormatted)} {pos.assetSymbol}
                  </div>
                  {pos.variableDebtUsd > 0 && (
                    <div className="text-xs text-muted-foreground">{fmtUsd(pos.variableDebtUsd)}</div>
                  )}
                </td>
                <td className="p-3 text-right">
                  <span className="text-sm font-medium text-warning">{pos.borrowApy.toFixed(2)}%</span>
                </td>
                <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs gap-1 border-warning/30 text-warning hover:bg-warning/10"
                      onClick={() => onRepay(pos)}
                    >
                      Repay
                    </Button>
                    {pos.market && (
                      <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs gap-1"
                        onClick={() => onBorrow(pos.market!)}>
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
                      <CreditCard className="w-3 h-3" />
                      Repay w/ Collateral
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                      onClick={() => onManage?.(pos)}>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {borrowed.map((pos) => (
          <div
            key={`${pos.chainId}-${pos.assetAddress}`}
            className="glass rounded-xl p-3.5 border border-warning/15 cursor-pointer active:bg-warning/5"
            onClick={() => onManage?.(pos)}
          >
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="relative">
                <TokenIcon
                  address={pos.assetAddress}
                  symbol={pos.assetSymbol}
                  chainId={pos.chainId}
                  logoUrl={pos.assetLogo}
                  size="sm"
                  className="w-8 h-8"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-background overflow-hidden">
                  <ChainIcon chainId={pos.chainId} size="sm" />
                </div>
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm flex items-center gap-1.5">
                  {pos.assetSymbol}
                  <AlertTriangle className="w-3 h-3 text-warning" />
                </div>
                <div className="text-[11px] text-muted-foreground">{pos.chainName}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-warning">{pos.borrowApy.toFixed(2)}%</div>
                <div className="text-[10px] text-muted-foreground">Borrow APY</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-1" />
            </div>
            <div className="mb-2.5 text-xs">
              <div className="text-muted-foreground">Debt</div>
              <div className="font-medium text-warning">{fmtAmount(pos.variableDebtFormatted)} {pos.assetSymbol}</div>
              {pos.variableDebtUsd > 0 && (
                <div className="text-muted-foreground">{fmtUsd(pos.variableDebtUsd)}</div>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs gap-1 border-warning/30 text-warning hover:bg-warning/10"
                onClick={() => onRepay(pos)}
              >
                Repay
              </Button>
              {pos.market && (
                <Button size="sm" variant="ghost" className="flex-1 h-8 text-xs gap-1"
                  onClick={() => onBorrow(pos.market!)}>
                  Borrow More
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs gap-1 text-primary"
                onClick={() => window.open(aaveRepayWithCollateralUrl(pos.chainId), '_blank')}
              >
                <CreditCard className="w-3 h-3" />
                Repay w/ Collateral
              </Button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
