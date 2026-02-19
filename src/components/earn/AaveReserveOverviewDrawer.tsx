/**
 * AaveReserveOverviewDrawer — Aave-style "Reserve Overview" deep-dive drawer
 *
 * Shows:
 *  - Token + chain identity with SUPPLIED/BORROWED badges
 *  - "Your info" block: wallet balance, supplied, borrowed, actions
 *  - Reserve status & configuration (from LendingMarket)
 *  - Account health context (from chainAccountData)
 *  - Advanced tools (Collateral Swap, Repay w/ Collateral)
 */

import { useMemo } from 'react';
import {
  ExternalLink, ShieldCheck, Shield, TrendingUp, TrendingDown,
  Heart, CreditCard, Repeat, ArrowUpRight, ArrowDownLeft,
  Info, Zap, AlertTriangle, ChevronRight, Lock, Wallet,
  Activity, BarChart3, Percent, BookOpen,
} from 'lucide-react';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ChainIcon } from '@/components/common/ChainIcon';
import { TokenIcon } from '@/components/common/TokenIcon';
import { RiskBar } from '@/components/common/RiskBar';
import type { AavePosition, AaveChainAccountData } from '@/hooks/useAavePositions';
import type { LendingMarket } from '@/hooks/useLendingMarkets';

const AAVE_CHAIN_SLUG: Record<number, string> = {
  1: 'ethereum', 42161: 'arbitrum', 10: 'optimism', 137: 'polygon', 8453: 'base', 43114: 'avalanche',
};

function aaveMarketUrl(chainId: number): string {
  return `https://app.aave.com/?marketName=proto_${AAVE_CHAIN_SLUG[chainId] || 'ethereum'}_v3`;
}

function fmtAmt(val: string): string {
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

function fmtPct(val: number): string {
  if (!Number.isFinite(val) || val === 0) return '0%';
  return `${val.toFixed(2)}%`;
}

interface AaveReserveOverviewDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The user's position on this asset (null if no position) */
  position: AavePosition | null;
  /** The market/reserve data for this asset */
  market: LendingMarket | null;
  /** Chain-specific account health data */
  chainAccount: AaveChainAccountData | null;
  /** Wallet balance for this token in USD */
  walletBalanceUsd?: number;
  // Actions
  onSupply: (market: LendingMarket) => void;
  onWithdraw: (position: AavePosition) => void;
  onBorrow: (market: LendingMarket) => void;
  onRepay: (position: AavePosition) => void;
  onSwap: (chainId: number, symbol: string, address: string) => void;
}

export function AaveReserveOverviewDrawer({
  open, onClose, position, market, chainAccount,
  walletBalanceUsd, onSupply, onWithdraw, onBorrow, onRepay, onSwap,
}: AaveReserveOverviewDrawerProps) {
  // Derive display values
  const symbol = position?.assetSymbol || market?.assetSymbol || '???';
  const chainId = position?.chainId || market?.chainId || 1;
  const chainName = position?.chainName || market?.chainName || '';
  const assetAddress = position?.assetAddress || market?.assetAddress || ('0x' as `0x${string}`);
  const assetLogo = position?.assetLogo || market?.assetLogo;
  const aaveUrl = aaveMarketUrl(chainId);

  const hasSupply = position ? position.supplyBalance > 0n : false;
  const hasBorrow = position ? position.variableDebt > 0n : false;
  const hasPosition = hasSupply || hasBorrow;

  // Borrow power used %
  const borrowPowerUsed = useMemo(() => {
    if (!chainAccount) return 0;
    const maxBorrow = chainAccount.totalCollateralUsd * (chainAccount.ltv / 10000);
    return maxBorrow > 0 ? (chainAccount.totalDebtUsd / maxBorrow) * 100 : 0;
  }, [chainAccount]);

  const hf = chainAccount?.healthFactor ?? null;
  const hfDisplay = hf === null ? '∞' : hf > 1e10 ? '∞' : hf.toFixed(2);
  const hfColor = hf === null || hf > 1e10 ? 'text-success' : hf > 1.5 ? 'text-success' : hf > 1 ? 'text-warning' : 'text-destructive';

  if (!position && !market) return null;

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="max-h-[92vh] flex flex-col">
        {/* ── Header ── */}
        <DrawerHeader className="pb-3 border-b border-border/30 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className={cn(
                "absolute inset-0 rounded-full blur-md scale-125",
                hasSupply && hasBorrow ? "bg-gradient-to-br from-success/30 to-warning/30" :
                hasSupply ? "bg-success/25" : hasBorrow ? "bg-warning/25" : "bg-primary/15"
              )} />
              <TokenIcon
                address={assetAddress}
                symbol={symbol}
                chainId={chainId}
                logoUrl={assetLogo}
                size="xl"
                className={cn(
                  "relative z-10 ring-2",
                  hasSupply && hasBorrow ? "ring-primary/40" :
                  hasSupply ? "ring-success/40" : hasBorrow ? "ring-warning/40" : "ring-border/40"
                )}
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-background overflow-hidden z-20">
                <ChainIcon chainId={chainId} size="sm" />
              </div>
            </div>

            <div className="flex-1">
              <DrawerTitle className="text-left text-xl font-bold leading-tight">
                {symbol} Reserve Overview
              </DrawerTitle>
              <DrawerDescription className="text-left text-xs mt-0.5">
                {position?.assetName || market?.assetName || symbol} · {chainName} · Aave V3
              </DrawerDescription>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {hasSupply && (
                  <Badge className="h-5 px-2 text-[10px] bg-success/15 border-success/40 text-success border font-bold gap-1">
                    <TrendingUp className="w-3 h-3" /> SUPPLIED
                  </Badge>
                )}
                {hasBorrow && (
                  <Badge className="h-5 px-2 text-[10px] bg-warning/15 border-warning/40 text-warning border font-bold gap-1">
                    <TrendingDown className="w-3 h-3" /> BORROWED
                  </Badge>
                )}
                {position?.isCollateralEnabled && hasSupply && (
                  <Badge className="h-5 px-2 text-[10px] bg-primary/10 border-primary/30 text-primary border gap-1">
                    <Lock className="w-3 h-3" /> Collateral
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DrawerHeader>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5 pt-4">

          {/* ═══ YOUR INFO BLOCK (like Aave) ═══ */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
              <Wallet className="w-3.5 h-3.5 text-primary" />
              Your Info
            </div>

            {/* Wallet balance */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Wallet Balance</span>
              <span className="font-medium">
                {walletBalanceUsd && walletBalanceUsd > 0 ? fmtUsd(walletBalanceUsd) : '$0.00'}
              </span>
            </div>

            {/* Supplied */}
            {hasSupply && position && (
              <div className="rounded-lg bg-success/5 border border-success/15 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-success">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Supplied
                  </div>
                  <Badge className="h-4 px-1.5 text-[9px] bg-success/15 border-success/30 text-success border">
                    {fmtPct(position.supplyApy)} APY
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-foreground">
                      {fmtAmt(position.supplyBalanceFormatted)} {symbol}
                    </div>
                    {position.supplyBalanceUsd > 0 && (
                      <div className="text-xs text-success">{fmtUsd(position.supplyBalanceUsd)}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {position.isCollateralEnabled ? (
                      <div className="flex items-center gap-1 text-[10px] text-success">
                        <ShieldCheck className="w-3 h-3" /> Collateral
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Shield className="w-3 h-3" /> Not collateral
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" className="flex-1 h-8 text-xs gap-1.5 bg-success/15 text-success hover:bg-success/25 border border-success/30"
                    onClick={() => { if (position.market || market) { onSupply((position.market || market)!); onClose(); } }}>
                    <ArrowUpRight className="w-3 h-3" /> Supply More
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => { onWithdraw(position); onClose(); }}>
                    <ArrowDownLeft className="w-3 h-3" /> Withdraw
                  </Button>
                </div>
              </div>
            )}

            {/* Borrowed */}
            {hasBorrow && position && (
              <div className="rounded-lg bg-warning/5 border border-warning/15 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                    <TrendingDown className="w-3.5 h-3.5" />
                    Borrowed
                  </div>
                  <Badge className="h-4 px-1.5 text-[9px] bg-warning/15 border-warning/30 text-warning border">
                    {fmtPct(position.borrowApy)} APY
                  </Badge>
                </div>
                <div>
                  <div className="text-sm font-bold text-warning">
                    {fmtAmt(position.variableDebtFormatted)} {symbol}
                  </div>
                  {position.variableDebtUsd > 0 && (
                    <div className="text-xs text-muted-foreground">{fmtUsd(position.variableDebtUsd)}</div>
                  )}
                </div>
                <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" className="flex-1 h-8 text-xs gap-1.5 bg-warning/15 text-warning hover:bg-warning/25 border border-warning/30"
                    onClick={() => { onRepay(position); onClose(); }}>
                    <CreditCard className="w-3 h-3" /> Repay
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1.5"
                    onClick={() => { if (position.market || market) { onBorrow((position.market || market)!); onClose(); } }}>
                    <ArrowDownLeft className="w-3 h-3" /> Borrow More
                  </Button>
                </div>
              </div>
            )}

            {/* No position — supply/borrow CTA */}
            {!hasPosition && market && (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-muted-foreground">You have no active position on this reserve.</p>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={() => { onSupply(market); onClose(); }}>
                    <ArrowUpRight className="w-3 h-3" /> Supply
                  </Button>
                  {market.borrowingEnabled && (
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1.5" onClick={() => { onBorrow(market); onClose(); }}>
                      <ArrowDownLeft className="w-3 h-3" /> Borrow
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-primary"
                    onClick={() => { onSwap(chainId, symbol, assetAddress); onClose(); }}>
                    <Repeat className="w-3 h-3" /> Swap
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ═══ ACCOUNT HEALTH CONTEXT ═══ */}
          {chainAccount && (chainAccount.totalCollateralUsd > 0 || chainAccount.totalDebtUsd > 0) && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
                  <Heart className="w-3.5 h-3.5 text-primary" />
                  Account Health — {chainName}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <StatBox label="Total Collateral" value={fmtUsd(chainAccount.totalCollateralUsd)} color="success" />
                  <StatBox label="Total Debt" value={fmtUsd(chainAccount.totalDebtUsd)} color="warning" />
                  <StatBox label="Available to Borrow" value={fmtUsd(chainAccount.availableBorrowsUsd)} color="primary" />
                  <StatBox label="Health Factor" value={hfDisplay} color={hf === null || hf > 1.5 ? 'success' : hf > 1 ? 'warning' : 'destructive'} />
                </div>

                {/* Borrow power bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Borrow Power Used</span>
                    <span className={cn("font-medium", borrowPowerUsed > 80 ? "text-destructive" : borrowPowerUsed > 60 ? "text-warning" : "text-success")}>
                      {borrowPowerUsed.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        borrowPowerUsed > 80 ? "bg-destructive" : borrowPowerUsed > 60 ? "bg-warning" : "bg-success"
                      )}
                      style={{ width: `${Math.min(borrowPowerUsed, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Risk bar */}
                {chainAccount.totalDebtUsd > 0 && hf !== null && hf < 1e10 && (
                  <RiskBar healthFactor={hf} showLabel size="md" />
                )}

                {/* Warnings */}
                {hf !== null && hf < 1.5 && hf < 1e10 && (
                  <div className={cn(
                    "rounded-lg p-2.5 flex items-center gap-2 text-xs",
                    hf < 1 ? "bg-destructive/10 border border-destructive/30 text-destructive" :
                    "bg-warning/10 border border-warning/30 text-warning"
                  )}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {hf < 1
                      ? "⚠️ LIQUIDATION RISK! Health Factor below 1. Repay debt or add collateral immediately."
                      : "Health Factor is low. Consider repaying some debt to avoid liquidation risk."
                    }
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══ RESERVE STATUS & CONFIGURATION ═══ */}
          {market && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
                  <BarChart3 className="w-3.5 h-3.5 text-primary" />
                  Reserve Status & Configuration
                </div>

                {/* Status flags */}
                <div className="flex gap-2 flex-wrap">
                  {market.isActive && <Badge className="h-5 text-[10px] bg-success/10 border-success/30 text-success border">Active</Badge>}
                  {market.isFrozen && <Badge className="h-5 text-[10px] bg-destructive/10 border-destructive/30 text-destructive border">Frozen</Badge>}
                  {market.isPaused && <Badge className="h-5 text-[10px] bg-destructive/10 border-destructive/30 text-destructive border">Paused</Badge>}
                  {market.borrowingEnabled
                    ? <Badge className="h-5 text-[10px] bg-primary/10 border-primary/30 text-primary border">Borrowing Enabled</Badge>
                    : <Badge className="h-5 text-[10px] bg-muted border-border text-muted-foreground border">Borrow Disabled</Badge>
                  }
                  {market.collateralEnabled && <Badge className="h-5 text-[10px] bg-success/10 border-success/30 text-success border">Can Be Collateral</Badge>}
                </div>

                {/* APYs */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-lg bg-success/5 border border-success/15 p-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-success" /> Supply APY
                    </div>
                    <div className="text-lg font-bold text-success">{fmtPct(market.supplyAPY)}</div>
                  </div>
                  <div className="rounded-lg bg-warning/5 border border-warning/15 p-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                      <TrendingDown className="w-3 h-3 text-warning" /> Borrow APY
                    </div>
                    <div className="text-lg font-bold text-warning">{fmtPct(market.borrowAPY)}</div>
                    <div className="text-[10px] text-muted-foreground">Variable rate</div>
                  </div>
                </div>

                {/* Reserve details grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <ReserveDetail label="Total Supply" value={fmtUsd(market.totalSupplyUsd)} />
                  <ReserveDetail label="Total Borrow" value={fmtUsd(market.totalBorrowUsd)} />
                  <ReserveDetail label="Available Liquidity" value={fmtUsd(market.availableLiquidityUsd)} />
                  <ReserveDetail label="Utilization Rate" value={fmtPct(market.utilizationRate)} />
                  <ReserveDetail label="Oracle Price" value={market.priceUsd > 0 ? fmtUsd(market.priceUsd) : '—'} />
                  <ReserveDetail label="LTV" value={market.ltv > 0 ? `${market.ltv.toFixed(0)}%` : '—'} />
                  <ReserveDetail label="Liquidation Threshold" value={market.liquidationThreshold > 0 ? `${market.liquidationThreshold.toFixed(0)}%` : '—'} />
                  <ReserveDetail label="Liquidation Bonus" value={market.liquidationBonus > 0 ? `${market.liquidationBonus.toFixed(1)}%` : '—'} />
                  <ReserveDetail label="Supply Cap" value={market.supplyCap > 0 ? market.supplyCap.toLocaleString() : '∞'} />
                  <ReserveDetail label="Borrow Cap" value={market.borrowCap > 0 ? market.borrowCap.toLocaleString() : '∞'} />
                  <ReserveDetail label="Reserve Factor" value={market.reserveFactor > 0 ? `${market.reserveFactor.toFixed(0)}%` : '—'} />
                  {market.eModeCategoryId > 0 && (
                    <ReserveDetail label="E-Mode Category" value={String(market.eModeCategoryId)} />
                  )}
                </div>
              </div>
            </>
          )}

          {/* ═══ ADVANCED TOOLS ═══ */}
          {hasPosition && (
            <>
              <Separator />
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  Advanced Aave Tools
                  <span className="text-[10px] text-muted-foreground font-normal normal-case ml-1">Opens official Aave interface</span>
                </div>

                {hasSupply && (
                  <button onClick={() => window.open(aaveUrl, '_blank')}
                    className="flex items-start gap-3 p-3.5 rounded-xl border border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all text-left w-full">
                    <Repeat className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-0.5">
                        Collateral Swap <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-relaxed">
                        Swap your supplied {symbol} for another collateral asset without withdrawing. Keeps your loans active.
                      </div>
                    </div>
                  </button>
                )}

                {hasBorrow && (
                  <button onClick={() => window.open(aaveUrl, '_blank')}
                    className="flex items-start gap-3 p-3.5 rounded-xl border border-warning/20 hover:border-warning/40 hover:bg-warning/5 transition-all text-left w-full">
                    <CreditCard className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-0.5">
                        Repay with Collateral <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-relaxed">
                        Repay your {symbol} debt using your supplied collateral — no need to have the borrow token in your wallet.
                      </div>
                    </div>
                  </button>
                )}

                {/* Swap via swap intent */}
                <button onClick={() => { onSwap(chainId, symbol, assetAddress); onClose(); }}
                  className="flex items-start gap-3 p-3.5 rounded-xl border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all text-left w-full">
                  <Repeat className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-foreground mb-0.5">Swap / Get {symbol}</div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">
                      Swap any token for {symbol} to supply or repay.
                    </div>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* ═══ VIEW ON AAVE ═══ */}
          <Separator />
          <a href={market?.protocolUrl || aaveUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 border border-border/30 hover:border-primary/20 transition-all">
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open <strong>{symbol}</strong> on Aave ({chainName})</span>
            <ChevronRight className="w-3 h-3 ml-auto" />
          </a>

          {/* ═══ HOW IT WORKS ═══ */}
          <div className="rounded-xl bg-muted/10 border border-border/20 p-3.5 text-xs text-muted-foreground space-y-1.5">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> How Aave Reserves Work
            </div>
            <ul className="space-y-1 leading-relaxed list-disc list-inside text-[11px]">
              <li><strong className="text-foreground">Supply</strong> → Deposit tokens to earn interest via auto-rebasing aTokens</li>
              <li><strong className="text-foreground">Collateral</strong> → Supplied assets with collateral enabled secure your loans</li>
              <li><strong className="text-foreground">Borrow</strong> → Take loans up to your borrowing power (collateral × LTV)</li>
              <li><strong className="text-foreground">Health Factor</strong> → Must stay above 1.0 to avoid liquidation. Higher is safer.</li>
              <li><strong className="text-foreground">Utilization</strong> → How much of the reserve's liquidity is being borrowed</li>
              <li><strong className="text-foreground">Reserve Factor</strong> → % of interest that goes to Aave treasury (doesn't affect your yield)</li>
            </ul>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ── Sub-components ──

function StatBox({ label, value, color }: { label: string; value: string; color: 'success' | 'warning' | 'primary' | 'destructive' }) {
  const cls = {
    success: 'bg-success/5 border-success/15',
    warning: 'bg-warning/5 border-warning/15',
    primary: 'bg-primary/5 border-primary/15',
    destructive: 'bg-destructive/5 border-destructive/15',
  };
  const txtCls = {
    success: 'text-success', warning: 'text-warning', primary: 'text-primary', destructive: 'text-destructive',
  };
  return (
    <div className={cn("rounded-lg border p-2.5", cls[color])}>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
      <div className={cn("text-sm font-bold", txtCls[color])}>{value}</div>
    </div>
  );
}

function ReserveDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/20 border border-border/30 p-2.5">
      <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
      <div className="text-xs font-medium text-foreground">{value}</div>
    </div>
  );
}
