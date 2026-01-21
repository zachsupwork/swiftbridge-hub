/**
 * Earn Page - Aave-style lending interface
 * 
 * Features:
 * - Multi-chain market display
 * - Search and filter
 * - Supply drawer with mandatory fee
 * - Mobile-first responsive design
 */

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, RefreshCw, AlertTriangle, TrendingUp, Lock } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useReadContracts } from 'wagmi';
import { erc20Abi } from 'viem';

import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EarnChainSelector } from '@/components/earn/EarnChainSelector';
import { EarnMarketsTable } from '@/components/earn/EarnMarketsTable';
import { EarnSupplyDrawer } from '@/components/earn/EarnSupplyDrawer';
import { useLendingMarkets, type LendingMarket } from '@/hooks/useLendingMarkets';
import { useEarnAnalytics } from '@/hooks/useEarnAnalytics';

export default function Earn() {
  const { address, isConnected } = useAccount();
  const { trackEarnView, trackFilterChange } = useEarnAnalytics();

  // State
  const [selectedChainId, setSelectedChainId] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'apy' | 'tvl' | 'name'>('tvl');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedMarket, setSelectedMarket] = useState<LendingMarket | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Fetch markets
  const { markets, loading, error, refresh, chains } = useLendingMarkets(
    selectedChainId === 'all' ? undefined : selectedChainId
  );

  // Track page view
  useEffect(() => {
    trackEarnView();
  }, [trackEarnView]);

  // Filter and sort markets
  const filteredMarkets = useMemo(() => {
    let result = [...markets];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        m => 
          m.assetSymbol.toLowerCase().includes(query) ||
          m.assetName.toLowerCase().includes(query) ||
          m.chainName.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'apy':
          comparison = a.supplyAPY - b.supplyAPY;
          break;
        case 'tvl':
          comparison = (a.tvl || 0) - (b.tvl || 0);
          break;
        case 'name':
          comparison = a.assetSymbol.localeCompare(b.assetSymbol);
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [markets, searchQuery, sortBy, sortDirection]);

  // Batch fetch wallet balances for displayed markets
  const balanceContracts = useMemo(() => {
    if (!address || !isConnected) return [];
    return filteredMarkets.slice(0, 20).map(market => ({
      address: market.assetAddress,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [address] as const,
      chainId: market.chainId,
    }));
  }, [filteredMarkets, address, isConnected]);

  const { data: balancesData } = useReadContracts({
    contracts: balanceContracts,
    query: {
      enabled: balanceContracts.length > 0,
    },
  });

  // Convert balances to lookup map
  const walletBalances = useMemo(() => {
    const balances: Record<string, { balance: bigint; formatted: string }> = {};
    if (!balancesData) return balances;

    filteredMarkets.slice(0, 20).forEach((market, index) => {
      const result = balancesData[index];
      if (result?.status === 'success' && result.result !== undefined) {
        const balance = result.result as bigint;
        const formatted = (Number(balance) / Math.pow(10, market.decimals)).toString();
        balances[`${market.chainId}-${market.assetAddress}`] = { balance, formatted };
      }
    });

    return balances;
  }, [balancesData, filteredMarkets]);

  // Handlers
  const handleChainChange = (chainId: number | 'all') => {
    setSelectedChainId(chainId);
    trackFilterChange({ chain: chainId.toString() });
  };

  const handleSortChange = (column: 'apy' | 'tvl' | 'name') => {
    if (sortBy === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  const handleSupplyClick = (market: LendingMarket) => {
    setSelectedMarket(market);
    setIsDrawerOpen(true);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                <span className="text-gradient">Earn</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Supply assets and earn yield via Aave V3
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <EarnChainSelector
                chains={chains}
                selectedChainId={selectedChainId}
                onChainChange={handleChainChange}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={refresh}
                disabled={loading}
                className="h-10 w-10"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Disclaimer Banner */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <AlertTriangle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-foreground">
              Earn uses third-party protocols (Aave V3). You are responsible for risks. 
              This app is non-custodial and does not hold your funds.
            </p>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="lend" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-xs">
              <TabsTrigger value="lend" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Lend
              </TabsTrigger>
              <TabsTrigger value="borrow" disabled className="gap-2 opacity-50">
                <Lock className="w-4 h-4" />
                Borrow
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lend" className="mt-6 space-y-4">
              {/* Search */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by asset name or symbol..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-muted/30 border-border/50"
                />
              </div>

              {/* Results count */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {filteredMarkets.length} market{filteredMarkets.length !== 1 ? 's' : ''} found
                </p>
                {isConnected && (
                  <p className="text-xs text-muted-foreground">
                    Showing wallet balances
                  </p>
                )}
              </div>

              {/* Markets Table */}
              <EarnMarketsTable
                markets={filteredMarkets}
                loading={loading}
                error={error}
                onSupplyClick={handleSupplyClick}
                onRefresh={refresh}
                walletBalances={walletBalances}
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={handleSortChange}
              />
            </TabsContent>

            <TabsContent value="borrow">
              <div className="glass rounded-2xl p-12 text-center">
                <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-xl font-semibold mb-2">Borrowing Coming Soon</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Borrow functionality is under development. Stay tuned!
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      {/* Supply Drawer */}
      <EarnSupplyDrawer
        market={selectedMarket}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedMarket(null);
        }}
      />
    </Layout>
  );
}
