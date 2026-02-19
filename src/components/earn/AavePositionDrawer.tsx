/**
 * AavePositionDrawer — Full position management drawer
 *
 * Opened by clicking any supply/borrow row.
 * Sections:
 *   A) Token identity + status badges
 *   B) What is this? — plain-language explanation of this position
 *   C) Position metrics (supply amount, borrow amount, APYs, collateral status)
 *   D) Health & risk context
 *   E) Supply management — Supply more, Withdraw
 *   F) Borrow management — Borrow more, Repay
 *   G) Advanced tools — Collateral Swap, Repay with Collateral (Aave deep-links)
 *   H) View on Aave link
 */

import {
  ExternalLink, ShieldCheck, Shield, TrendingUp, TrendingDown,
  Heart, CreditCard, Repeat, ArrowUpRight, ArrowDownLeft,
  Info, BookOpen, Zap, AlertTriangle, ChevronRight, Lock,
} from 'lucide-react';
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

function getHealthClass(hf: number | null): string {
  if (!hf || hf > 3) return 'text-success';
  if (hf > 1.5) return 'text-warning';
  return 'text-destructive';
}

function getHealthLabel(hf: number | null): string {
  if (!hf || hf > 10) return 'Excellent';
  if (hf > 3) return 'Healthy';
  if (hf > 1.5) return 'Moderate';
  if (hf > 1.1) return 'Risky';
  return 'Danger!';
}

interface AavePositionDrawerProps {
  open: boolean;
  onClose: () => void;
  position: AavePosition | null;
  /** Aggregated health factor across all chains (lowest) */
  healthFactor?: number | null;
  onSupply: (market: LendingMarket) => void;
  onWithdraw: (position: AavePosition) => void;
  onBorrow: (market: LendingMarket) => void;
  onRepay: (position: AavePosition) => void;
}

export function AavePositionDrawer({
  open,
  onClose,
  position,
  healthFactor,
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
      <DrawerContent className="max-h-[92vh] flex flex-col">
        {/* ── Token identity header ── */}
        <DrawerHeader className="pb-3 border-b border-border/30 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative">
              {/* Protocol glow based on supply/borrow */}
              <div className={cn(
                "absolute inset-0 rounded-full blur-md scale-125",
                hasSupply && hasBorrow ? "bg-gradient-to-br from-success/30 to-warning/30" :
                hasSupply ? "bg-success/25" : "bg-warning/25"
              )} />
              <TokenIcon
                address={position.assetAddress}
                symbol={position.assetSymbol}
                chainId={position.chainId}
                logoUrl={position.assetLogo}
                size="xl"
                className={cn(
                  "relative z-10 ring-2",
                  hasSupply && hasBorrow ? "ring-primary/40" :
                  hasSupply ? "ring-success/40" : "ring-warning/40"
                )}
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-background overflow-hidden z-20">
                <ChainIcon chainId={position.chainId} size="sm" />
              </div>
            </div>

            <div className="flex-1">
              <DrawerTitle className="text-left text-xl font-bold leading-tight">
                {position.assetSymbol}
              </DrawerTitle>
              <DrawerDescription className="text-left text-xs mt-0.5">
                {position.assetName} · {position.chainName}
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
                {position.isCollateralEnabled && hasSupply && (
                  <Badge className="h-5 px-2 text-[10px] bg-primary/10 border-primary/30 text-primary border gap-1">
                    <Lock className="w-3 h-3" /> Collateral
                  </Badge>
                )}
              </div>
            </div>

            {healthFactor && healthFactor < 100 && hasBorrow && (
              <div className="text-right">
                <div className={cn("text-lg font-bold", getHealthClass(healthFactor))}>
                  {healthFactor > 100 ? '∞' : healthFactor.toFixed(2)}
                </div>
                <div className="text-[10px] text-muted-foreground">Health Factor</div>
                <div className={cn("text-[10px] font-semibold", getHealthClass(healthFactor))}>
                  {getHealthLabel(healthFactor)}
                </div>
              </div>
            )}
          </div>
        </DrawerHeader>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5 pt-4">

          {/* ── B: What is this? Plain-language explanation ── */}
          <div className="rounded-xl bg-muted/30 border border-border/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5" />
              About This Position
            </div>

            {hasSupply && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-success">
                  <TrendingUp className="w-4 h-4" />
                  You are <em>supplying</em> {position.assetSymbol}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Supplying {position.assetSymbol} to Aave V3 means you are lending your tokens to the protocol's
                  liquidity pool. In return, you earn <strong className="text-success">{position.supplyApy.toFixed(2)}% APY</strong> paid
                  in {position.assetSymbol} automatically via rebasing aTokens.
                  {position.isCollateralEnabled
                    ? " Your supplied balance is also active as collateral, allowing you to borrow other assets against it."
                    : " Collateral is currently disabled for this asset, so it does not count toward your borrowing power."
                  }
                </p>
              </div>
            )}

            {hasBorrow && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-warning">
                  <TrendingDown className="w-4 h-4" />
                  You are <em>borrowing</em> {position.assetSymbol}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You have borrowed {fmtAmount(position.variableDebtFormatted)} {position.assetSymbol} at a
                  <strong className="text-warning"> {position.borrowApy.toFixed(2)}% variable borrow rate</strong>.
                  Interest accrues every block. Your debt increases over time — monitor your Health Factor
                  to avoid liquidation. Repay fully to close this debt position.
                </p>
              </div>
            )}

            {!hasSupply && !hasBorrow && (
              <p className="text-xs text-muted-foreground">No active position on this asset.</p>
            )}
          </div>

          {/* ── C: Position metrics grid ── */}
          {(hasSupply || hasBorrow) && (
            <div className="grid grid-cols-2 gap-3">
              {hasSupply && (
                <>
                  <MetricCard
                    label="Supplied Balance"
                    value={`${fmtAmount(position.supplyBalanceFormatted)} ${position.assetSymbol}`}
                    subValue={position.supplyBalanceUsd > 0 ? fmtUsd(position.supplyBalanceUsd) : undefined}
                    color="success"
                    icon={<TrendingUp className="w-3.5 h-3.5" />}
                  />
                  <MetricCard
                    label="Supply APY (earned)"
                    value={`${position.supplyApy.toFixed(2)}%`}
                    subValue="Paid in aTokens"
                    color="success"
                    icon={<Zap className="w-3.5 h-3.5" />}
                  />
                  <div className="col-span-2 rounded-xl bg-success/5 border border-success/15 p-3 flex items-center gap-3">
                    {position.isCollateralEnabled ? (
                      <>
                        <ShieldCheck className="w-5 h-5 text-success flex-shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-success">Collateral Active</div>
                          <div className="text-[11px] text-muted-foreground">
                            This supply counts towards your borrowing power and protects your position.
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <Shield className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground">Collateral Disabled</div>
                          <div className="text-[11px] text-muted-foreground">
                            This asset is not used as collateral. Enable it on Aave to unlock borrowing power.
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {hasBorrow && (
                <>
                  <MetricCard
                    label="Outstanding Debt"
                    value={`${fmtAmount(position.variableDebtFormatted)} ${position.assetSymbol}`}
                    subValue={position.variableDebtUsd > 0 ? fmtUsd(position.variableDebtUsd) : undefined}
                    color="warning"
                    icon={<TrendingDown className="w-3.5 h-3.5" />}
                  />
                  <MetricCard
                    label="Borrow APY (charged)"
                    value={`${position.borrowApy.toFixed(2)}%`}
                    subValue="Variable rate"
                    color="warning"
                    icon={<AlertTriangle className="w-3.5 h-3.5" />}
                  />
                </>
              )}
            </div>
          )}

          {/* ── D: Health factor warning ── */}
          {hasBorrow && healthFactor !== undefined && healthFactor !== null && healthFactor < 3 && (
            <div className={cn(
              "rounded-xl p-3.5 border flex items-start gap-3",
              healthFactor < 1.2
                ? "bg-destructive/10 border-destructive/30"
                : healthFactor < 1.5
                  ? "bg-warning/10 border-warning/30"
                  : "bg-muted/20 border-border/40"
            )}>
              <Heart className={cn(
                "w-5 h-5 flex-shrink-0 mt-0.5",
                healthFactor < 1.2 ? "text-destructive" : healthFactor < 1.5 ? "text-warning" : "text-muted-foreground"
              )} />
              <div>
                <div className={cn(
                  "text-sm font-semibold",
                  healthFactor < 1.2 ? "text-destructive" : healthFactor < 1.5 ? "text-warning" : "text-foreground"
                )}>
                  Health Factor: {healthFactor.toFixed(2)} — {getHealthLabel(healthFactor)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {healthFactor < 1.2
                    ? "⚠️ CRITICAL: Liquidation is imminent. Repay debt or add collateral immediately."
                    : healthFactor < 1.5
                      ? "Your position is at risk. Consider repaying some debt or supplying more collateral."
                      : "Your position is safe but monitor it. A Health Factor below 1.0 triggers liquidation."
                  }
                </div>
              </div>
            </div>
          )}

          {/* ── E: Supply management ── */}
          {hasSupply && (
            <>
              <Separator />
              <div className="space-y-2.5">
                <SectionTitle icon={<ArrowUpRight className="w-3.5 h-3.5 text-success" />} label="Supply Management" />

                <div className="grid grid-cols-2 gap-2">
                  <ActionButton
                    label="Supply More"
                    description="Add more tokens to this supply position and earn more interest."
                    icon={<ArrowUpRight className="w-4 h-4" />}
                    color="success"
                    onClick={() => { if (position.market) { onSupply(position.market); onClose(); } }}
                    disabled={!position.market}
                  />
                  <ActionButton
                    label="Withdraw"
                    description="Remove supplied tokens back to your wallet. Must maintain sufficient collateral if you have borrows."
                    icon={<ArrowDownLeft className="w-4 h-4" />}
                    color="destructive"
                    onClick={() => { onWithdraw(position); onClose(); }}
                  />
                </div>
              </div>
            </>
          )}

          {/* ── F: Borrow management ── */}
          {(hasBorrow || hasSupply) && (
            <>
              <Separator />
              <div className="space-y-2.5">
                <SectionTitle icon={<TrendingDown className="w-3.5 h-3.5 text-warning" />} label="Borrow Management" />

                <div className="grid grid-cols-2 gap-2">
                  {position.market && (
                    <ActionButton
                      label={hasBorrow ? 'Borrow More' : 'Borrow'}
                      description="Take out a loan against your collateral. Monitor your Health Factor after borrowing."
                      icon={<ArrowDownLeft className="w-4 h-4" />}
                      color="primary"
                      onClick={() => { if (position.market) { onBorrow(position.market); onClose(); } }}
                    />
                  )}
                  {hasBorrow && (
                    <ActionButton
                      label="Repay Debt"
                      description="Repay your outstanding loan using tokens in your wallet. Improves your Health Factor."
                      icon={<CreditCard className="w-4 h-4" />}
                      color="warning"
                      onClick={() => { onRepay(position); onClose(); }}
                    />
                  )}
                </div>

                {hasBorrow && (
                  <div className="rounded-lg bg-muted/20 border border-border/30 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    Repaying debt increases your Health Factor and reduces the risk of liquidation.
                    You can repay partially or in full.
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── G: Advanced tools (Aave deep-links) ── */}
          <Separator />
          <div className="space-y-2.5">
            <SectionTitle
              icon={<Zap className="w-3.5 h-3.5 text-primary" />}
              label="Advanced Aave Tools"
              subtitle="Opens official Aave interface"
            />

            <div className="space-y-2">
              {/* Collateral Swap */}
              {hasSupply && (
                <AdvancedToolCard
                  icon={<Repeat className="w-5 h-5 text-primary" />}
                  title="Collateral Swap"
                  description="Swap this collateral asset for another supported asset without withdrawing first. Your supply balance switches to the new token while keeping your loan active. Powered by Aave's integrated DEX routing."
                  color="primary"
                  onClick={() => window.open(aaveUrl, '_blank')}
                />
              )}

              {/* Repay with Collateral */}
              {hasBorrow && (
                <AdvancedToolCard
                  icon={<CreditCard className="w-5 h-5 text-warning" />}
                  title="Repay with Collateral"
                  description="Repay this debt by selling a portion of your supplied collateral — no need to have the borrow token in your wallet. Aave routes the swap automatically and closes the debt. This improves your Health Factor instantly."
                  color="warning"
                  onClick={() => window.open(aaveUrl, '_blank')}
                />
              )}

              {/* View on Aave */}
              <a
                href={aaveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 border border-border/30 hover:border-primary/20 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open <strong>{position.assetSymbol}</strong> on Aave ({position.chainName})</span>
                <ChevronRight className="w-3 h-3 ml-auto" />
              </a>
            </div>
          </div>

          {/* ── H: Protocol info footer ── */}
          <div className="rounded-xl bg-muted/10 border border-border/20 p-3.5 text-xs text-muted-foreground space-y-1.5">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> How Aave Positions Work
            </div>
            <ul className="space-y-1 leading-relaxed list-disc list-inside text-[11px]">
              <li><strong className="text-foreground">Supply</strong> → Earn interest via aTokens (automatically rebase in your wallet)</li>
              <li><strong className="text-foreground">Collateral</strong> → Supplied assets with collateral enabled secure your loans</li>
              <li><strong className="text-foreground">Borrow</strong> → Draw loans up to your borrowing power (collateral × LTV)</li>
              <li><strong className="text-foreground">Health Factor</strong> → Must stay above 1.0 to avoid liquidation. Higher is safer.</li>
              <li><strong className="text-foreground">Liquidation</strong> → If HF drops below 1.0, liquidators can seize collateral to repay debt</li>
              <li><strong className="text-foreground">Variable Rate</strong> → Borrow APY changes based on pool utilization (can increase)</li>
            </ul>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ── Reusable sub-components ──────────────────────────────────

function MetricCard({ label, value, subValue, color, icon }: {
  label: string;
  value: string;
  subValue?: string;
  color: 'success' | 'warning' | 'primary' | 'muted';
  icon: React.ReactNode;
}) {
  const colorMap = {
    success: 'bg-success/5 border-success/15 text-success',
    warning: 'bg-warning/5 border-warning/15 text-warning',
    primary: 'bg-primary/5 border-primary/15 text-primary',
    muted: 'bg-muted/20 border-border/30 text-muted-foreground',
  };
  return (
    <div className={cn("rounded-xl border p-3", colorMap[color].split(' ').slice(0, 2).join(' '))}>
      <div className={cn("flex items-center gap-1 text-[10px] font-medium mb-1 uppercase tracking-wider", colorMap[color].split(' ')[2])}>
        {icon} {label}
      </div>
      <div className="text-sm font-bold text-foreground">{value}</div>
      {subValue && <div className="text-[11px] text-muted-foreground mt-0.5">{subValue}</div>}
    </div>
  );
}

function SectionTitle({ icon, label, subtitle }: { icon: React.ReactNode; label: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
      {subtitle && <span className="text-[10px] text-muted-foreground/60 font-normal normal-case ml-1">{subtitle}</span>}
    </div>
  );
}

function ActionButton({ label, description, icon, color, onClick, disabled }: {
  label: string;
  description: string;
  icon: React.ReactNode;
  color: 'success' | 'warning' | 'primary' | 'destructive';
  onClick: () => void;
  disabled?: boolean;
}) {
  const colorMap = {
    success: 'border-success/25 hover:bg-success/10 hover:border-success/40',
    warning: 'border-warning/25 hover:bg-warning/10 hover:border-warning/40',
    primary: 'border-primary/25 hover:bg-primary/10 hover:border-primary/40',
    destructive: 'border-destructive/20 hover:bg-destructive/10 hover:border-destructive/40',
  };
  const iconColorMap = {
    success: 'text-success',
    warning: 'text-warning',
    primary: 'text-primary',
    destructive: 'text-destructive',
  };
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1.5 p-3 rounded-xl border transition-all text-left w-full",
        colorMap[color],
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      <div className={cn("flex items-center gap-1.5 text-sm font-semibold", iconColorMap[color])}>
        {icon} {label}
      </div>
      <div className="text-[11px] text-muted-foreground leading-snug">{description}</div>
    </button>
  );
}

function AdvancedToolCard({ icon, title, description, color, onClick }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'primary' | 'warning';
  onClick: () => void;
}) {
  const colorMap = {
    primary: 'border-primary/20 hover:border-primary/40 hover:bg-primary/5',
    warning: 'border-warning/20 hover:border-warning/40 hover:bg-warning/5',
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 p-4 rounded-xl border transition-all text-left w-full",
        colorMap[color]
      )}
    >
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-1">
          {title}
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
        </div>
        <div className="text-[11px] text-muted-foreground leading-relaxed">{description}</div>
      </div>
    </button>
  );
}
