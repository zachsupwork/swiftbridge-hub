/**
 * Earn Page — Aave V3 Markets + Morpho Vaults
 * 
 * Full Aave V3 integration with on-chain data:
 * - Dashboard: Net worth, Health Factor, Net APY
 * - Markets tab: Supply / Borrow sub-tabs with all reserve data
 * - Vaults tab: Morpho vaults
 * - Positions tab: Aave positions + Morpho vault deposits
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  Rocket,
  Wallet,
  LayoutGrid,
  List,
  ExternalLink,
  Shield,
  ShieldCheck,
  Info,
  Repeat,
  Heart,
  DollarSign,
  Percent,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';

import { Layout } from '@/components/layout/Layout';
import { SeoHead, SeoContentBlock } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AaveMarketsTable } from '@/components/earn/AaveMarketsTable';
import { AaveSupplyModal } from '@/components/earn/AaveSupplyModal';
import { AaveBorrowModal } from '@/components/earn/AaveBorrowModal';
import { AavePositionCard } from '@/components/earn/AavePositionCard';
import { MorphoVaultsTable } from '@/components/earn/MorphoVaultsTable';
import { MorphoVaultActionModal } from '@/components/earn/MorphoVaultActionModal';
import { YourSuppliesSection } from '@/components/earn/YourSuppliesSection';
import { YourBorrowsSection } from '@/components/earn/YourBorrowsSection';
import { AavePositionDrawer } from '@/components/earn/AavePositionDrawer';
import { AaveReserveOverviewDrawer } from '@/components/earn/AaveReserveOverviewDrawer';
import { AccountHealthBar } from '@/components/earn/AccountHealthBar';
import { WithdrawModal } from '@/components/earn/WithdrawModal';
import { RepayModal } from '@/components/earn/RepayModal';
import { useAaveBorrow } from '@/hooks/useAaveBorrow';
import type { UserBorrowPosition } from '@/hooks/useAaveBorrow';
import { useLendingMarkets, SUPPORTED_CHAIN_IDS, LENDING_CHAINS } from '@/hooks/useLendingMarkets';
import { useAavePositions } from '@/hooks/useAavePositions';

import { useMorphoVaults } from '@/hooks/useMorphoVaults';
import { RiskBar } from '@/components/common/RiskBar';
import { ChainIcon } from '@/components/common/ChainIcon';
import { TokenIcon } from '@/components/common/TokenIcon';
import { cn } from '@/lib/utils';
import { openSwapIntent } from '@/lib/swapIntent';
import { toast } from '@/hooks/use-toast';
import { useBalancesContext } from '@/providers/BalancesProvider';
import type { LendingMarket } from '@/hooks/useLendingMarkets';
import type { AavePosition } from '@/hooks/useAavePositions';
import type { MorphoVault, VaultPosition } from '@/lib/morpho/vaultsClient';

const AUTO_REFRESH_INTERVAL = 30000;

export default function Earn() {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const navigate = useNavigate();
  const { tokenBalances } = useBalancesContext();

  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'markets';
  const initialChainId = searchParams.get('chainId') ? parseInt(searchParams.get('chainId')!) : undefined;
  const [activeTab, setActiveTab] = useState(initialTab);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Chain filter
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>(initialChainId);

  // Wrong network check
  const supportedSet = new Set(SUPPORTED_CHAIN_IDS);
  const isWrongNetwork = isConnected && !supportedSet.has(walletChainId);

  // ─── Aave Markets (on-chain) ───
  const {
    markets: allAaveMarkets,
    loading: marketsLoading,
    errorMessage: marketsError,
    refresh: refreshMarkets,
    lastFetched,
    chainResults,
    partialFailures,
  } = useLendingMarkets(selectedChainId);

  // Filter by chain
  const aaveMarkets = selectedChainId
    ? allAaveMarkets.filter(m => m.chainId === selectedChainId)
    : allAaveMarkets;

  // ─── Aave Positions ───
  const {
    positions: aavePositions,
    chainAccountData,
    loading: positionsLoading,
    refresh: refreshPositions,
    totalSupplyUsd,
    totalBorrowUsd,
    totalCollateralUsd,
    totalAccountDebtUsd,
    totalAvailableBorrowsUsd,
    lowestHealthFactor,
    debugInfo: positionsDebugInfo,
  } = useAavePositions(allAaveMarkets);


  // ─── Morpho Vaults ───
  const {
    vaults: allVaults,
    vaultPositions,
    loading: vaultsLoading,
    error: vaultsError,
    refresh: refreshVaults,
    totalDepositedUsd,
  } = useMorphoVaults();

  const vaults = selectedChainId
    ? allVaults.filter(v => v.chainId === selectedChainId)
    : allVaults;

  // ─── Borrow hook (for repay) ───
  const {
    repayStep,
    repayError,
    repay: repayFn,
    resetRepayState,
  } = useAaveBorrow();

  // ─── Modal state ───
  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [isPositionDrawerOpen, setIsPositionDrawerOpen] = useState(false);
  const [isOverviewDrawerOpen, setIsOverviewDrawerOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<AavePosition | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<LendingMarket | null>(null);
  const [overviewPosition, setOverviewPosition] = useState<AavePosition | null>(null);
  const [overviewMarket, setOverviewMarket] = useState<LendingMarket | null>(null);
  const [withdrawPosition, setWithdrawPosition] = useState<AavePosition | null>(null);
  const [repayPosition, setRepayPosition] = useState<UserBorrowPosition | null>(null);
  const [selectedVault, setSelectedVault] = useState<MorphoVault | null>(null);
  const [selectedVaultPosition, setSelectedVaultPosition] = useState<VaultPosition | null>(null);
  const [vaultModalTab, setVaultModalTab] = useState<'deposit' | 'withdraw'>('deposit');

  // ─── Auto-refresh ───
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => {
      refreshMarkets();
      refreshVaults();
      if (isConnected) refreshPositions();
    }, AUTO_REFRESH_INTERVAL);
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [refreshMarkets, refreshVaults, refreshPositions, isConnected]);

  // ─── Auto switch chain ───
  const handleSwitchChain = useCallback(async (targetChainId: number) => {
    try {
      await switchChainAsync({ chainId: targetChainId });
      toast({ title: 'Network Switched' });
    } catch {
      toast({ title: 'Switch Failed', variant: 'destructive' });
    }
  }, [switchChainAsync]);

  // ─── Supply action ───
  const handleSupply = useCallback(async (market: LendingMarket) => {
    if (!isConnected) {
      toast({ title: 'Connect Wallet', variant: 'destructive' });
      return;
    }
    if (walletChainId !== market.chainId) {
      await handleSwitchChain(market.chainId);
    }
    setSelectedMarket(market);
    setIsSupplyModalOpen(true);
  }, [isConnected, walletChainId, handleSwitchChain]);

  // ─── Borrow action ───
  const handleBorrow = useCallback(async (market: LendingMarket) => {
    if (!isConnected) {
      toast({ title: 'Connect Wallet', variant: 'destructive' });
      return;
    }
    if (walletChainId !== market.chainId) {
      await handleSwitchChain(market.chainId);
    }
    setSelectedMarket(market);
    setIsBorrowModalOpen(true);
  }, [isConnected, walletChainId, handleSwitchChain]);

  // ─── Vault action ───
  const handleVaultAction = useCallback(async (vault: MorphoVault, action: 'deposit' | 'withdraw') => {
    if (!isConnected) {
      toast({ title: 'Connect Wallet', variant: 'destructive' });
      return;
    }
    if (walletChainId !== vault.chainId) {
      await handleSwitchChain(vault.chainId);
    }
    setSelectedVault(vault);
    setVaultModalTab(action);
    const pos = vaultPositions.find(vp => vp.vaultAddress.toLowerCase() === vault.address.toLowerCase() && vp.chainId === vault.chainId);
    setSelectedVaultPosition(pos || null);
    setIsVaultModalOpen(true);
  }, [isConnected, vaultPositions, walletChainId, handleSwitchChain]);

  // ─── Withdraw action (opens dedicated withdraw modal) ───
  const handleWithdraw = useCallback(async (position: AavePosition) => {
    if (!isConnected) {
      toast({ title: 'Connect Wallet', variant: 'destructive' });
      return;
    }
    if (walletChainId !== position.chainId) {
      await handleSwitchChain(position.chainId);
    }
    setWithdrawPosition(position);
    setIsWithdrawModalOpen(true);
  }, [isConnected, walletChainId, handleSwitchChain]);

  // ─── Repay action (opens dedicated repay modal) ───
  const handleRepay = useCallback(async (position: AavePosition) => {
    if (!isConnected) {
      toast({ title: 'Connect Wallet', variant: 'destructive' });
      return;
    }
    if (walletChainId !== position.chainId) {
      await handleSwitchChain(position.chainId);
    }
    // Convert AavePosition → UserBorrowPosition for the repay modal
    const borrowPos: UserBorrowPosition = {
      assetAddress: position.assetAddress,
      assetSymbol: position.assetSymbol,
      assetName: position.assetName,
      assetLogo: position.assetLogo,
      chainId: position.chainId,
      chainName: position.chainName,
      currentVariableDebt: position.variableDebt,
      currentStableDebt: 0n,
      variableDebtFormatted: position.variableDebtFormatted,
      stableDebtFormatted: '0',
      variableBorrowAPY: position.borrowApy,
      stableBorrowAPY: 0,
      decimals: position.decimals,
      rateMode: 'variable',
    };
    setRepayPosition(borrowPos);
    setIsRepayModalOpen(true);
  }, [isConnected, walletChainId, handleSwitchChain]);

  // ─── Open position drawer ───
  const handleManagePosition = useCallback((position: AavePosition) => {
    // Open the deep overview drawer instead of the simpler position drawer
    const matchingMarket = allAaveMarkets.find(m =>
      m.chainId === position.chainId && m.assetAddress.toLowerCase() === position.assetAddress.toLowerCase()
    );
    setOverviewPosition(position);
    setOverviewMarket(matchingMarket || position.market || null);
    setIsOverviewDrawerOpen(true);
  }, [allAaveMarkets]);

  // ─── Open overview from a market row (may not have position) ───
  const handleMarketDetails = useCallback((market: LendingMarket) => {
    const matchingPosition = aavePositions.find(p =>
      p.chainId === market.chainId && p.assetAddress.toLowerCase() === market.assetAddress.toLowerCase()
    );
    setOverviewPosition(matchingPosition || null);
    setOverviewMarket(market);
    setIsOverviewDrawerOpen(true);
  }, [aavePositions]);

  // ─── Close modal + refresh ───
  const handleCloseModal = useCallback(() => {
    setIsSupplyModalOpen(false);
    setIsBorrowModalOpen(false);
    setIsVaultModalOpen(false);
    setIsPositionDrawerOpen(false);
    setIsOverviewDrawerOpen(false);
    setSelectedMarket(null);
    setSelectedPosition(null);
    setOverviewPosition(null);
    setOverviewMarket(null);
    setSelectedVault(null);
    setSelectedVaultPosition(null);
    refreshMarkets();
    refreshPositions();
    refreshVaults();
  }, [refreshMarkets, refreshPositions, refreshVaults]);

  // Compute chain account for the currently open overview drawer
  const overviewChainAccount = useMemo(() => {
    const cid = overviewPosition?.chainId || overviewMarket?.chainId;
    if (!cid) return null;
    return chainAccountData.find(d => d.chainId === cid) || null;
  }, [overviewPosition, overviewMarket, chainAccountData]);

  // ─── Swap navigation ───
  const goToSwap = useCallback((chainId: number, tokenSymbol: string, tokenAddress?: string) => {
    openSwapIntent({
      intentType: 'acquire_token',
      targetChainId: chainId,
      targetTokenAddress: tokenAddress || '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      targetSymbol: tokenSymbol,
      returnTo: { view: 'earn', tab: activeTab },
    });
  }, [activeTab]);

  // ─── Helpers ───
  const fmtAmount = (val: string) => {
    const n = parseFloat(val);
    if (!Number.isFinite(n) || n === 0) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
    if (n >= 1) return n.toFixed(4);
    return n.toFixed(6);
  };
  const formatUsd = (value: number) => {
    if (!Number.isFinite(value) || value === 0) return '$0.00';
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const lastFetchedDisplay = lastFetched
    ? (() => {
        const seconds = Math.floor((Date.now() - lastFetched) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        return `${Math.floor(seconds / 60)}m ago`;
      })()
    : null;

  const aavePositionCount = aavePositions.length;
  const vaultPositionCount = vaultPositions.length;

  // hasAaveActivity: true if the user has any Aave collateral or debt on any chain
  // This is authoritative from getUserAccountData, so it works even when per-asset
  // positions haven't loaded yet or prices are 0.
  const hasAaveActivity = totalCollateralUsd > 0 || totalAccountDebtUsd > 0;
  const totalPositionCount = aavePositionCount + vaultPositionCount;
  const netWorth = totalCollateralUsd + totalDepositedUsd - totalAccountDebtUsd;

  // Compute chain count from actual rendered markets
  const renderedChainIds = [...new Set(allAaveMarkets.map(m => Number(m.chainId)).filter(Boolean))];
  const chainsCount = renderedChainIds.length;
  const totalChains = chainResults.length || SUPPORTED_CHAIN_IDS.length;

  // Build userPositionMap for market table sorting/badges
  // hasSupply/hasBorrow use raw bigint so positions show even when price=0
  const userPositionMap = useMemo(() => {
    const map: Record<string, { suppliedUsd: number; borrowedUsd: number; hasSupply: boolean; hasBorrow: boolean }> = {};
    for (const pos of aavePositions) {
      const key = `${pos.chainId}-${pos.assetAddress.toLowerCase()}`;
      map[key] = {
        suppliedUsd: pos.supplyBalanceUsd,
        borrowedUsd: pos.variableDebtUsd,
        hasSupply: pos.supplyBalance > 0n,
        hasBorrow: pos.variableDebt > 0n,
      };
    }
    return map;
  }, [aavePositions]);

  // hasSupplied/hasBorrowed: check positions first, fall back to account data totals
  // This ensures sections render even when per-asset positions haven't loaded yet
  const hasSupplied = aavePositions.some(p => p.supplyBalance > 0n) || totalCollateralUsd > 0;
  const hasBorrowed = aavePositions.some(p => p.variableDebt > 0n) || totalAccountDebtUsd > 0;

  // ─── Derive accountData for selected market's chain from chainAccountData ───
  // This is passed to AaveBorrowModal so it can show HF / collateral / debt
  const borrowModalAccountData = useMemo(() => {
    if (!selectedMarket) return null;
    const chainData = chainAccountData.find(d => d.chainId === selectedMarket.chainId);
    if (!chainData) return null;
    const hfRaw = chainData.healthFactor;
    const hfBig = BigInt(Math.round(hfRaw * 1e18));
    const ltvBig = BigInt(Math.round(chainData.ltv * 100));
    const collBase = BigInt(Math.round(chainData.totalCollateralUsd * 1e8));
    const debtBase = BigInt(Math.round(chainData.totalDebtUsd * 1e8));
    const availBase = BigInt(Math.round(chainData.availableBorrowsUsd * 1e8));
    const maxBorrow = chainData.totalCollateralUsd * (chainData.ltv / 10000);
    const borrowLimitUsedPercent = maxBorrow > 0 ? (chainData.totalDebtUsd / maxBorrow) * 100 : 0;
    return {
      totalCollateralBase: collBase,
      totalDebtBase: debtBase,
      availableBorrowsBase: availBase,
      currentLiquidationThreshold: BigInt(Math.round((chainData.liquidationThreshold ?? 0) * 100)),
      ltv: ltvBig,
      healthFactor: hfBig,
      totalCollateralUsd: chainData.totalCollateralUsd,
      totalDebtUsd: chainData.totalDebtUsd,
      availableBorrowsUsd: chainData.availableBorrowsUsd,
      healthFactorFormatted: hfRaw > 1e10 ? Infinity : hfRaw,
      borrowLimitUsedPercent,
    };
  }, [selectedMarket, chainAccountData]);

  return (
    <Layout>
      <SeoHead />
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <SeoContentBlock>
          <h1>Earn Yield with DeFi Lending &amp; Vaults</h1>
          <p>
            Supply and borrow crypto assets through <strong>Aave V3</strong> lending markets across
            Ethereum, Arbitrum, Optimism, Polygon, Base, and Avalanche. Earn yield in <strong>Morpho vaults</strong>.
          </p>
        </SeoContentBlock>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold">
                  <span className="text-gradient">Earn</span>
                </h1>
                <Badge variant="outline" className="text-xs px-2 h-5 border-primary/40 text-primary bg-primary/10">
                  <Rocket className="w-3 h-3 mr-1" />
                  Aave V3
                </Badge>
                {chainsCount > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 h-5 border-success/30 text-success">
                    {chainsCount}/{totalChains} chains
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                On-chain Aave V3 markets • {allAaveMarkets.length} assets across {chainsCount} chains
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={selectedChainId?.toString() || 'all'}
                onValueChange={(val) => setSelectedChainId(val === 'all' ? undefined : parseInt(val))}
              >
                <SelectTrigger className="w-[160px] h-10">
                  <SelectValue placeholder="Select chain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4" />
                      <span>All Chains</span>
                    </div>
                  </SelectItem>
                  {LENDING_CHAINS.map(chain => (
                    <SelectItem key={chain.id} value={chain.id.toString()}>
                      <div className="flex items-center gap-2">
                        <ChainIcon chainId={chain.id} size="sm" />
                        <span>{chain.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() => { refreshMarkets(); refreshPositions(); refreshVaults(); }}
                disabled={marketsLoading || positionsLoading}
                className="h-10 w-10"
              >
                <RefreshCw className={cn("w-4 h-4", (marketsLoading || positionsLoading) && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Chain badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={cn(
                "h-7 px-3 gap-1.5 text-sm font-medium cursor-pointer transition-colors",
                !selectedChainId ? "bg-primary/20 border-primary/50 text-primary" : "border-border/50 text-muted-foreground hover:border-primary/30"
              )}
              onClick={() => setSelectedChainId(undefined)}
            >
              All Chains
            </Badge>
            {LENDING_CHAINS.map(chain => {
              const chainMarketCount = allAaveMarkets.filter(m => m.chainId === chain.id).length;
              return (
                <Badge
                  key={chain.id}
                  variant="outline"
                  className={cn(
                    "h-7 px-3 gap-1.5 text-sm font-medium cursor-pointer transition-colors",
                    selectedChainId === chain.id
                      ? "bg-primary/20 border-primary/50 text-primary"
                      : "border-border/50 text-muted-foreground hover:border-primary/30"
                  )}
                  onClick={() => setSelectedChainId(selectedChainId === chain.id ? undefined : chain.id)}
                >
                  <ChainIcon chainId={chain.id} size="sm" />
                  {chain.name}
                </Badge>
              );
            })}
          </div>

          {/* Wrong network */}
          {isWrongNetwork && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-warning/10 border border-warning/30">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-warning">Wrong Network</p>
                <p className="text-xs text-muted-foreground">
                  Earn is available on Ethereum, Arbitrum, Optimism, Polygon, Base, and Avalanche.
                </p>
              </div>
              <Button size="sm" onClick={() => handleSwitchChain(1)} className="gap-1.5">Switch to Ethereum</Button>
            </div>
          )}

          {/* Partial failures */}
          {partialFailures.length > 0 && partialFailures.length < totalChains && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-xs">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-warning">Some chains unavailable: </span>
                <span className="text-muted-foreground">
                  {partialFailures.map(f => f.chainName).join(', ')} — RPC rate limited. Markets from other chains loaded successfully.
                </span>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-foreground">
                <strong>Non-custodial.</strong> All data from official Aave V3 on-chain contracts. Markets by Aave V3, Vaults by Morpho Blue.
              </p>
            </div>
            <Link to="/docs" className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0">
              Learn more <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {/* ─── DEV DEBUG PANEL ─── */}
          {import.meta.env.DEV && isConnected && positionsDebugInfo.length > 0 && (
            <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-xs font-mono space-y-1">
              <div className="font-semibold text-foreground mb-2 flex items-center gap-2">
                🛠 Positions Debug (DEV only)
                <span className="font-normal text-muted-foreground">
                  — {aavePositions.length} total positions
                </span>
              </div>
              {positionsDebugInfo.map(d => (
                <div key={d.chainId} className={cn(
                  "flex items-center gap-2",
                  d.dataSource === 'failed' ? 'text-destructive' :
                  d.dataSource === 'subgraph' ? 'text-warning' : 'text-success'
                )}>
                  <span className="w-20 shrink-0">{d.chainName}</span>
                  <span className="w-20 shrink-0 uppercase">[{d.dataSource}]</span>
                  <span className="w-24 shrink-0">{d.positionsFound} positions</span>
                  <span className="w-20 shrink-0">acct: {d.accountDataFetched ? '✓' : '✗'}</span>
                  {d.error && <span className="text-destructive truncate max-w-xs" title={d.error}>{d.error.substring(0, 60)}</span>}
                </div>
              ))}
            </div>
          )}

          {/* ─── DASHBOARD: Aave Portfolio Card + Morpho Vaults Card (separate) ─── */}
          {isConnected && (hasAaveActivity || totalPositionCount > 0 || totalDepositedUsd > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* ── YOUR SUPPLIES PANEL (Aave-style) ── */}
              {hasAaveActivity && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass rounded-xl border border-success/15 overflow-hidden"
                >
                  {/* Panel header */}
                  <div className="px-5 py-3.5 bg-success/5 border-b border-success/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-success/15 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-success" />
                      </div>
                      <h2 className="font-bold text-sm text-foreground">Your supplies</h2>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-success">
                        {formatUsd(totalSupplyUsd > 0 ? totalSupplyUsd : totalCollateralUsd)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Balance</div>
                    </div>
                  </div>

                  {/* Summary metrics row */}
                  <div className="grid grid-cols-3 gap-px bg-border/10">
                    <div className="px-3 py-2.5 bg-background">
                      <div className="text-[10px] text-muted-foreground">Collateral</div>
                      <div className="text-sm font-semibold text-primary">{formatUsd(totalCollateralUsd)}</div>
                    </div>
                    <div className="px-3 py-2.5 bg-background">
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Percent className="w-2.5 h-2.5" /> APY (weighted)
                      </div>
                      <div className="text-sm font-semibold text-success">
                        {(() => {
                          const supplied = aavePositions.filter(p => p.supplyBalance > 0n && p.supplyBalanceUsd > 0);
                          if (supplied.length === 0) return '—';
                          const total = supplied.reduce((s, p) => s + p.supplyBalanceUsd, 0);
                          if (total === 0) return '—';
                          const wApy = supplied.reduce((s, p) => s + p.supplyApy * p.supplyBalanceUsd, 0) / total;
                          return `${wApy.toFixed(2)}%`;
                        })()}
                      </div>
                    </div>
                    <div className="px-3 py-2.5 bg-background">
                      <div className="text-[10px] text-muted-foreground"># Assets</div>
                      <div className="text-sm font-semibold text-foreground">
                        {aavePositions.filter(p => p.supplyBalance > 0n).length || '—'}
                      </div>
                    </div>
                  </div>

                  {/* Inline token rows */}
                  <div className="divide-y divide-border/10">
                    {aavePositions
                      .filter(p => p.supplyBalance > 0n)
                      .sort((a, b) => b.supplyBalanceUsd - a.supplyBalanceUsd)
                      .map(pos => (
                        <div
                          key={`panel-supply-${pos.chainId}-${pos.assetAddress}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-success/5 cursor-pointer transition-colors group"
                          onClick={() => handleManagePosition(pos)}
                        >
                          <div className="relative flex-shrink-0">
                            <TokenIcon address={pos.assetAddress} symbol={pos.assetSymbol} chainId={pos.chainId}
                              logoUrl={pos.assetLogo} size="sm" className="w-8 h-8 ring-2 ring-success/30" />
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-background overflow-hidden">
                              <ChainIcon chainId={pos.chainId} size="sm" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm">{pos.assetSymbol}</span>
                              <Badge className="h-4 px-1.5 text-[9px] bg-success/15 border-success/30 text-success border font-semibold">SUPPLIED</Badge>
                              {pos.isCollateralEnabled && <ShieldCheck className="w-3 h-3 text-success opacity-70" />}
                            </div>
                            <div className="text-[11px] text-muted-foreground">{pos.chainName}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-bold">{pos.supplyBalanceUsd > 0 ? formatUsd(pos.supplyBalanceUsd) : fmtAmount(pos.supplyBalanceFormatted)}</div>
                            <div className="text-[10px] text-success font-medium">{pos.supplyApy.toFixed(2)}% APY</div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))
                    }
                    {aavePositions.filter(p => p.supplyBalance > 0n).length === 0 && totalCollateralUsd > 0 && (
                      <div className="px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-success" />
                        {formatUsd(totalCollateralUsd)} collateral detected — positions still indexing.
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-success" onClick={refreshPositions}>
                          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── YOUR BORROWS PANEL (Aave-style) ── */}
              {hasAaveActivity && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass rounded-xl border border-warning/15 overflow-hidden"
                >
                  {/* Panel header */}
                  <div className="px-5 py-3.5 bg-warning/5 border-b border-warning/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-warning/15 flex items-center justify-center">
                        <TrendingDown className="w-4 h-4 text-warning" />
                      </div>
                      <h2 className="font-bold text-sm text-foreground">Your borrows</h2>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-warning">
                        {formatUsd(totalBorrowUsd > 0 ? totalBorrowUsd : totalAccountDebtUsd)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Debt</div>
                    </div>
                  </div>

                  {/* Summary metrics row */}
                  <div className="grid grid-cols-3 gap-px bg-border/10">
                    <div className="px-3 py-2.5 bg-background">
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Heart className="w-2.5 h-2.5" /> Health Factor
                      </div>
                      <div className={cn(
                        "text-sm font-bold",
                        lowestHealthFactor === null || (lowestHealthFactor && lowestHealthFactor > 1e10) ? "text-success" :
                        lowestHealthFactor > 1.5 ? "text-success" :
                        lowestHealthFactor > 1 ? "text-warning" : "text-destructive"
                      )}>
                        {lowestHealthFactor === null ? '∞' : lowestHealthFactor > 1e10 ? '∞' : lowestHealthFactor.toFixed(2)}
                      </div>
                    </div>
                    <div className="px-3 py-2.5 bg-background">
                      <div className="text-[10px] text-muted-foreground">Borrow Power Used</div>
                      <div className="text-sm font-semibold text-foreground">
                        {(() => {
                          if (totalCollateralUsd === 0) return '0%';
                          // Approximate borrow power used from account data
                          const maxBorrow = totalCollateralUsd * 0.8; // approximate avg LTV
                          const used = maxBorrow > 0 ? (totalAccountDebtUsd / maxBorrow) * 100 : 0;
                          return `${Math.min(used, 100).toFixed(1)}%`;
                        })()}
                      </div>
                    </div>
                    <div className="px-3 py-2.5 bg-background">
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Percent className="w-2.5 h-2.5" /> APY (weighted)
                      </div>
                      <div className="text-sm font-semibold text-warning">
                        {(() => {
                          const borrowed = aavePositions.filter(p => p.variableDebt > 0n && p.variableDebtUsd > 0);
                          if (borrowed.length === 0) return '—';
                          const total = borrowed.reduce((s, p) => s + p.variableDebtUsd, 0);
                          if (total === 0) return '—';
                          const wApy = borrowed.reduce((s, p) => s + p.borrowApy * p.variableDebtUsd, 0) / total;
                          return `${wApy.toFixed(2)}%`;
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Health Factor bar (inline) */}
                  {totalAccountDebtUsd > 0 && lowestHealthFactor !== null && lowestHealthFactor < 1e10 && (
                    <div className="px-4 py-2 bg-background border-b border-border/10">
                      <RiskBar healthFactor={lowestHealthFactor} showLabel={false} size="sm" />
                    </div>
                  )}

                  {/* Inline token rows */}
                  <div className="divide-y divide-border/10">
                    {aavePositions
                      .filter(p => p.variableDebt > 0n)
                      .sort((a, b) => b.variableDebtUsd - a.variableDebtUsd)
                      .map(pos => (
                        <div
                          key={`panel-borrow-${pos.chainId}-${pos.assetAddress}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-warning/5 cursor-pointer transition-colors group"
                          onClick={() => handleManagePosition(pos)}
                        >
                          <div className="relative flex-shrink-0">
                            <TokenIcon address={pos.assetAddress} symbol={pos.assetSymbol} chainId={pos.chainId}
                              logoUrl={pos.assetLogo} size="sm" className="w-8 h-8 ring-2 ring-warning/30" />
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-background overflow-hidden">
                              <ChainIcon chainId={pos.chainId} size="sm" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm">{pos.assetSymbol}</span>
                              <Badge className="h-4 px-1.5 text-[9px] bg-warning/15 border-warning/30 text-warning border font-semibold">BORROWED</Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground">{pos.chainName} · Variable rate</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-bold text-warning">{pos.variableDebtUsd > 0 ? formatUsd(pos.variableDebtUsd) : fmtAmount(pos.variableDebtFormatted)}</div>
                            <div className="text-[10px] text-warning font-medium">{pos.borrowApy.toFixed(2)}% APY</div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))
                    }
                    {aavePositions.filter(p => p.variableDebt > 0n).length === 0 && totalAccountDebtUsd > 0 && (
                      <div className="px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                        {formatUsd(totalAccountDebtUsd)} debt detected — positions still indexing.
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-warning" onClick={refreshPositions}>
                          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                        </Button>
                      </div>
                    )}
                    {aavePositions.filter(p => p.variableDebt > 0n).length === 0 && totalAccountDebtUsd === 0 && (
                      <div className="px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
                        <Info className="w-3.5 h-3.5" />
                        No active borrows. Supply collateral and borrow from the Markets tab.
                      </div>
                    )}
                  </div>

                  {/* HF warning below panel */}
                  {lowestHealthFactor !== null && lowestHealthFactor < 1.5 && lowestHealthFactor < 1e10 && (
                    <div className={cn(
                      "mx-4 mb-3 mt-1 rounded-lg px-3 py-2 flex items-center gap-2 text-xs",
                      lowestHealthFactor < 1 ? "bg-destructive/10 border border-destructive/30 text-destructive" :
                      "bg-warning/10 border border-warning/30 text-warning"
                    )}>
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      {lowestHealthFactor < 1
                        ? "⚠️ Liquidation risk! Health Factor below 1. Repay debt immediately."
                        : "Health Factor is low. Consider repaying some debt."
                      }
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Morpho Vaults Card ── */}
              {(totalDepositedUsd > 0 || vaultPositionCount > 0) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass rounded-xl p-5 border border-primary/10"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      Morpho Vaults
                    </h2>
                    {vaultPositionCount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {vaultPositionCount} vault{vaultPositionCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        Total Deposited
                      </div>
                      <div className="text-lg font-semibold text-primary">{formatUsd(totalDepositedUsd)}</div>
                    </div>
                    {vaultPositions.length > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Percent className="w-3 h-3" />
                          Avg APY
                        </div>
                        <div className="text-lg font-semibold text-success">
                          {(() => {
                            const active = vaultPositions.filter(vp => vp.assetsUsd > 0 && vp.vault && vp.vault.apy > 0);
                            if (active.length === 0) return '—';
                            const totalVal = active.reduce((s, vp) => s + vp.assetsUsd, 0);
                            if (totalVal === 0) return '—';
                            const wAvg = active.reduce((s, vp) => s + vp.vault!.apy * vp.assetsUsd, 0) / totalVal;
                            return `${wAvg.toFixed(2)}%`;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Individual vault deposits */}
                  {vaultPositions.slice(0, 3).map(vp => (
                    <div key={`${vp.chainId}-${vp.vaultAddress}`}
                      className="flex items-center justify-between py-2 border-t border-border/20 text-xs">
                      <div className="flex items-center gap-2">
                        <ChainIcon chainId={vp.chainId} size="sm" />
                        <span className="font-medium truncate max-w-[120px]">{vp.vault?.name || 'Vault'}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{vp.assetsUsd > 0 ? formatUsd(vp.assetsUsd) : '—'}</div>
                        {vp.vault && vp.vault.apy > 0 && (
                          <div className="text-success">{vp.vault.apy.toFixed(2)}% APY</div>
                        )}
                      </div>
                    </div>
                  ))}
                  {vaultPositions.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center pt-2">
                      +{vaultPositions.length - 3} more vaults
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full max-w-lg grid-cols-3">
              <TabsTrigger value="markets" className="gap-2">
                <LayoutGrid className="w-4 h-4" />
                Markets
                {aaveMarkets.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {aaveMarkets.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="vaults" className="gap-2">
                <Shield className="w-4 h-4" />
                Vaults
                {vaults.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {vaults.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="positions" className="gap-2">
                <List className="w-4 h-4" />
                Positions
                {aavePositionCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-success/20 text-success">
                    {aavePositionCount}
                  </Badge>
                )}
                {vaultPositionCount > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-xs bg-primary/20 text-primary">
                    +{vaultPositionCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Markets Tab — Aave V3 */}
            <TabsContent value="markets" className="space-y-4">

              {/* ─── Account Health Bar (when connected + has positions) ─── */}
              {isConnected && (hasSupplied || hasBorrowed) && (
                <AccountHealthBar
                  chainAccountData={chainAccountData}
                  totalCollateralUsd={totalCollateralUsd}
                  totalDebtUsd={totalAccountDebtUsd}
                  lowestHealthFactor={lowestHealthFactor}
                />
              )}

              {/* ─── Your Supplies Section ─── */}
              {isConnected && hasSupplied && (
                <YourSuppliesSection
                  positions={aavePositions}
                  loading={positionsLoading && aavePositions.length === 0}
                  accountCollateralUsd={totalCollateralUsd}
                  onSupply={handleSupply}
                  onWithdraw={handleWithdraw}
                  onSwap={goToSwap}
                  onManage={handleManagePosition}
                  onRefresh={refreshPositions}
                />
              )}

              {/* ─── Your Borrows Section ─── */}
              {isConnected && hasBorrowed && (
                <YourBorrowsSection
                  positions={aavePositions}
                  loading={positionsLoading && aavePositions.length === 0}
                  accountDebtUsd={totalAccountDebtUsd}
                  onBorrow={handleBorrow}
                  onRepay={handleRepay}
                  onSwap={goToSwap}
                  onManage={handleManagePosition}
                  onRefresh={refreshPositions}
                />
              )}

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Aave V3 On-Chain:</span>
                    <span className="font-medium">{aaveMarkets.length} reserves</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {isConnected && (
                    <span className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      Connected
                    </span>
                  )}
                  {lastFetchedDisplay && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {lastFetchedDisplay}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    Auto-refresh 30s
                  </span>
                </div>
              </div>

              <AaveMarketsTable
                markets={aaveMarkets}
                loading={marketsLoading}
                error={marketsError}
                onRefresh={refreshMarkets}
                onSupply={handleSupply}
                onBorrow={handleBorrow}
                onDetails={handleMarketDetails}
                hasCollateral={totalCollateralUsd > 0 || hasSupplied}
                userPositionMap={userPositionMap}
                walletBalances={(() => {
                  const map: Record<string, number> = {};
                  for (const tb of tokenBalances) {
                    const key = `${tb.chainId}:${tb.token.address.toLowerCase()}`;
                    map[key] = (map[key] || 0) + tb.balanceUSD;
                  }
                  return map;
                })()}
              />
            </TabsContent>


            {/* Vaults Tab — Morpho */}
            <TabsContent value="vaults" className="space-y-4">
              <MorphoVaultsTable
                vaults={vaults}
                vaultPositions={vaultPositions}
                loading={vaultsLoading}
                error={vaultsError}
                onRefresh={refreshVaults}
                onVaultAction={handleVaultAction}
              />
            </TabsContent>

            {/* Positions Tab */}
            <TabsContent value="positions" className="space-y-4">
              {!isConnected ? (
                <div className="glass rounded-xl p-8 text-center">
                  <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
                  <p className="text-muted-foreground mb-4">Connect your wallet to view positions across all chains</p>
                </div>
              ) : positionsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="glass rounded-xl p-4 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-24 bg-muted rounded" />
                          <div className="h-3 w-16 bg-muted rounded" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : totalPositionCount === 0 && !hasAaveActivity ? (
                <div className="glass rounded-xl p-8 text-center">
                  <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">No Positions Yet</h3>
                  <p className="text-muted-foreground mb-4">Start earning by supplying assets to Aave markets or depositing into vaults</p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={() => setActiveTab('markets')}>Browse Markets</Button>
                    <Button variant="outline" onClick={() => navigate('/')}>
                      <Repeat className="w-4 h-4 mr-1" />
                      Get Tokens via Swap
                    </Button>
                  </div>
                </div>
              ) : (
                <Tabs defaultValue="aave" className="space-y-4">
                  <TabsList className="h-9">
                    <TabsTrigger value="aave" className="text-xs gap-1.5 px-4">
                      <LayoutGrid className="w-3.5 h-3.5" />
                      Aave Positions
                      {aavePositionCount > 0 && (
                        <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px] bg-success/20 text-success">
                          {aavePositionCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="morpho" className="text-xs gap-1.5 px-4">
                      <Shield className="w-3.5 h-3.5" />
                      Morpho Vaults
                      {vaultPositionCount > 0 && (
                        <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px] bg-primary/20 text-primary">
                          {vaultPositionCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Aave Positions Subtab ── */}
                  <TabsContent value="aave" className="space-y-4">
                    {/* Chain Account Health */}
                    {chainAccountData.filter(d => d.totalCollateralUsd > 0 || d.totalDebtUsd > 0).length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Aave Account Health by Chain
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {chainAccountData
                            .filter(d => d.totalCollateralUsd > 0 || d.totalDebtUsd > 0)
                            .map(data => (
                              <div key={data.chainId} className="glass rounded-lg p-3 border border-primary/10">
                                <div className="flex items-center gap-2 mb-2">
                                  <ChainIcon chainId={data.chainId} size="sm" />
                                  <span className="text-sm font-medium">{data.chainName}</span>
                                  <Badge variant="outline" className="ml-auto text-[9px] h-4 px-1">Aave V3</Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <div className="text-muted-foreground">Collateral</div>
                                    <div className="font-medium">{formatUsd(data.totalCollateralUsd)}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Debt</div>
                                    <div className="font-medium text-warning">{formatUsd(data.totalDebtUsd)}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Available</div>
                                    <div className="font-medium text-success">{formatUsd(data.availableBorrowsUsd)}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Health</div>
                                    <div className={cn(
                                      "font-medium",
                                      data.healthFactor > 1e10 ? "text-success" :
                                      data.healthFactor > 1.5 ? "text-success" :
                                      data.healthFactor > 1 ? "text-warning" : "text-destructive"
                                    )}>
                                      {data.healthFactor > 1e10 ? '∞' : data.healthFactor.toFixed(2)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Aave position cards */}
                    {aavePositions.length > 0 ? (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <LayoutGrid className="w-4 h-4" />
                          Aave Market Positions ({aavePositions.length})
                        </h3>
                        {aavePositions.map(pos => (
                          <AavePositionCard
                            key={`${pos.chainId}-${pos.assetAddress}`}
                            position={pos}
                            onSupply={(p) => { if (p.market) handleSupply(p.market); }}
                            onWithdraw={(p) => { handleWithdraw(p); }}
                            onRepay={(p) => { handleRepay(p); }}
                            onSwap={(chainId, symbol, addr) => goToSwap(chainId, symbol, addr)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="glass rounded-xl p-6 text-center">
                        <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No Aave positions found.</p>
                        <Button size="sm" className="mt-3" onClick={() => setActiveTab('markets')}>
                          Supply to Aave
                        </Button>
                      </div>
                    )}
                  </TabsContent>

                  {/* ── Morpho Vault Positions Subtab ── */}
                  <TabsContent value="morpho" className="space-y-4">
                    {vaultPositions.length > 0 ? (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Morpho Vault Deposits ({vaultPositions.length})
                        </h3>
                        {vaultPositions.map(vp => (
                          <div key={`${vp.chainId}-${vp.vaultAddress}`}
                            className="glass rounded-xl p-4 border border-primary/10">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Shield className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                  <div className="font-medium text-sm flex items-center gap-1.5">
                                    {vp.vault?.name || 'Vault'}
                                    <Badge variant="outline" className="text-[9px] h-4 px-1">Morpho</Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <ChainIcon chainId={vp.chainId} size="sm" />
                                    {vp.vault?.asset.symbol || '???'}
                                    {vp.vault?.curator && <span>• {vp.vault.curator}</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-sm text-primary">
                                  {vp.assetsUsd > 0 ? formatUsd(vp.assetsUsd) : '—'}
                                </div>
                                {vp.vault && vp.vault.apy > 0 && (
                                  <div className="text-xs text-success">{vp.vault.apy.toFixed(2)}% APY</div>
                                )}
                              </div>
                            </div>
                            {vp.vault && (
                              <div className="flex gap-2 mt-3">
                                <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => handleVaultAction(vp.vault!, 'deposit')}>
                                  <TrendingUp className="w-3 h-3" />
                                  Deposit More
                                </Button>
                                <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => handleVaultAction(vp.vault!, 'withdraw')}>
                                  <Wallet className="w-3 h-3" />
                                  Withdraw
                                </Button>
                                <Button size="sm" variant="ghost" className="gap-1" onClick={() => goToSwap(vp.chainId, vp.vault!.asset.symbol, vp.vault!.asset.address)}>
                                  <Repeat className="w-3 h-3" />
                                  Swap
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="glass rounded-xl p-6 text-center">
                        <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No Morpho vault deposits found.</p>
                        <Button size="sm" className="mt-3" onClick={() => setActiveTab('vaults')}>
                          Explore Vaults
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border/30">
            <p>All market data from official Aave V3 on-chain contracts • Vaults by Morpho Blue</p>
            <p className="mt-1 flex items-center justify-center gap-3">
              <a href="https://aave.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Aave</a>
              <span>•</span>
              <a href="https://app.morpho.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Morpho</a>
              <span>•</span>
              <Link to="/docs" className="text-primary hover:underline">Docs</Link>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Modals */}
      <AaveSupplyModal
        open={isSupplyModalOpen}
        onClose={handleCloseModal}
        market={selectedMarket}
      />

      <AaveBorrowModal
        open={isBorrowModalOpen}
        onClose={handleCloseModal}
        market={selectedMarket}
        accountData={borrowModalAccountData}
      />

      <MorphoVaultActionModal
        isOpen={isVaultModalOpen}
        onClose={handleCloseModal}
        vault={selectedVault}
        userPosition={selectedVaultPosition}
        onSuccess={() => { refreshVaults(); refreshPositions(); }}
      />

      <AavePositionDrawer
        open={isPositionDrawerOpen}
        onClose={() => setIsPositionDrawerOpen(false)}
        position={selectedPosition}
        healthFactor={lowestHealthFactor ?? undefined}
        onSupply={handleSupply}
        onWithdraw={handleWithdraw}
        onBorrow={handleBorrow}
        onRepay={handleRepay}
      />

      <AaveReserveOverviewDrawer
        open={isOverviewDrawerOpen}
        onClose={() => setIsOverviewDrawerOpen(false)}
        position={overviewPosition}
        market={overviewMarket}
        chainAccount={overviewChainAccount}
        walletBalanceUsd={(() => {
          const addr = overviewPosition?.assetAddress || overviewMarket?.assetAddress;
          const cid = overviewPosition?.chainId || overviewMarket?.chainId;
          if (!addr || !cid) return 0;
          const key = `${cid}:${addr.toLowerCase()}`;
          const tb = tokenBalances.find(t => `${t.chainId}:${t.token.address.toLowerCase()}` === key);
          return tb?.balanceUSD || 0;
        })()}
        onSupply={handleSupply}
        onWithdraw={handleWithdraw}
        onBorrow={handleBorrow}
        onRepay={handleRepay}
        onSwap={goToSwap}
      />
    </Layout>
  );
}
