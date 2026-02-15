/**
 * Earn Page - Enhanced Morpho Blue lending interface
 * 
 * Features:
 * - Markets and Positions tabs
 * - In-app supply/borrow actions with platform fee
 * - User positions dashboard with health monitoring
 * - Before/After simulation in action modals
 * - How It Works educational section
 * - Debug report for troubleshooting
 * - Auto-refresh every 30 seconds
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  RefreshCw, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  Copy, 
  Check, 
  Rocket, 
  Bug,
  Wallet,
  LayoutGrid,
  List,
  ExternalLink,
  Shield,
  Info,
} from 'lucide-react';
import { useAccount, useChainId } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

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
import { MorphoMarketsTable } from '@/components/earn/MorphoMarketsTable';
import { MorphoVaultsTable } from '@/components/earn/MorphoVaultsTable';
import { MorphoPositionCard } from '@/components/earn/MorphoPositionCard';
import { HowItWorksDiagram } from '@/components/earn/HowItWorksDiagram';
import { MorphoSupplyModal } from '@/components/earn/MorphoSupplyModal';
import { MorphoBorrowModal } from '@/components/earn/MorphoBorrowModal';
import { MarketDetailsDrawer } from '@/components/earn/MarketDetailsDrawer';
import { useMorphoMarkets } from '@/hooks/useMorphoMarkets';
import { useMorphoPositions, type MorphoPositionWithHealth } from '@/hooks/useMorphoPositions';
import { useMorphoVaults } from '@/hooks/useMorphoVaults';
import { getEnabledMorphoChains, getMorphoChainConfig } from '@/lib/morpho/config';
import { RiskBar } from '@/components/common/RiskBar';
import { ChainIcon } from '@/components/common/ChainIcon';
import type { MorphoMarket } from '@/lib/morpho/types';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type ActionType = 'supply' | 'withdraw' | 'borrow' | 'repay';

const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

export default function Earn() {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();

  // Multi-chain: check if on any enabled Morpho chain
  const enabledChainIds = new Set(getEnabledMorphoChains().map(c => c.chainId));
  const isWrongNetwork = isConnected && !enabledChainIds.has(walletChainId);

  const [copiedDebug, setCopiedDebug] = useState(false);
  const [activeTab, setActiveTab] = useState('markets');
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);
  
  // Modal state - separate for supply, borrow, and details
  const [selectedMarket, setSelectedMarket] = useState<MorphoMarket | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<MorphoPositionWithHealth | null>(null);
  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);

  // Fetch Morpho markets
  const { 
    markets, 
    loading: marketsLoading, 
    error: marketsError, 
    refresh: refreshMarkets,
    lastFetched,
    selectedChainId,
    setSelectedChainId,
    availableChains,
    debugReport,
  } = useMorphoMarkets();

  // Fetch user positions
  const {
    positions,
    loading: positionsLoading,
    error: positionsError,
    refresh: refreshPositions,
    totalSupplyUsd,
    totalBorrowUsd,
    totalCollateralUsd,
  } = useMorphoPositions();

  // Fetch vaults
  const {
    vaults,
    vaultPositions,
    loading: vaultsLoading,
    error: vaultsError,
    refresh: refreshVaults,
    totalDepositedUsd,
  } = useMorphoVaults();

  // Get only enabled chains
  const enabledChains = availableChains;

  // Calculate aggregate health factor
  const aggregateHealthFactor = positions.reduce((acc, pos) => {
    if (pos.healthFactor !== null && pos.healthFactor < (acc || Infinity)) {
      return pos.healthFactor;
    }
    return acc;
  }, null as number | null);

  // Format last fetched time
  const lastFetchedDisplay = lastFetched 
    ? (() => {
        const seconds = Math.floor((Date.now() - lastFetched) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ago`;
      })()
    : null;

  // Auto-refresh effect
  useEffect(() => {
    const startAutoRefresh = () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
      autoRefreshRef.current = setInterval(() => {
        console.log('[Earn] Auto-refreshing data...');
        refreshMarkets();
        refreshVaults();
        if (isConnected) {
          refreshPositions();
        }
      }, AUTO_REFRESH_INTERVAL);
    };

    startAutoRefresh();

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [refreshMarkets, refreshPositions, isConnected]);

  // Copy debug report
  const handleCopyDebugReport = useCallback(() => {
    const report = JSON.stringify({
      ...debugReport,
      positions: {
        count: positions.length,
        totalSupplyUsd,
        totalBorrowUsd,
        totalCollateralUsd,
        lowestHealthFactor: aggregateHealthFactor,
      },
      wallet: {
        connected: isConnected,
        address: address?.slice(0, 10) + '...',
        chainId: walletChainId,
      },
    }, null, 2);
    navigator.clipboard.writeText(report);
    setCopiedDebug(true);
    toast({
      title: 'Debug Report Copied',
      description: 'Debug information has been copied to clipboard.',
    });
    setTimeout(() => setCopiedDebug(false), 2000);
  }, [debugReport, positions, totalSupplyUsd, totalBorrowUsd, totalCollateralUsd, aggregateHealthFactor, isConnected, address, walletChainId]);

  // Handle supply action
  const handleSupply = useCallback((market: MorphoMarket) => {
    if (!isConnected) {
      toast({ title: 'Connect Wallet', description: 'Please connect your wallet to supply assets.', variant: 'destructive' });
      return;
    }
    if (isWrongNetwork) {
      const chainNames = getEnabledMorphoChains().map(c => c.label).join(', ');
      toast({ title: 'Wrong Network', description: `Earn is available on ${chainNames}. Switch network to continue.`, variant: 'destructive' });
      return;
    }
    setSelectedMarket(market);
    setSelectedPosition(null);
    setIsSupplyModalOpen(true);
  }, [isConnected, isWrongNetwork]);

  // Handle borrow action
  const handleBorrow = useCallback((market: MorphoMarket) => {
    if (!isConnected) {
      toast({ title: 'Connect Wallet', description: 'Please connect your wallet to borrow assets.', variant: 'destructive' });
      return;
    }
    if (isWrongNetwork) {
      const chainNames = getEnabledMorphoChains().map(c => c.label).join(', ');
      toast({ title: 'Wrong Network', description: `Borrow is available on ${chainNames}. Switch network to continue.`, variant: 'destructive' });
      return;
    }
    setSelectedMarket(market);
    setSelectedPosition(null);
    setIsBorrowModalOpen(true);
  }, [isConnected, isWrongNetwork]);

  // Handle market details
  const handleMarketDetails = useCallback((market: MorphoMarket) => {
    setSelectedMarket(market);
    setIsDetailsDrawerOpen(true);
  }, []);

  // Handle manage position (from positions tab)
  const handleManagePosition = useCallback((position: MorphoPositionWithHealth, action?: ActionType) => {
    setSelectedPosition(position);
    if (position.market) {
      setSelectedMarket(position.market);
    }
    // Use provided action or default based on position
    if (action === 'supply' || action === 'withdraw') {
      setIsSupplyModalOpen(true);
    } else if (action === 'borrow' || action === 'repay') {
      setIsBorrowModalOpen(true);
    } else if (position.borrowAssetsUsd > 0) {
      setIsBorrowModalOpen(true);
    } else {
      setIsSupplyModalOpen(true);
    }
  }, []);

  // Close modals and refresh
  const handleCloseModal = useCallback(() => {
    setIsSupplyModalOpen(false);
    setIsBorrowModalOpen(false);
    setIsDetailsDrawerOpen(false);
    setSelectedMarket(null);
    setSelectedPosition(null);
    // Refresh data after action
    refreshMarkets();
    refreshPositions();
  }, [refreshMarkets, refreshPositions]);

  // Format USD values
  const formatUsd = (value: number) => {
    if (!Number.isFinite(value) || value === 0) return '$0.00';
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  // Net APY calculation (simplified)
  const netApy = positions.length > 0 && totalSupplyUsd > 0
    ? positions.reduce((acc, pos) => {
        if (pos.market) {
          const supplyContribution = (pos.supplyAssetsUsd / totalSupplyUsd) * pos.market.supplyApy;
          const borrowCost = totalBorrowUsd > 0 
            ? (pos.borrowAssetsUsd / totalBorrowUsd) * pos.market.borrowApy 
            : 0;
          return acc + supplyContribution - borrowCost;
        }
        return acc;
      }, 0)
    : null;

  return (
    <Layout>
      <SeoHead />
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <SeoContentBlock>
          <h1>Earn Yield with DeFi Lending &amp; Staking</h1>
          <p>
            Crypto DeFi Bridge gives you access to <strong>DeFi staking</strong> and lending markets powered by Morpho Blue on Ethereum.
            Supply your crypto assets to earn competitive APY, or borrow against your collateral at transparent rates — all non-custodial.
          </p>
          <h2>How DeFi Lending Works</h2>
          <p>
            When you supply tokens to a lending market, borrowers pay interest to use your liquidity. Your deposited assets
            remain in audited smart contracts — Crypto DeFi Bridge never takes custody. Rates are determined by supply and demand,
            giving you market-driven yield on idle assets.
          </p>
          <h2>Crypto Vaults &amp; Liquid Staking</h2>
          <p>
            <strong>Crypto vaults</strong> automate yield strategies so you can earn without active management.
            <strong> Liquid staking</strong> lets you stake ETH while keeping a tradeable receipt token.
            Both approaches are accessible through the markets listed below.
          </p>
          <h2>Borrow Against Your Holdings</h2>
          <p>
            Need liquidity without selling? Deposit collateral and borrow stablecoins or other assets.
            Monitor your health factor to avoid liquidation, and repay at any time.
          </p>
          <p>
            New to DeFi? Start by <Link to="/">swapping tokens</Link> or read our{' '}
            <Link to="/docs">documentation</Link> to understand the risks.
          </p>
          <h2>Risk Disclaimer</h2>
          <p>
            Lending and borrowing involve smart-contract risk and liquidation risk. Collateral values can fluctuate,
            and positions may be liquidated if health factors drop below safe thresholds. Always DYOR.
          </p>
        </SeoContentBlock>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
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
                  Morpho Blue
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Supply & borrow with permissionless lending markets
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Chain badge (single chain) or selector */}
              {enabledChains.length === 1 ? (
                <Badge variant="outline" className="h-10 px-3 gap-2 text-sm font-medium">
                  <ChainIcon chainId={enabledChains[0].chainId} size="sm" />
                  {enabledChains[0].label}
                </Badge>
              ) : (
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
                    {enabledChains.map(chain => (
                      <SelectItem 
                        key={chain.chainId} 
                        value={chain.chainId.toString()}
                      >
                        <div className="flex items-center gap-2">
                          <ChainIcon chainId={chain.chainId} size="sm" />
                          <span>{chain.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  refreshMarkets();
                  refreshPositions();
                }}
                disabled={marketsLoading || positionsLoading}
                className="h-10 w-10"
              >
                <RefreshCw className={cn("w-4 h-4", (marketsLoading || positionsLoading) && "animate-spin")} />
              </Button>

              {/* Debug report button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyDebugReport}
                className="h-10 gap-2 text-muted-foreground"
              >
                {copiedDebug ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Bug className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Copy Debug</span>
              </Button>
            </div>
          </div>

          {/* Supported chains badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {getEnabledMorphoChains().map(chain => (
              <Badge key={chain.chainId} variant="outline" className="h-7 px-3 gap-1.5 text-sm font-medium border-primary/30 bg-primary/10 text-primary">
                <ChainIcon chainId={chain.chainId} size="sm" />
                {chain.label}
              </Badge>
            ))}
          </div>

          {/* Wrong network warning */}
          {isWrongNetwork && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-warning/10 border border-warning/30">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-warning">Wrong Network</p>
                <p className="text-xs text-muted-foreground">
                  Earn is available on {getEnabledMorphoChains().map(c => c.label).join(', ')}. Switch network to continue.
                </p>
              </div>
              <ConnectButton.Custom>
                {({ openChainModal, mounted }) => (
                  <Button
                    size="sm"
                    onClick={() => { if (mounted && openChainModal) openChainModal(); }}
                    className="gap-1.5"
                  >
                    Switch Network
                  </Button>
                )}
              </ConnectButton.Custom>
            </div>
          )}

          {/* Disclaimer Banner */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-foreground">
                <strong>Non-custodial lending.</strong> All actions execute directly on Morpho Blue smart contracts.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                APY is variable and based on market utilization. Smart contract risk applies.
              </p>
            </div>
            <Link
              to="/docs"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Learn more
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {/* How It Works */}
          <HowItWorksDiagram />

          {/* User Dashboard (if connected and has positions) */}
          {isConnected && positions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-primary" />
                  Your Dashboard
                </h2>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {positions.length} position{positions.length !== 1 ? 's' : ''}
                  </Badge>
                  {netApy !== null && (
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      netApy >= 0 ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30"
                    )}>
                      Net: {netApy >= 0 ? '+' : ''}{netApy.toFixed(2)}% APY
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  <div className="text-xs text-muted-foreground mb-1">Health Factor</div>
                  <div className={cn(
                    "text-lg font-semibold",
                    aggregateHealthFactor === null ? "text-success" :
                    aggregateHealthFactor > 1.5 ? "text-success" :
                    aggregateHealthFactor > 1 ? "text-warning" :
                    "text-destructive"
                  )}>
                    {aggregateHealthFactor === null ? '∞' : aggregateHealthFactor.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Risk bar for aggregate position */}
              {totalBorrowUsd > 0 && (
                <div className="mt-4 pt-4 border-t border-border/30">
                  <RiskBar 
                    healthFactor={aggregateHealthFactor} 
                    showLabel 
                    size="md"
                  />
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
                {markets.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {markets.length}
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
                {(positions.length + vaultPositions.length) > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {positions.length + vaultPositions.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Markets Tab */}
            <TabsContent value="markets" className="space-y-4">
              {/* Stats row */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Markets:</span>
                    <span className="font-medium">{markets.length}</span>
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

              {/* Markets Table */}
              <MorphoMarketsTable
                markets={markets}
                loading={marketsLoading}
                error={marketsError}
                onRefresh={refreshMarkets}
                onSupply={handleSupply}
                onBorrow={handleBorrow}
                onMarketDetails={handleMarketDetails}
              />
            </TabsContent>

            {/* Vaults Tab */}
            <TabsContent value="vaults" className="space-y-4">
              <MorphoVaultsTable
                vaults={vaults}
                vaultPositions={vaultPositions}
                loading={vaultsLoading}
                error={vaultsError}
                onRefresh={refreshVaults}
              />
            </TabsContent>

            {/* Positions Tab */}
            <TabsContent value="positions" className="space-y-4">
              {!isConnected ? (
                <div className="glass rounded-xl p-8 text-center">
                  <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
                  <p className="text-muted-foreground mb-4">
                    Connect your wallet to view your Morpho positions across all chains
                  </p>
                </div>
              ) : positionsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={`pos-skeleton-${i}`} className="glass rounded-xl p-4 animate-pulse">
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
              ) : positions.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center">
                  <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">No Positions Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start earning by supplying assets to Morpho markets
                  </p>
                  <Button onClick={() => setActiveTab('markets')}>
                    Browse Markets
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {positions.map((position) => (
                    <MorphoPositionCard
                      key={`${position.chainId}-${position.marketId}`}
                      position={position}
                      onManage={handleManagePosition}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border/30">
            <p>Powered by Morpho Blue protocol. Data via official Morpho API.</p>
            <p className="mt-1 flex items-center justify-center gap-3">
              <a 
                href="https://docs.morpho.org" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Documentation
              </a>
              <span>•</span>
              <a 
                href="https://app.morpho.org" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Official App
              </a>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Supply Modal */}
      <MorphoSupplyModal
        isOpen={isSupplyModalOpen}
        onClose={handleCloseModal}
        market={selectedMarket}
        existingSupply={selectedPosition?.supplyAssets}
        onSuccess={handleCloseModal}
      />

      {/* Borrow Modal (handles collateral supply inline) */}
      <MorphoBorrowModal
        isOpen={isBorrowModalOpen}
        onClose={handleCloseModal}
        market={selectedMarket}
        existingCollateral={selectedPosition?.collateral}
        existingCollateralUsd={selectedPosition?.collateralUsd}
        existingBorrow={selectedPosition?.borrowAssets}
        existingBorrowUsd={selectedPosition?.borrowAssetsUsd}
        onSuccess={() => {
          refreshMarkets();
          refreshPositions();
        }}
      />

      {/* Market Details Drawer */}
      <MarketDetailsDrawer
        isOpen={isDetailsDrawerOpen}
        onClose={() => setIsDetailsDrawerOpen(false)}
        market={selectedMarket}
        onSupply={() => {
          setIsDetailsDrawerOpen(false);
          handleSupply(selectedMarket!);
        }}
        onBorrow={() => {
          setIsDetailsDrawerOpen(false);
          handleBorrow(selectedMarket!);
        }}
      />
    </Layout>
  );
}
