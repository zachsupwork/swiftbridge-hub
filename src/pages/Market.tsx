/**
 * Unified Market Page
 * 
 * Single page that handles:
 * - Market overview (header, stats, education)
 * - Earn (Supply loan asset) tab
 * - Borrow (with guided collateral flow) tab
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  TrendingUp,
  Wallet,
  Shield,
  AlertTriangle,
  Info,
  ExternalLink,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { useAccount } from 'wagmi';

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TokenIconStable } from '@/components/common/TokenIconStable';
import { RiskBar } from '@/components/common/RiskBar';
import { MorphoSupplyModal } from '@/components/earn/MorphoSupplyModal';
import { MorphoBorrowModal } from '@/components/earn/MorphoBorrowModal';
import { useMorphoMarkets } from '@/hooks/useMorphoMarkets';
import { useMorphoPositions } from '@/hooks/useMorphoPositions';
import { isMarketTrusted } from '@/hooks/useMorphoMarkets';
import type { MorphoMarket } from '@/lib/morpho/types';
import { cn } from '@/lib/utils';

function normalizeAPY(apy: number): number {
  if (!Number.isFinite(apy) || apy === 0) return 0;
  if (apy > 0 && apy <= 1.5) return apy * 100;
  return apy;
}

function formatAPY(apy: number): string {
  const n = normalizeAPY(apy);
  if (!Number.isFinite(n) || n === 0) return '—';
  if (n < 0.01) return '<0.01%';
  return `${n.toFixed(2)}%`;
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0.00';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export default function Market() {
  const { marketId } = useParams<{ marketId: string }>();
  const navigate = useNavigate();
  const { isConnected } = useAccount();

  const [activeTab, setActiveTab] = useState('earn');
  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [supplyCollateralMode, setSupplyCollateralMode] = useState(false);

  const { markets, loading: marketsLoading } = useMorphoMarkets();
  const { positions, refresh: refreshPositions } = useMorphoPositions();

  // Find market by id or uniqueKey
  const market = useMemo(() => {
    if (!marketId) return null;
    return markets.find(m => m.id === marketId || m.uniqueKey === marketId) || null;
  }, [markets, marketId]);

  // Find user's position in this market
  const position = useMemo(() => {
    if (!market) return null;
    return positions.find(p => p.marketId === market.id) || null;
  }, [positions, market]);

  const hasCollateral = position ? position.collateralUsd > 0 : false;
  const hasBorrow = position ? position.borrowAssetsUsd > 0 : false;
  const hasSupply = position ? position.supplyAssetsUsd > 0 : false;

  const handleCloseModal = useCallback(() => {
    setIsSupplyModalOpen(false);
    setIsBorrowModalOpen(false);
    setSupplyCollateralMode(false);
    refreshPositions();
  }, [refreshPositions]);

  const handleSupplyCollateral = useCallback(() => {
    setIsBorrowModalOpen(false);
    setSupplyCollateralMode(true);
    setIsSupplyModalOpen(true);
  }, []);

  // Loading / not found
  if (marketsLoading && !market) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-32 bg-muted rounded-xl" />
            <div className="h-64 bg-muted rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!market) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-4xl text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Market Not Found</h2>
          <p className="text-muted-foreground mb-6">This market doesn't exist or hasn't loaded yet.</p>
          <Button onClick={() => navigate('/earn')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Markets
          </Button>
        </div>
      </Layout>
    );
  }

  const trusted = isMarketTrusted(market);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Back button */}
          <Button variant="ghost" size="sm" onClick={() => navigate('/earn')} className="gap-2 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            All Markets
          </Button>

          {/* === MARKET HEADER === */}
          <div className="glass rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-4 flex-1">
                <TokenIconStable symbol={market.loanAsset.symbol} size="lg" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold">
                      {market.loanAsset.symbol}
                      {market.collateralAsset && (
                        <span className="text-muted-foreground font-normal"> / {market.collateralAsset.symbol}</span>
                      )}
                    </h1>
                    {trusted ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs gap-1">
                        <Shield className="w-3 h-3" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Unverified
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ethereum • LLTV: {market.lltv.toFixed(0)}% • Morpho Blue
                  </p>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-border/30">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Supply APY</div>
                <div className="text-lg font-semibold text-success">{formatAPY(market.supplyApy)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Borrow APR</div>
                <div className="text-lg font-semibold text-warning">{formatAPY(market.borrowApy)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Total Supply (TVL)</div>
                <div className="text-lg font-semibold">{formatUsd(market.totalSupplyUsd)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Utilization</div>
                <div className="text-lg font-semibold">{market.utilization.toFixed(1)}%</div>
              </div>
            </div>

            {/* User position summary if exists */}
            {position && (hasSupply || hasCollateral || hasBorrow) && (
              <div className="mt-4 pt-4 border-t border-border/30">
                <div className="text-xs text-muted-foreground mb-2 font-medium">Your Position</div>
                <div className="flex flex-wrap gap-3">
                  {hasSupply && (
                    <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Supplied {formatUsd(position.supplyAssetsUsd)}
                    </Badge>
                  )}
                  {hasCollateral && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                      <Shield className="w-3 h-3 mr-1" />
                      Collateral {formatUsd(position.collateralUsd)}
                    </Badge>
                  )}
                  {hasBorrow && (
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                      <Wallet className="w-3 h-3 mr-1" />
                      Borrowed {formatUsd(position.borrowAssetsUsd)}
                    </Badge>
                  )}
                </div>
                {hasBorrow && (
                  <div className="mt-3">
                    <RiskBar healthFactor={position.healthFactor} showLabel size="sm" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* === EDUCATION / RISK SECTION === */}
          <div className="glass rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              How This Market Works
            </h2>
            <div className="grid sm:grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
                  <p><strong className="text-foreground">Supply to Earn:</strong> Deposit <strong>{market.loanAsset.symbol}</strong> (the loan asset) to earn variable interest from borrowers.</p>
                </div>
                <div className="flex items-start gap-2">
                  <Wallet className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
                  <p><strong className="text-foreground">Borrow:</strong> Deposit <strong>{market.collateralAsset?.symbol || 'collateral'}</strong> as collateral, then borrow <strong>{market.loanAsset.symbol}</strong> up to the LTV limit.</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
                  <p><strong className="text-foreground">Liquidation Risk:</strong> If your LTV exceeds {market.lltv.toFixed(0)}% (LLTV), your collateral will be liquidated. Monitor your health factor.</p>
                </div>
                <div className="flex items-start gap-2">
                  <Zap className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                  <p><strong className="text-foreground">Variable Rates:</strong> Both supply APY and borrow APR change based on market utilization. Smart contract risk applies.</p>
                </div>
              </div>
            </div>
          </div>

          {/* === ACTION TABS === */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-sm grid-cols-2">
              <TabsTrigger value="earn" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Earn (Supply)
              </TabsTrigger>
              <TabsTrigger value="borrow" className="gap-2">
                <Wallet className="w-4 h-4" />
                Borrow
              </TabsTrigger>
            </TabsList>

            {/* === EARN TAB === */}
            <TabsContent value="earn" className="mt-4">
              <div className="glass rounded-xl p-6 space-y-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-success" />
                    Supply {market.loanAsset.symbol} to Earn
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Deposit <strong>{market.loanAsset.symbol}</strong> into this market to earn {formatAPY(market.supplyApy)} variable APY from borrowers.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
                  <Info className="w-3.5 h-3.5 text-primary inline mr-1.5" />
                  Supplying {market.loanAsset.symbol} does <strong>not</strong> give you borrow power. To borrow, you must supply collateral separately in the Borrow tab.
                </div>

                {!isConnected ? (
                  <div className="p-4 rounded-lg bg-warning/5 border border-warning/20 text-center">
                    <Wallet className="w-8 h-8 text-warning mx-auto mb-2" />
                    <p className="text-sm font-medium">Connect your wallet to supply</p>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      setSupplyCollateralMode(false);
                      setIsSupplyModalOpen(true);
                    }}
                    className="w-full gap-2"
                    size="lg"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Supply {market.loanAsset.symbol}
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* === BORROW TAB === */}
            <TabsContent value="borrow" className="mt-4">
              <div className="glass rounded-xl p-6 space-y-4">
                {!market.collateralAsset ? (
                  <div className="text-center py-6">
                    <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium">This market does not support borrowing</p>
                    <p className="text-sm text-muted-foreground mt-1">No collateral asset is configured for this market.</p>
                  </div>
                ) : !isConnected ? (
                  <div className="p-4 rounded-lg bg-warning/5 border border-warning/20 text-center">
                    <Wallet className="w-8 h-8 text-warning mx-auto mb-2" />
                    <p className="text-sm font-medium">Connect your wallet to borrow</p>
                  </div>
                ) : !hasCollateral ? (
                  /* Step 1 — Collateral Required */
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-warning/5 border border-warning/20">
                      <Shield className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-warning">Collateral Required</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          To borrow <strong>{market.loanAsset.symbol}</strong>, you must first supply <strong>{market.collateralAsset.symbol}</strong> as collateral.
                        </p>
                      </div>
                    </div>

                    {/* Visual flow */}
                    <div className="flex items-center justify-center gap-3 py-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                        <TokenIconStable symbol={market.collateralAsset.symbol} size="sm" />
                        <span className="font-medium text-foreground">Supply {market.collateralAsset.symbol}</span>
                      </div>
                      <span className="text-lg">→</span>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20">
                        <TokenIconStable symbol={market.loanAsset.symbol} size="sm" />
                        <span className="font-medium text-foreground">Borrow {market.loanAsset.symbol}</span>
                      </div>
                    </div>

                    {/* Collateral education */}
                    <div className="space-y-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/30">
                      <p>• Your max borrow = collateral value × LTV ratio ({market.lltv.toFixed(0)}%)</p>
                      <p>• If your LTV exceeds LLTV, your collateral is liquidated</p>
                      <p>• Keep a safety buffer — aim for LTV well below {market.lltv.toFixed(0)}%</p>
                    </div>

                    <Button
                      onClick={handleSupplyCollateral}
                      className="w-full gap-2"
                      size="lg"
                    >
                      <Shield className="w-4 h-4" />
                      Supply {market.collateralAsset.symbol} (Collateral)
                    </Button>
                  </div>
                ) : (
                  /* Step 2 — Borrow Enabled */
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2 mb-1">
                        <Wallet className="w-4 h-4 text-warning" />
                        Borrow {market.loanAsset.symbol}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        You have {formatUsd(position!.collateralUsd)} collateral. Borrow up to the LTV limit.
                      </p>
                    </div>

                    {/* Position stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground">Collateral</div>
                        <div className="font-semibold text-primary">{formatUsd(position!.collateralUsd)}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground">Current Debt</div>
                        <div className="font-semibold text-warning">{formatUsd(position!.borrowAssetsUsd)}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground">Borrow APR</div>
                        <div className="font-semibold">{formatAPY(market.borrowApy)}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground">Health Factor</div>
                        <div className={cn(
                          "font-semibold",
                          position!.healthFactor === null ? "text-success" :
                          position!.healthFactor > 1.5 ? "text-success" :
                          position!.healthFactor > 1 ? "text-warning" :
                          "text-destructive"
                        )}>
                          {position!.healthFactor === null ? '∞' : position!.healthFactor.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {hasBorrow && (
                      <RiskBar healthFactor={position!.healthFactor} showLabel size="md" />
                    )}

                    <Button
                      onClick={() => setIsBorrowModalOpen(true)}
                      className="w-full gap-2"
                      size="lg"
                    >
                      <Wallet className="w-4 h-4" />
                      Borrow {market.loanAsset.symbol}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleSupplyCollateral}
                      className="w-full gap-2"
                      size="sm"
                    >
                      <Shield className="w-3 h-3" />
                      Add More Collateral
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Disclaimer */}
          <div className="text-center text-xs text-muted-foreground pt-2">
            <p>Non-custodial. Smart contract risk. Rates are variable.</p>
            <a
              href="https://docs.morpho.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
            >
              Morpho Documentation
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>
      </div>

      {/* Supply Modal */}
      <MorphoSupplyModal
        isOpen={isSupplyModalOpen}
        onClose={handleCloseModal}
        market={market}
        existingSupply={position?.supplyAssets}
        onSuccess={handleCloseModal}
      />

      {/* Borrow Modal */}
      <MorphoBorrowModal
        isOpen={isBorrowModalOpen}
        onClose={handleCloseModal}
        market={market}
        existingCollateral={position?.collateral}
        existingCollateralUsd={position?.collateralUsd}
        existingBorrow={position?.borrowAssets}
        existingBorrowUsd={position?.borrowAssetsUsd}
        onSupplyCollateral={handleSupplyCollateral}
        onSuccess={handleCloseModal}
      />
    </Layout>
  );
}
