/**
 * Borrow Page
 * 
 * Dedicated page for borrowing against collateral on Morpho markets.
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Coins, 
  AlertTriangle, 
  Info,
  TrendingUp,
  Shield,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMorphoMarkets } from '@/hooks/useMorphoMarkets';
import { MorphoMarketsTable } from '@/components/earn/MorphoMarketsTable';
import { MorphoActionModal } from '@/components/earn/MorphoActionModal';
import { HowItWorksDiagram } from '@/components/earn/HowItWorksDiagram';
import type { MorphoMarket } from '@/lib/morpho/types';
import { cn } from '@/lib/utils';
import { getEnabledMorphoChains } from '@/lib/morpho/config';

// Get available chains for the selector (only enabled)
const MORPHO_CHAINS = getEnabledMorphoChains().map(c => ({
  id: c.chainId,
  name: c.label,
  logo: c.logo,
  supported: true,
}));

export default function Borrow() {
  const { isConnected, address } = useAccount();
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  
  // Modal state
  const [selectedMarket, setSelectedMarket] = useState<MorphoMarket | null>(null);
  const [actionType, setActionType] = useState<'supply' | 'borrow' | 'withdraw' | 'repay'>('borrow');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { markets, loading, error, refresh, selectedChainId, setSelectedChainId } = useMorphoMarkets();

  // Filter to only markets that support borrowing (have collateral)
  const borrowableMarkets = useMemo(() => {
    return markets.filter(m => m.collateralAsset !== null);
  }, [markets]);

  const handleBorrow = (market: MorphoMarket) => {
    setSelectedMarket(market);
    setActionType('borrow');
    setIsModalOpen(true);
  };

  const handleSupplyCollateral = (market: MorphoMarket) => {
    setSelectedMarket(market);
    setActionType('supply');
    setIsModalOpen(true);
  };

  const selectedChain = MORPHO_CHAINS.find(c => c.id === selectedChainId);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Coins className="w-8 h-8 text-primary" />
                Borrow
              </h1>
              <p className="text-muted-foreground mt-1">
                Borrow against your collateral on Morpho markets
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHowItWorks(!showHowItWorks)}
                className="gap-2"
              >
                <Info className="w-4 h-4" />
                How it works
              </Button>
              
              {/* Chain indicator */}
              {MORPHO_CHAINS.length === 1 ? (
                <Badge variant="outline" className="h-8 px-3 gap-1.5 text-xs font-medium">
                  <img src={MORPHO_CHAINS[0].logo} alt={MORPHO_CHAINS[0].name} className="w-4 h-4 rounded-full" />
                  {MORPHO_CHAINS[0].name}
                </Badge>
              ) : (
                <div className="flex gap-1">
                  {MORPHO_CHAINS.map((chain) => (
                    <Button
                      key={chain.id}
                      variant={selectedChainId === chain.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedChainId(chain.id)}
                      className="gap-1.5 px-2"
                    >
                      <img src={chain.logo} alt={chain.name} className="w-4 h-4 rounded-full" />
                      <span className="hidden sm:inline text-xs">{chain.name}</span>
                    </Button>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>

          {/* How It Works */}
          {showHowItWorks && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8"
            >
              <HowItWorksDiagram />
            </motion.div>
          )}

          {/* Educational Cards */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Collateral Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  You must supply collateral before borrowing. Your max borrow depends on LTV ratio.
                </p>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-warning" />
                  Borrow Interest
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Borrowed assets accrue interest (APR). Rates are variable based on utilization.
                </p>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Liquidation Risk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  If your LTV exceeds LLTV, your collateral may be liquidated. Monitor health factor.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Not Connected Warning */}
          {!isConnected && (
            <div className="glass rounded-xl p-6 mb-8 border border-warning/30 bg-warning/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-warning">Wallet Not Connected</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Connect your wallet to borrow. You'll need to supply collateral first.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Borrow Markets */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Borrowable Markets</h2>
              <Badge variant="outline" className="text-xs">
                {borrowableMarkets.length} markets
              </Badge>
            </div>

            <MorphoMarketsTable
              markets={borrowableMarkets}
              loading={loading}
              error={error}
              onRefresh={refresh}
              onSupply={handleSupplyCollateral}
              onBorrow={handleBorrow}
            />
          </div>

          {/* Disclaimer */}
          <div className="text-center text-xs text-muted-foreground space-y-1">
            <p>Non-custodial. Smart contract risk. Rates variable.</p>
            <a 
              href="/docs" 
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Read documentation
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>

        {/* Action Modal */}
        <MorphoActionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          market={selectedMarket}
          actionType={actionType}
        />
      </div>
    </Layout>
  );
}
