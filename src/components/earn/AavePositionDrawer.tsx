/**
 * AavePositionDrawer
 *
 * A slide-up drawer opened from position rows in YourSuppliesSection,
 * YourBorrowsSection, or the Positions tab.
 *
 * Sections:
 *   A) Overview  — token + chain, supply/borrow amounts, APYs, collateral status
 *   B) Supply management  — Supply more, Withdraw
 *   C) Borrow management  — Borrow more, Repay
 *   D) Risk tools (Aave deep-links) — Collateral Swap, Repay with Collateral
 */

import { ExternalLink, ShieldCheck, Shield, TrendingUp, TrendingDown, Heart, CreditCard, Repeat, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ChainIcon } from '@/components/common/ChainIcon';
import { TokenIcon } from '@/components/common/TokenIcon';
import type { AavePosition } from '@/hooks/useAavePositions';
import type { LendingMarket } from '@/hooks/useLendingMarkets';

// ── Chain slug map for Aave URLs ──
const AAVE_CHAIN_SLUG: Record<number, string> = {
  1: 'ethereum',
  42161: 'arbitrum',
  10: 'optimism',
  137: 'polygon',
  8453: 'base',
  43114: 'avalanche',
};

function aaveMarketUrl(chainId: number): string {
  const slug = AAVE_CHAIN_SLUG[chainId] || 'ethereum';
  return `https://app.aave.com/?marketName=proto_${slug}_v3`;
}

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

interface AavePositionDrawerProps {
  open: boolean;
  onClose: () => void;
  position: AavePosition | null;
  /** Opens the supply/withdraw modal */
  onSupply: (market: LendingMarket) => void;
  onWithdraw: (position: AavePosition) => void;
  /** Opens the borrow/repay modal */
  onBorrow: (market: LendingMarket) => void;
  onRepay: (position: AavePosition) => void;
}

export function AavePositionDrawer({
  open,
  onClose,
  position,
  onSupply,
  onWithdraw,
  onBorrow,
  onRepay,
}: AavePositionDrawerProps) {
  if (!position) return null;

  const hasSupply = position.supplyBalance > 0n;
  const hasBorrow = position.variableDebt > 0n;
  const aaveUrl = aaveMarketUrl(position.chainId);

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="max-h-[90vh] overflow-y-auto">
        <DrawerHeader className="pb-2">
          {/* Token + chain identity */}
          <div className="flex items-center gap-3 mb-1">
            <div className="relative">
              <TokenIcon
                address={position.assetAddress}
                symbol={position.assetSymbol}
                chainId={position.chainId}
                logoUrl={position.assetLogo}
                size="lg"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-background overflow-hidden">
                <ChainIcon chainId={position.chainId} size="sm" />
              </div>
            </div>
            <div>
              <DrawerTitle className="text-left text-lg leading-tight">
                {position.assetSymbol}
              </DrawerTitle>
              <DrawerDescription className="text-left text-xs">
                {position.assetName} · {position.chainName}
              </DrawerDescription>
            </div>
            <div className="ml-auto flex flex-col gap-1 items-end">
              {hasSupply && (
                <Badge variant="outline" className="text-[10px] bg-success/10 border-success/30 text-success">
                  Supplied
                </Badge>
              )}
              {hasBorrow && (
                <Badge variant="outline" className="text-[10px] bg-warning/10 border-warning/30 text-warning">
                  Borrowed
                </Badge>
              )}
            </div>
          </div>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4">

          {/* ── A: Overview grid ── */}
          <div className="grid grid-cols-2 gap-3">
            {hasSupply && (
              <>
                <div className="glass rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-success" />
                    Supplied
                  </div>
                  <div className="text-sm font-semibold">
                    {fmtAmount(position.supplyBalanceFormatted)} {position.assetSymbol}
                  </div>
                  {position.supplyBalanceUsd > 0 && (
                    <div className="text-xs text-muted-foreground">{fmtUsd(position.supplyBalanceUsd)}</div>
                  )}
                </div>
                <div className="glass rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Supply APY</div>
                  <div className="text-sm font-semibold text-success">
                    {position.supplyApy.toFixed(2)}%
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {position.isCollateralEnabled ? (
                      <><ShieldCheck className="w-3 h-3 text-success" /><span className="text-[10px] text-success">Collateral on</span></>
                    ) : (
                      <><Shield className="w-3 h-3 text-muted-foreground" /><span className="text-[10px] text-muted-foreground">Not collateral</span></>
                    )}
                  </div>
                </div>
              </>
            )}

            {hasBorrow && (
              <>
                <div className="glass rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3 text-warning" />
                    Borrowed
                  </div>
                  <div className="text-sm font-semibold text-warning">
                    {fmtAmount(position.variableDebtFormatted)} {position.assetSymbol}
                  </div>
                  {position.variableDebtUsd > 0 && (
                    <div className="text-xs text-muted-foreground">{fmtUsd(position.variableDebtUsd)}</div>
                  )}
                </div>
                <div className="glass rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Borrow APY (variable)</div>
                  <div className="text-sm font-semibold text-warning">
                    {position.borrowApy.toFixed(2)}%
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── B: Supply management ── */}
          {hasSupply && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Supply Management</div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5"
                    disabled={!position.market}
                    onClick={() => { if (position.market) { onSupply(position.market); onClose(); } }}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    Supply More
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => { onWithdraw(position); onClose(); }}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    Withdraw
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* ── C: Borrow management ── */}
          {(hasBorrow || hasSupply) && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Borrow Management</div>
                <div className="flex gap-2">
                  {position.market && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5"
                      onClick={() => { if (position.market) { onBorrow(position.market); onClose(); } }}
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      {hasBorrow ? 'Borrow More' : 'Borrow'}
                    </Button>
                  )}
                  {hasBorrow && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 border-warning/30 text-warning hover:bg-warning/10"
                      onClick={() => { onRepay(position); onClose(); }}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Repay
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── D: Risk / swap tools (Aave deep-links) ── */}
          <Separator />
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Advanced Tools
              <span className="ml-1 font-normal normal-case">via Aave Interface</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {/* Collateral Swap — swap collateral without withdrawing */}
              {hasSupply && (
                <button
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-colors text-left"
                  onClick={() => window.open(aaveUrl, '_blank')}
                >
                  <Repeat className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-1">
                      Collateral Swap
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Swap this collateral for another asset without withdrawing first
                    </div>
                  </div>
                </button>
              )}

              {/* Repay with Collateral — repay debt using supplied collateral */}
              {hasBorrow && (
                <button
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-warning/30 hover:bg-warning/5 transition-colors text-left"
                  onClick={() => window.open(aaveUrl, '_blank')}
                >
                  <CreditCard className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-1">
                      Repay with Collateral
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Repay this debt using your supplied collateral — no need for extra funds
                    </div>
                  </div>
                </button>
              )}

              {/* View on Aave */}
              <a
                href={aaveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View {position.assetSymbol} on Aave ({position.chainName})
              </a>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
