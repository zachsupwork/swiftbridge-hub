import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Loader2, RefreshCw, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { useAccount } from 'wagmi';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MarketCard } from '@/components/earn/MarketCard';
import { SupplyModal } from '@/components/earn/SupplyModal';
import { LendingFilters } from '@/components/earn/LendingFilters';
import { useLendingMarkets, type LendingMarket } from '@/hooks/useLendingMarkets';
import { useEarnAnalytics } from '@/hooks/useEarnAnalytics';
import { useMultiWallet } from '@/lib/wallets/MultiWalletContext';
import { cn } from '@/lib/utils';

export default function Earn() {
  const { isConnected } = useAccount();
  const { anyWalletConnected } = useMultiWallet();
  const { markets, loading, error, refresh, chains } = useLendingMarkets();
  const { trackEarnView, trackFilterChange, trackMarketOpen } = useEarnAnalytics();

  // Filters
  const [protocolFilter, setProtocolFilter] = useState<'all' | 'aave' | 'morpho'>('all');
  const [chainFilter, setChainFilter] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [selectedMarket, setSelectedMarket] = useState<LendingMarket | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Track page view
  useEffect(() => {
    trackEarnView();
  }, [trackEarnView]);

  // Filter markets
  const filteredMarkets = useMemo(() => {
    return markets.filter((market) => {
      // Protocol filter
      if (protocolFilter !== 'all' && market.protocol !== protocolFilter) {
        return false;
      }

      // Chain filter
      if (chainFilter !== 'all' && market.chainId !== chainFilter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          market.assetSymbol.toLowerCase().includes(query) ||
          market.assetName.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [markets, protocolFilter, chainFilter, searchQuery]);

  // Handle filter changes with analytics
  const handleProtocolChange = (protocol: 'all' | 'aave' | 'morpho') => {
    setProtocolFilter(protocol);
    trackFilterChange({ protocol });
  };

  const handleChainChange = (chain: number | 'all') => {
    setChainFilter(chain);
    trackFilterChange({ chain: chain === 'all' ? 'all' : chain.toString() });
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      trackFilterChange({ search: query });
    }
  };

  // Handle supply click
  const handleSupplyClick = (market: LendingMarket) => {
    trackMarketOpen(market.protocol, market.chainName, market.assetSymbol);
    setSelectedMarket(market);
    setIsModalOpen(true);
  };

  const handleConnectWallet = () => {
    setIsModalOpen(false);
    setShowWalletModal(true);
    // The MultiWalletButton in header handles wallet connection
    // We just need to indicate the user should connect
  };

  return (
    <Layout>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              <span className="text-gradient">Earn</span>
            </h1>
            <p className="text-muted-foreground">
              Earn yield on your crypto assets through lending protocols
            </p>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="lending" className="mb-6">
            <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex h-11">
              <TabsTrigger value="lending" className="gap-2 h-9">
                <TrendingUp className="w-4 h-4" />
                Lending
              </TabsTrigger>
              <TabsTrigger value="staking" disabled className="gap-2 h-9 opacity-50">
                <Clock className="w-4 h-4" />
                Staking
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lending" className="mt-6">
              {/* Filters */}
              <div className="mb-6">
                <LendingFilters
                  protocolFilter={protocolFilter}
                  onProtocolChange={handleProtocolChange}
                  chainFilter={chainFilter}
                  onChainChange={handleChainChange}
                  searchQuery={searchQuery}
                  onSearchChange={handleSearchChange}
                  chains={chains}
                />
              </div>

              {/* Refresh button */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">
                  {loading ? 'Loading markets...' : `${filteredMarkets.length} markets found`}
                </span>
                <Button
                  onClick={refresh}
                  disabled={loading}
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                >
                  <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                  Refresh
                </Button>
              </div>

              {/* Error state */}
              {error && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-warning/10 border border-warning/20">
                  <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{error}</span>
                </div>
              )}

              {/* Markets list */}
              {loading ? (
                <div className="glass rounded-2xl p-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-muted-foreground">Loading lending markets...</p>
                </div>
              ) : filteredMarkets.length === 0 ? (
                <div className="glass rounded-2xl p-12 text-center">
                  <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No markets match your filters</p>
                  <Button
                    onClick={() => {
                      setProtocolFilter('all');
                      setChainFilter('all');
                      setSearchQuery('');
                    }}
                    variant="outline"
                    size="sm"
                    className="mt-4"
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMarkets.map((market, index) => (
                    <MarketCard
                      key={market.id}
                      market={market}
                      onSupplyClick={handleSupplyClick}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="staking" className="mt-6">
              <div className="glass rounded-2xl p-12 text-center">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-xl font-semibold mb-2">Staking Coming Soon</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  We're working on integrating staking options. Stay tuned for updates!
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      {/* Supply Modal */}
      <SupplyModal
        market={selectedMarket}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isWalletConnected={isConnected || anyWalletConnected}
        onConnectWallet={handleConnectWallet}
      />

      {/* Wallet connect prompt */}
      {showWalletModal && !isConnected && !anyWalletConnected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setShowWalletModal(false)}
        >
          <div 
            className="glass rounded-2xl p-6 max-w-sm text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-foreground mb-4">
              Connect a wallet to continue. Use the wallet button in the header.
            </p>
            <Button onClick={() => setShowWalletModal(false)}>
              Got it
            </Button>
          </div>
        </motion.div>
      )}
    </Layout>
  );
}
