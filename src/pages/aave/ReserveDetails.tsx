/**
 * Aave Reserve Details Page
 * Route: /earn/aave/:chainId/:assetAddress
 *
 * Full deep-dive into a single Aave V3 reserve:
 *   A) Token identity + chain
 *   B) Contract addresses (underlying, aToken, debtTokens)
 *   C) Reserve config & risk params (LTV, liq threshold, caps, etc.)
 *   D) User position for this reserve (supply + borrow amounts)
 *   E) Actions: Supply / Withdraw / Borrow / Repay
 *   F) Advanced: Collateral Swap + Repay with Collateral (deep-links to Aave)
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ExternalLink, Copy, CheckCheck,
  ShieldCheck, Shield, TrendingUp, TrendingDown,
  AlertTriangle, Info, Zap, CreditCard, Repeat,
  ArrowUpRight, ArrowDownLeft, Heart, Lock,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TokenIcon } from '@/components/common/TokenIcon';
import { ChainIcon } from '@/components/common/ChainIcon';
import { cn } from '@/lib/utils';
import { useAavePositions } from '@/hooks/useAavePositions';
import { useLendingMarkets } from '@/hooks/useLendingMarkets';
import { AaveSupplyModal } from '@/components/earn/AaveSupplyModal';
import { AaveBorrowModal } from '@/components/earn/AaveBorrowModal';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { toast } from '@/hooks/use-toast';
import type { LendingMarket } from '@/hooks/useLendingMarkets';

// ── Chain explorer URLs ──
const EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io/address/',
  42161: 'https://arbiscan.io/address/',
  10: 'https://optimistic.etherscan.io/address/',
  137: 'https://polygonscan.com/address/',
  8453: 'https://basescan.org/address/',
  43114: 'https://snowtrace.io/address/',
};

const AAVE_CHAIN_SLUG: Record<number, string> = {
  1: 'ethereum', 42161: 'arbitrum', 10: 'optimism',
  137: 'polygon', 8453: 'base', 43114: 'avalanche',
};

function explorerLink(chainId: number, address: string) {
  return `${EXPLORERS[chainId] || 'https://etherscan.io/address/'}${address}`;
}

function aaveUrl(chainId: number) {
  return `https://app.aave.com/?marketName=proto_${AAVE_CHAIN_SLUG[chainId] || 'ethereum'}_v3`;
}

function fmtAmount(val: string, decimals = 4): string {
  const n = parseFloat(val);
  if (!Number.isFinite(n) || n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(decimals);
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

// ── CopyAddress ──
function CopyAddress({ address, label, chainId }: { address: string; label: string; chainId: number }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const short = `${address.slice(0, 8)}…${address.slice(-6)}`;

  return (
    <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
        <div className="font-mono text-xs text-foreground truncate">{short}</div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={copy}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted transition-colors"
            >
              {copied ? <CheckCheck className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Copy address</TooltipContent>
        </Tooltip>
        <a
          href={explorerLink(chainId, address)}
          target="_blank"
          rel="noopener noreferrer"
          className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
        </a>
      </div>
    </div>
  );
}

// ── MetricCard ──
function MetricCard({
  label, value, subValue, color = 'default', icon, tooltip,
}: {
  label: string; value: string; subValue?: string;
  color?: 'success' | 'warning' | 'destructive' | 'default';
  icon?: React.ReactNode; tooltip?: string;
}) {
  const colorClass = {
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
    default: 'text-foreground',
  }[color];

  return (
    <div className="glass rounded-xl p-3.5 space-y-0.5">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
        {tooltip && (
          <Tooltip>
            <TooltipTrigger><Info className="w-3 h-3" /></TooltipTrigger>
            <TooltipContent className="max-w-48 text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className={cn('text-base font-bold', colorClass)}>{value}</div>
      {subValue && <div className="text-xs text-muted-foreground">{subValue}</div>}
    </div>
  );
}

// ── ActionButton ──
function ActionButton({
  label, description, icon, color, onClick, disabled, external,
}: {
  label: string; description: string; icon: React.ReactNode;
  color: 'success' | 'warning' | 'primary' | 'destructive';
  onClick: () => void; disabled?: boolean; external?: boolean;
}) {
  const borderClass = {
    success: 'border-success/30 text-success hover:bg-success/10',
    warning: 'border-warning/30 text-warning hover:bg-warning/10',
    primary: 'border-primary/30 text-primary hover:bg-primary/10',
    destructive: 'border-destructive/30 text-destructive hover:bg-destructive/10',
  }[color];

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border p-3.5 text-left transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed',
        borderClass,
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-sm font-semibold">{label}</span>
        {external && <ExternalLink className="w-3 h-3 opacity-60 ml-auto" />}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </button>
  );
}

// ══════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════

export default function AaveReserveDetails() {
  const { chainId: chainIdStr, assetAddress } = useParams<{ chainId: string; assetAddress: string }>();
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const walletChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const chainId = Number(chainIdStr);

  // Fetch markets for this chain
  const { markets } = useLendingMarkets(chainId);

  // Fetch all Aave positions (only populated when wallet connected)
  const { positions, chainAccountData, lowestHealthFactor } = useAavePositions(markets);

  // Find the matching market entry
  const market = useMemo(
    () => markets.find(m => m.chainId === chainId && m.assetAddress.toLowerCase() === assetAddress?.toLowerCase()),
    [markets, chainId, assetAddress],
  );

  // Find user position for this reserve
  const position = useMemo(
    () => positions.find(p => p.chainId === chainId && p.assetAddress.toLowerCase() === assetAddress?.toLowerCase()),
    [positions, chainId, assetAddress],
  );

  // Account data for this chain's HF context
  const chainData = useMemo(
    () => chainAccountData.find(d => d.chainId === chainId),
    [chainAccountData, chainId],
  );

  // Modal state
  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'supply' | 'withdraw' | 'borrow' | 'repay'>('supply');

  const ensureChain = useCallback(async () => {
    if (walletChainId !== chainId) {
      try {
        await switchChainAsync({ chainId });
      } catch {
        toast({ title: 'Switch chain to continue', variant: 'destructive' });
        return false;
      }
    }
    return true;
  }, [walletChainId, chainId, switchChainAsync]);

  const openSupply = useCallback(async () => {
    if (!isConnected) { toast({ title: 'Connect wallet', variant: 'destructive' }); return; }
    if (!await ensureChain()) return;
    setModalMode('supply');
    setIsSupplyModalOpen(true);
  }, [isConnected, ensureChain]);

  const openWithdraw = useCallback(async () => {
    if (!isConnected) { toast({ title: 'Connect wallet', variant: 'destructive' }); return; }
    if (!await ensureChain()) return;
    setModalMode('withdraw');
    setIsSupplyModalOpen(true);
  }, [isConnected, ensureChain]);

  const openBorrow = useCallback(async () => {
    if (!isConnected) { toast({ title: 'Connect wallet', variant: 'destructive' }); return; }
    if (!await ensureChain()) return;
    setModalMode('borrow');
    setIsBorrowModalOpen(true);
  }, [isConnected, ensureChain]);

  const openRepay = useCallback(async () => {
    if (!isConnected) { toast({ title: 'Connect wallet', variant: 'destructive' }); return; }
    if (!await ensureChain()) return;
    setModalMode('repay');
    setIsBorrowModalOpen(true);
  }, [isConnected, ensureChain]);

  const hasSupply = position && position.supplyBalance > 0n;
  const hasBorrow = position && position.variableDebt > 0n;
  const hf = lowestHealthFactor;

  // Borrow modal account data
  const borrowModalAccountData = useMemo(() => {
    if (!chainData) return null;
    const hfBig = BigInt(Math.round(chainData.healthFactor * 1e18));
    const ltvBig = BigInt(Math.round(chainData.ltv * 100));
    const collBase = BigInt(Math.round(chainData.totalCollateralUsd * 1e8));
    const debtBase = BigInt(Math.round(chainData.totalDebtUsd * 1e8));
    const availBase = BigInt(Math.round(chainData.availableBorrowsUsd * 1e8));
    const maxBorrow = chainData.totalCollateralUsd * (chainData.ltv / 10000);
    const borrowLimitUsedPercent = maxBorrow > 0 ? (chainData.totalDebtUsd / maxBorrow) * 100 : 0;
    return {
      totalCollateralBase: collBase, totalDebtBase: debtBase, availableBorrowsBase: availBase,
      currentLiquidationThreshold: BigInt(Math.round((chainData.liquidationThreshold ?? 0) * 100)),
      ltv: ltvBig, healthFactor: hfBig,
      totalCollateralUsd: chainData.totalCollateralUsd, totalDebtUsd: chainData.totalDebtUsd,
      availableBorrowsUsd: chainData.availableBorrowsUsd,
      healthFactorFormatted: chainData.healthFactor > 1e10 ? Infinity : chainData.healthFactor,
      borrowLimitUsedPercent,
    };
  }, [chainData]);

  // Utilization
  const utilization = market?.utilizationRate ?? 0;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Back nav */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/earn?tab=markets')}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Markets
        </Button>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

          {/* ── A: Identity ── */}
          <div className="glass rounded-2xl p-5 border border-border/40">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-shrink-0">
                <div className={cn(
                  'absolute inset-0 rounded-full blur-lg scale-150',
                  hasSupply && hasBorrow ? 'bg-gradient-to-br from-success/30 to-warning/30' :
                  hasSupply ? 'bg-success/20' : hasBorrow ? 'bg-warning/20' : 'bg-primary/10',
                )} />
                <TokenIcon
                  address={assetAddress}
                  symbol={market?.assetSymbol || position?.assetSymbol}
                  chainId={chainId}
                  logoUrl={market?.assetLogo || position?.assetLogo}
                  size="xl"
                  className={cn(
                    'relative z-10 ring-2',
                    hasSupply ? 'ring-success/40' : hasBorrow ? 'ring-warning/40' : 'ring-border/30',
                  )}
                />
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 border-background overflow-hidden z-20">
                  <ChainIcon chainId={chainId} size="sm" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold">{market?.assetSymbol || position?.assetSymbol || 'Loading…'}</h1>
                  {hasSupply && (
                    <Badge className="bg-success/15 border-success/40 text-success border gap-1">
                      <TrendingUp className="w-3 h-3" /> SUPPLIED
                    </Badge>
                  )}
                  {hasBorrow && (
                    <Badge className="bg-warning/15 border-warning/40 text-warning border gap-1">
                      <TrendingDown className="w-3 h-3" /> BORROWED
                    </Badge>
                  )}
                  {hasSupply && position?.isCollateralEnabled && (
                    <Badge className="bg-primary/10 border-primary/30 text-primary border gap-1">
                      <Lock className="w-3 h-3" /> Collateral
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {market?.assetName || position?.assetName || 'Unknown'} · {position?.chainName || chainId}
                </p>
                {market?.priceUsd ? (
                  <p className="text-sm font-semibold mt-1">Oracle Price: {fmtUsd(market.priceUsd)}</p>
                ) : null}
              </div>

              {/* Health factor (if user has borrows) */}
              {hf !== null && hasBorrow && (
                <div className="text-right flex-shrink-0">
                  <div className={cn('text-2xl font-bold', getHealthClass(hf))}>
                    {hf > 100 ? '∞' : hf.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">Health Factor</div>
                </div>
              )}

              <a
                href={aaveUrl(chainId)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0"
              >
                <Button variant="outline" size="sm" className="gap-1.5">
                  View on Aave <ExternalLink className="w-3 h-3" />
                </Button>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── LEFT COLUMN: Contracts + Risk Params ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* ── B: Contract Addresses ── */}
              <div className="glass rounded-2xl p-5 border border-border/40 space-y-3">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="w-3 h-3 text-primary" />
                  </div>
                  Contract Addresses
                  <span className="text-[10px] text-muted-foreground font-normal">All verified on Aave V3 protocol</span>
                </h2>

                <div className="space-y-2">
                  {assetAddress && (
                    <CopyAddress address={assetAddress} label="Underlying Asset" chainId={chainId} />
                  )}
                  {position?.aTokenAddress && (
                    <CopyAddress address={position.aTokenAddress} label="aToken (interest-bearing deposit receipt)" chainId={chainId} />
                  )}
                  {position?.variableDebtTokenAddress && (
                    <CopyAddress address={position.variableDebtTokenAddress} label="Variable Debt Token" chainId={chainId} />
                  )}
                  {position?.stableDebtTokenAddress && position.stableDebtTokenAddress !== '0x0000000000000000000000000000000000000000' && (
                    <CopyAddress address={position.stableDebtTokenAddress} label="Stable Debt Token" chainId={chainId} />
                  )}
                  {position?.poolAddress && (
                    <CopyAddress address={position.poolAddress} label="Aave V3 Pool (send approvals here)" chainId={chainId} />
                  )}
                  {position?.poolAddressesProvider && (
                    <CopyAddress address={position.poolAddressesProvider} label="Pool Addresses Provider" chainId={chainId} />
                  )}
                  {position?.uiPoolDataProvider && (
                    <CopyAddress address={position.uiPoolDataProvider} label="UI Pool Data Provider" chainId={chainId} />
                  )}
                  {position?.oracleAddress && (
                    <CopyAddress address={position.oracleAddress} label="Aave Price Oracle" chainId={chainId} />
                  )}
                  {!position && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Connect your wallet and supply/borrow to see token-specific contract addresses.
                    </p>
                  )}
                </div>
              </div>

              {/* ── C: Reserve Config + Risk Params ── */}
              {market && (
                <div className="glass rounded-2xl p-5 border border-border/40 space-y-4">
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-warning/10 flex items-center justify-center">
                      <AlertTriangle className="w-3 h-3 text-warning" />
                    </div>
                    Reserve Config &amp; Risk Parameters
                  </h2>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                    <MetricCard
                      label="Supply APY"
                      value={`${market.supplyAPY.toFixed(2)}%`}
                      subValue="Interest earned"
                      color="success"
                      icon={<TrendingUp className="w-3 h-3" />}
                      tooltip="Annual percentage yield earned by suppliers. Paid via rebasing aTokens."
                    />
                    <MetricCard
                      label="Borrow APY"
                      value={`${market.borrowAPY.toFixed(2)}%`}
                      subValue="Variable rate"
                      color="warning"
                      icon={<TrendingDown className="w-3 h-3" />}
                      tooltip="Annual percentage rate charged to borrowers. Changes every block based on utilization."
                    />
                    <MetricCard
                      label="Utilization"
                      value={`${utilization.toFixed(1)}%`}
                      subValue="Of total deposits"
                      tooltip="How much of the total supplied liquidity is currently borrowed. Higher utilization drives up borrow rates."
                    />
                    <MetricCard
                      label="LTV (Loan to Value)"
                      value={market.ltv > 0 ? `${market.ltv.toFixed(0)}%` : '—'}
                      tooltip="Maximum percentage you can borrow relative to collateral value. E.g. 80% LTV means you can borrow $80 for every $100 collateral."
                    />
                    <MetricCard
                      label="Liq. Threshold"
                      value={market.liquidationThreshold > 0 ? `${market.liquidationThreshold.toFixed(0)}%` : '—'}
                      tooltip="When your debt-to-collateral ratio exceeds this threshold, your position can be liquidated."
                    />
                    <MetricCard
                      label="Liq. Bonus"
                      value={market.liquidationBonus > 0 ? `${market.liquidationBonus.toFixed(1)}%` : '—'}
                      tooltip="The discount liquidators receive when purchasing collateral. This is the penalty for getting liquidated."
                      color={market.liquidationBonus > 10 ? 'warning' : 'default'}
                    />
                    <MetricCard
                      label="Reserve Factor"
                      value={market.reserveFactor > 0 ? `${market.reserveFactor.toFixed(0)}%` : '—'}
                      tooltip="Percentage of borrow interest redirected to the Aave treasury."
                    />
                    <MetricCard
                      label="Supply Cap"
                      value={market.supplyCap > 0 ? `${market.supplyCap.toLocaleString()} ${market.assetSymbol}` : '∞'}
                      tooltip="Maximum total supply allowed for this asset. Prevents over-concentration risk."
                    />
                    <MetricCard
                      label="Borrow Cap"
                      value={market.borrowCap > 0 ? `${market.borrowCap.toLocaleString()} ${market.assetSymbol}` : '∞'}
                      tooltip="Maximum total borrowing allowed for this asset."
                    />
                    <MetricCard
                      label="Total Supplied"
                      value={market.totalSupplyUsd ? fmtUsd(market.totalSupplyUsd) : '—'}
                      subValue="Protocol total"
                    />
                    <MetricCard
                      label="Total Borrowed"
                      value={market.totalBorrowUsd ? fmtUsd(market.totalBorrowUsd) : '—'}
                      subValue="Protocol total"
                    />
                    <MetricCard
                      label="Available Liquidity"
                      value={market.availableLiquidityUsd ? fmtUsd(market.availableLiquidityUsd) : '—'}
                      tooltip="Total liquidity available for borrowing right now."
                    />
                  </div>

                  {/* Status flags */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {market.collateralEnabled ? (
                      <Badge className="bg-success/10 border-success/30 text-success border gap-1">
                        <ShieldCheck className="w-3 h-3" /> Can be used as collateral
                      </Badge>
                    ) : (
                      <Badge className="bg-muted border-border text-muted-foreground border gap-1">
                        <Shield className="w-3 h-3" /> No collateral
                      </Badge>
                    )}
                    {market.borrowingEnabled ? (
                      <Badge className="bg-primary/10 border-primary/30 text-primary border">Borrowing enabled</Badge>
                    ) : (
                      <Badge className="bg-destructive/10 border-destructive/30 text-destructive border">Borrowing disabled</Badge>
                    )}
                    {market.isFrozen && (
                      <Badge className="bg-destructive/10 border-destructive/30 text-destructive border">Frozen</Badge>
                    )}
                    {market.isPaused && (
                      <Badge className="bg-destructive/10 border-destructive/30 text-destructive border">Paused</Badge>
                    )}
                    {market.eModeCategoryId > 0 && (
                      <Badge className="bg-primary/10 border-primary/30 text-primary border">
                        E-Mode {market.eModeCategoryId}
                      </Badge>
                    )}
                  </div>

                  {/* Education block */}
                  <div className="rounded-xl bg-muted/20 border border-border/30 p-3.5 text-xs text-muted-foreground space-y-2">
                    <p className="font-semibold text-foreground text-sm">How does this reserve work?</p>
                    <p>
                      When you <strong className="text-success">supply {market.assetSymbol}</strong>, you deposit it into Aave's liquidity pool
                      and receive <strong>a{market.assetSymbol}</strong> (aTokens) in return. These aTokens rebase — their balance
                      grows automatically as interest accrues, at <strong className="text-success">{market.supplyAPY.toFixed(2)}% APY</strong>.
                    </p>
                    {market.collateralEnabled && (
                      <p>
                        Your supplied {market.assetSymbol} can be used as <strong>collateral</strong> — it allows you to borrow other assets
                        up to <strong>{market.ltv.toFixed(0)}%</strong> of its USD value. If your total debt rises above the{' '}
                        <strong>{market.liquidationThreshold.toFixed(0)}%</strong> threshold, your position may be liquidated.
                      </p>
                    )}
                    {market.borrowingEnabled && (
                      <p>
                        When you <strong className="text-warning">borrow {market.assetSymbol}</strong>, you receive the tokens directly
                        and a Variable Debt Token accumulates on your account at{' '}
                        <strong className="text-warning">{market.borrowAPY.toFixed(2)}% APY</strong>. Repay your debt anytime.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT COLUMN: User position + Actions ── */}
            <div className="space-y-4">

              {/* ── D: User position ── */}
              {isConnected && position && (hasSupply || hasBorrow) && (
                <div className="glass rounded-2xl p-4 border border-border/40 space-y-3">
                  <h2 className="text-sm font-bold">Your Position</h2>

                  {hasSupply && (
                    <div className="rounded-xl bg-success/5 border border-success/15 p-3.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-success">
                        <TrendingUp className="w-3.5 h-3.5" /> Supplied
                      </div>
                      <div className="text-xl font-bold">
                        {fmtAmount(position.supplyBalanceFormatted)} <span className="text-sm font-normal text-muted-foreground">{position.assetSymbol}</span>
                      </div>
                      {position.supplyBalanceUsd > 0 && (
                        <div className="text-sm font-semibold text-success">{fmtUsd(position.supplyBalanceUsd)}</div>
                      )}
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        {position.isCollateralEnabled
                          ? <><ShieldCheck className="w-3 h-3 text-success" /> Active as collateral</>
                          : <><Shield className="w-3 h-3" /> Collateral disabled</>
                        }
                      </div>
                    </div>
                  )}

                  {hasBorrow && (
                    <div className="rounded-xl bg-warning/5 border border-warning/15 p-3.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                        <TrendingDown className="w-3.5 h-3.5" /> Borrowed
                      </div>
                      <div className="text-xl font-bold text-warning">
                        {fmtAmount(position.variableDebtFormatted)} <span className="text-sm font-normal text-muted-foreground">{position.assetSymbol}</span>
                      </div>
                      {position.variableDebtUsd > 0 && (
                        <div className="text-sm font-semibold text-warning">{fmtUsd(position.variableDebtUsd)}</div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Variable rate · {position.borrowApy.toFixed(2)}% APY
                      </div>
                    </div>
                  )}

                  {/* Chain account data summary */}
                  {chainData && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="text-center">
                        <div className={cn('text-base font-bold', getHealthClass(chainData.healthFactor))}>
                          {chainData.healthFactor > 100 ? '∞' : chainData.healthFactor.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Health Factor</div>
                      </div>
                      <div className="text-center">
                        <div className="text-base font-bold">{fmtUsd(chainData.availableBorrowsUsd)}</div>
                        <div className="text-[10px] text-muted-foreground">Available to Borrow</div>
                      </div>
                    </div>
                  )}

                  {/* HF Warning */}
                  {hasBorrow && hf !== null && hf < 1.5 && (
                    <div className={cn(
                      'rounded-lg p-2.5 text-xs flex items-start gap-2',
                      hf < 1.2 ? 'bg-destructive/10 border border-destructive/30 text-destructive' : 'bg-warning/10 border border-warning/30 text-warning',
                    )}>
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      {hf < 1.2 ? '⚠️ Critical: Liquidation imminent! Repay debt or add collateral NOW.' : 'Your position is at risk. Consider repaying debt.'}
                    </div>
                  )}
                </div>
              )}

              {!isConnected && (
                <div className="glass rounded-2xl p-4 border border-border/40 text-center space-y-2">
                  <Heart className="w-6 h-6 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">Connect your wallet to see your position and manage it.</p>
                </div>
              )}

              {/* ── E: Core actions ── */}
              <div className="glass rounded-2xl p-4 border border-border/40 space-y-3">
                <h2 className="text-sm font-bold">Manage Position</h2>

                <div className="space-y-2">
                  <ActionButton
                    label="Supply"
                    description={`Deposit ${market?.assetSymbol || 'this asset'} to earn ${market?.supplyAPY.toFixed(2) || '—'}% APY and optionally use as collateral.`}
                    icon={<ArrowUpRight className="w-4 h-4" />}
                    color="success"
                    onClick={openSupply}
                    disabled={!market}
                  />
                  {hasSupply && (
                    <ActionButton
                      label="Withdraw"
                      description="Remove your supplied tokens back to your wallet. Must keep sufficient collateral if you have active borrows."
                      icon={<ArrowDownLeft className="w-4 h-4" />}
                      color="destructive"
                      onClick={openWithdraw}
                    />
                  )}
                  {market?.borrowingEnabled && (
                    <ActionButton
                      label={hasBorrow ? 'Borrow More' : 'Borrow'}
                      description={`Take a loan in ${market.assetSymbol} against your collateral at ${market.borrowAPY.toFixed(2)}% variable APY. Monitor your Health Factor.`}
                      icon={<ArrowDownLeft className="w-4 h-4" />}
                      color="primary"
                      onClick={openBorrow}
                      disabled={!market}
                    />
                  )}
                  {hasBorrow && (
                    <ActionButton
                      label="Repay Debt"
                      description="Repay outstanding debt to improve your Health Factor and reduce liquidation risk. You can repay partially or in full."
                      icon={<CreditCard className="w-4 h-4" />}
                      color="warning"
                      onClick={openRepay}
                    />
                  )}
                </div>
              </div>

              {/* ── F: Advanced tools ── */}
              <div className="glass rounded-2xl p-4 border border-border/40 space-y-3">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Advanced Aave Tools
                  <span className="text-[10px] text-muted-foreground font-normal">Opens official Aave interface</span>
                </h2>

                <div className="space-y-2">
                  {hasSupply && (
                    <ActionButton
                      label="Collateral Swap"
                      description="Swap this supplied collateral for a different asset without withdrawing first. Useful to rebalance your collateral composition."
                      icon={<Repeat className="w-4 h-4" />}
                      color="primary"
                      onClick={() => window.open(aaveUrl(chainId), '_blank')}
                      external
                    />
                  )}
                  {hasBorrow && (
                    <ActionButton
                      label="Repay with Collateral"
                      description="Use your supplied collateral to repay debt directly — no need to manually withdraw, swap, and repay. Opens Aave's official interface."
                      icon={<Repeat className="w-4 h-4" />}
                      color="warning"
                      onClick={() => window.open(aaveUrl(chainId), '_blank')}
                      external
                    />
                  )}
                  {!hasSupply && !hasBorrow && (
                    <a href={aaveUrl(chainId)} target="_blank" rel="noopener noreferrer" className="block">
                      <div className="rounded-xl border border-border/30 p-3 text-xs text-muted-foreground hover:border-primary/30 transition-colors">
                        <div className="flex items-center gap-2">
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View this reserve on Aave</span>
                        </div>
                      </div>
                    </a>
                  )}
                </div>
              </div>

            </div>
          </div>
        </motion.div>

        {/* ── Modals ── */}
        {market && (
          <>
            <AaveSupplyModal
              open={isSupplyModalOpen}
              onClose={() => setIsSupplyModalOpen(false)}
              market={market}
            />
            <AaveBorrowModal
              open={isBorrowModalOpen}
              onClose={() => setIsBorrowModalOpen(false)}
              market={market}
              accountData={borrowModalAccountData}
            />
          </>
        )}
      </div>
    </Layout>
  );
}
