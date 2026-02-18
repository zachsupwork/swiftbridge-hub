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
  Clock,
  Rocket,
  Wallet,
  LayoutGrid,
  List,
  ExternalLink,
  Shield,
  Info,
  Repeat,
  Heart,
  DollarSign,
  Percent,
  AlertCircle,
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
import { AccountHealthBar } from '@/components/earn/AccountHealthBar';
import { useLendingMarkets, SUPPORTED_CHAIN_IDS, LENDING_CHAINS } from '@/hooks/useLendingMarkets';
import { useAavePositions } from '@/hooks/useAavePositions';
import { useAaveBorrow } from '@/hooks/useAaveBorrow';
import { useMorphoVaults } from '@/hooks/useMorphoVaults';
import { RiskBar } from '@/components/common/RiskBar';
import { ChainIcon } from '@/components/common/ChainIcon';
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
    lowestHealthFactor,
  } = useAavePositions(allAaveMarkets);

  // ─── Aave Borrow (for account data) ───
  const { accountData } = useAaveBorrow();

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

  // ─── Modal state ───
  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<LendingMarket | null>(null);
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

  // ─── Withdraw action (opens supply modal for now, Aave withdraw is same modal) ───
  const handleWithdraw = useCallback(async (position: AavePosition) => {
    if (position.market) {
      await handleSupply(position.market);
    }
  }, [handleSupply]);

  // ─── Repay action (opens borrow modal) ───
  const handleRepay = useCallback(async (position: AavePosition) => {
    if (!isConnected) {
      toast({ title: 'Connect Wallet', variant: 'destructive' });
      return;
    }
    if (position.market) {
      if (walletChainId !== position.market.chainId) {
        await handleSwitchChain(position.market.chainId);
      }
      setSelectedMarket(position.market);
      setIsBorrowModalOpen(true);
    }
  }, [isConnected, walletChainId, handleSwitchChain]);

  // ─── Close modal + refresh ───
  const handleCloseModal = useCallback(() => {
    setIsSupplyModalOpen(false);
    setIsBorrowModalOpen(false);
    setIsVaultModalOpen(false);
    setSelectedMarket(null);
    setSelectedVault(null);
    setSelectedVaultPosition(null);
    refreshMarkets();
    refreshPositions();
    refreshVaults();
  }, [refreshMarkets, refreshPositions, refreshVaults]);

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

  const totalPositionCount = aavePositions.length + vaultPositions.length;
  const netWorth = totalSupplyUsd + totalDepositedUsd - totalBorrowUsd;

  // Compute chain count from actual rendered markets
  const renderedChainIds = [...new Set(allAaveMarkets.map(m => Number(m.chainId)).filter(Boolean))];
  const chainsCount = renderedChainIds.length;
  const totalChains = chainResults.length || SUPPORTED_CHAIN_IDS.length;

  // Build userPositionMap for market table sorting/badges
  const userPositionMap = useMemo(() => {
    const map: Record<string, { suppliedUsd: number; borrowedUsd: number }> = {};
    for (const pos of aavePositions) {
      const key = `${pos.chainId}-${pos.assetAddress.toLowerCase()}`;
      map[key] = {
        suppliedUsd: pos.supplyBalanceUsd,
        borrowedUsd: pos.variableDebtUsd,
      };
    }
    return map;
  }, [aavePositions]);

  const hasSupplied = aavePositions.some(p => p.supplyBalance > 0n);
  const hasBorrowed = aavePositions.some(p => p.variableDebt > 0n);

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

          {/* ─── DASHBOARD ─── */}
          {isConnected && (totalPositionCount > 0 || totalBorrowUsd > 0 || totalSupplyUsd > 0) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-primary" />
                  Your Dashboard
                </h2>
                <Badge variant="outline" className="text-xs">
                  {totalPositionCount} position{totalPositionCount !== 1 ? 's' : ''}
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Net Worth
                  </div>
                  <div className="text-lg font-bold text-foreground">{formatUsd(netWorth)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total Supplied</div>
                  <div className="text-lg font-semibold text-success">{formatUsd(totalSupplyUsd)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total Collateral</div>
                  <div className="text-lg font-semibold text-primary">{formatUsd(totalCollateralUsd)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total Borrowed</div>
                  <div className="text-lg font-semibold text-warning">{formatUsd(totalBorrowUsd)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Vault Deposits</div>
                  <div className="text-lg font-semibold text-primary">{formatUsd(totalDepositedUsd)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    Health Factor
                  </div>
                  <div className={cn(
                    "text-lg font-bold",
                    lowestHealthFactor === null ? "text-success" :
                    lowestHealthFactor > 1e10 ? "text-success" :
                    lowestHealthFactor > 1.5 ? "text-success" :
                    lowestHealthFactor > 1 ? "text-warning" : "text-destructive"
                  )}>
                    {lowestHealthFactor === null ? '∞' :
                     lowestHealthFactor > 1e10 ? '∞' :
                     lowestHealthFactor.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Health Factor bar */}
              {totalBorrowUsd > 0 && lowestHealthFactor !== null && lowestHealthFactor < 1e10 && (
                <div className="mt-4 pt-4 border-t border-border/30">
                  <RiskBar healthFactor={lowestHealthFactor} showLabel size="md" />
                  {lowestHealthFactor < 1 && (
                    <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/30">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      <span className="text-xs text-destructive font-medium">
                        Liquidation risk! Your health factor is below 1. Repay debt or add collateral immediately.
                      </span>
                    </div>
                  )}
                  {lowestHealthFactor >= 1 && lowestHealthFactor < 1.5 && (
                    <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-warning/10 border border-warning/30">
                      <AlertTriangle className="w-4 h-4 text-warning" />
                      <span className="text-xs text-warning font-medium">
                        Health factor is low. Consider repaying some debt.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
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
                {totalPositionCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {totalPositionCount}
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
                  totalDebtUsd={totalBorrowUsd}
                  lowestHealthFactor={lowestHealthFactor}
                />
              )}

              {/* ─── Your Supplies Section ─── */}
              {isConnected && hasSupplied && (
                <YourSuppliesSection
                  positions={aavePositions}
                  onSupply={handleSupply}
                  onWithdraw={handleWithdraw}
                  onSwap={goToSwap}
                />
              )}

              {/* ─── Your Borrows Section ─── */}
              {isConnected && hasBorrowed && (
                <YourBorrowsSection
                  positions={aavePositions}
                  onBorrow={handleBorrow}
                  onRepay={handleRepay}
                  onSwap={goToSwap}
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
                hasCollateral={totalCollateralUsd > 0}
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
              ) : totalPositionCount === 0 ? (
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
                <div className="space-y-6">
                  {/* Chain Account Summaries */}
                  {chainAccountData.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Account Health by Chain
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {chainAccountData.map(data => (
                          <div key={data.chainId} className="glass rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <ChainIcon chainId={data.chainId} size="sm" />
                              <span className="text-sm font-medium">{data.chainName}</span>
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

                  {/* Aave Positions */}
                  {aavePositions.length > 0 && (
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
                          onWithdraw={(p) => {
                            if (p.market?.protocolUrl) window.open(p.market.protocolUrl, '_blank');
                          }}
                          onRepay={(p) => {
                            if (p.market?.protocolUrl) window.open(p.market.protocolUrl, '_blank');
                          }}
                          onSwap={(chainId, symbol, addr) => goToSwap(chainId, symbol, addr)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Vault Positions */}
                  {vaultPositions.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Vault Deposits ({vaultPositions.length})
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
                                <div className="font-medium text-sm">{vp.vault?.name || 'Vault'}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                  <ChainIcon chainId={vp.chainId} size="sm" />
                                  {vp.vault?.asset.symbol || '???'}
                                  {vp.vault?.curator && <span>• {vp.vault.curator}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-sm text-primary">
                                {vp.assetsUsd > 0 ? `$${vp.assetsUsd.toFixed(2)}` : '—'}
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
                  )}
                </div>
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
        accountData={accountData}
      />

      <MorphoVaultActionModal
        isOpen={isVaultModalOpen}
        onClose={handleCloseModal}
        vault={selectedVault}
        userPosition={selectedVaultPosition}
        onSuccess={() => { refreshVaults(); refreshPositions(); }}
      />
    </Layout>
  );
}
