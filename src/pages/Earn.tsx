/**
 * Earn Page - Aave-style lending interface
 * 
 * Features:
 * - Multi-chain market display (mainnet only)
 * - Search and filter
 * - Supply drawer with mandatory fee
 * - Mobile-first responsive design
 * - LIVE Aave V3 data only - no demo/preview mode
 * - RPC debug panel (dev mode only)
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, RefreshCw, AlertTriangle, TrendingUp, Lock, Clock, Copy, Check, Rocket } from 'lucide-react';
import { useAccount, useChainId } from 'wagmi';
import { useReadContracts } from 'wagmi';
import { erc20Abi } from 'viem';

import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EarnChainSelector } from '@/components/earn/EarnChainSelector';
import { EarnMarketsTable } from '@/components/earn/EarnMarketsTable';
import { EarnSupplyDrawer } from '@/components/earn/EarnSupplyDrawer';
import { RpcDebugPanel } from '@/components/earn/RpcDebugPanel';
import { useLendingMarkets, type LendingMarket, isEarnChainSupported } from '@/hooks/useLendingMarkets';
import { useEarnAnalytics } from '@/hooks/useEarnAnalytics';

export default function Earn() {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const { trackEarnView, trackFilterChange } = useEarnAnalytics();

  // State
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'apy' | 'tvl' | 'name'>('tvl');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedMarket, setSelectedMarket] = useState<LendingMarket | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Fetch markets - ALWAYS live data
  const { 
    markets, 
    loading, 
    error, 
    errorMessage, 
    refresh, 
    chains, 
    lastFetched, 
    isRetrying,
    partialFailures,
  } = useLendingMarkets(selectedChainId);

  // Track page view
  useEffect(() => {
    trackEarnView();
  }, [trackEarnView]);

  // Format last fetched time
  const lastFetchedDisplay = useMemo(() => {
    if (!lastFetched) return null;
    const seconds = Math.floor((Date.now() - lastFetched) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  }, [lastFetched]);

  // Copy wallet address
  const handleCopyAddress = useCallback(() => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  }, [address]);

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

  const { data: balancesData, refetch: refetchBalances } = useReadContracts({
    contracts: balanceContracts,
    query: {
      enabled: balanceContracts.length > 0,
    },
  });

  // Refetch balances when wallet or chain changes
  useEffect(() => {
    if (isConnected && address) {
      refetchBalances();
    }
  }, [address, walletChainId, isConnected, refetchBalances]);

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
  const handleChainChange = (chainId: number | undefined) => {
    setSelectedChainId(chainId);
    trackFilterChange({ chain: chainId?.toString() || 'all' });
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

  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedMarket(null);
    // Refresh balances after supply
    refetchBalances();
    refresh();
  }, [refetchBalances, refresh]);

  // Check if user's wallet is on unsupported chain (including Sepolia)
  const walletOnUnsupportedChain = isConnected && !isEarnChainSupported(walletChainId);
  const isOnSepolia = walletChainId === 11155111;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* RPC Configuration Status Panel - Always visible */}
          <RpcDebugPanel className="mb-2" />

          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold">
                  <span className="text-gradient">Earn</span>
                </h1>
                {/* Live badge */}
                <Badge variant="outline" className="text-xs px-2 h-5 border-success/40 text-success bg-success/10">
                  <Rocket className="w-3 h-3 mr-1" />
                  Live
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Data sourced directly from Aave V3 smart contracts
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Connected wallet display */}
              {isConnected && address && (
                <button
                  onClick={handleCopyAddress}
                  className="hidden sm:flex items-center gap-2 px-3 h-10 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors text-sm"
                >
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
                  {copiedAddress ? (
                    <Check className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
              )}
              
              <EarnChainSelector
                chains={chains}
                selectedChainId={selectedChainId}
                onChainChange={handleChainChange}
                showAllChainsOption={true}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={refresh}
                disabled={loading || isRetrying}
                className="h-10 w-10"
              >
                <RefreshCw className={`w-4 h-4 ${loading || isRetrying ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Disclaimer Banner */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <AlertTriangle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-foreground">
                Funds are supplied directly to Aave V3. Crypto DeFi Bridge does not custody funds.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supplying assets involves smart contract risk. APY is variable and not guaranteed.
              </p>
            </div>
          </div>

          {/* Wallet on unsupported chain warning */}
          {walletOnUnsupportedChain && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-warning font-medium">
                  {isOnSepolia 
                    ? "Earn is not available on Sepolia testnet."
                    : "Earn is not available on your current network."
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Please switch to a supported chain: Ethereum, Arbitrum, Optimism, Polygon, Base, or Avalanche.
                </p>
              </div>
            </div>
          )}

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

              {/* Results count and last updated */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-muted-foreground">
                  {filteredMarkets.length} market{filteredMarkets.length !== 1 ? 's' : ''} found
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {isConnected && (
                    <span className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-success" />
                      Wallet connected
                    </span>
                  )}
                  {lastFetchedDisplay && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last updated: {lastFetchedDisplay}
                    </span>
                  )}
                </div>
              </div>

              {/* Markets Table */}
              <EarnMarketsTable
                markets={filteredMarkets}
                loading={loading}
                error={error}
                errorMessage={errorMessage}
                onSupplyClick={handleSupplyClick}
                onRefresh={refresh}
                walletBalances={walletBalances}
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={handleSortChange}
                isRetrying={isRetrying}
                onChainChange={handleChainChange}
                partialFailures={partialFailures}
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

          {/* Footer note */}
          <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border/30">
            Powered by Aave V3 (external protocol). Platform fee (if enabled) is separate and disclosed.
          </div>
        </motion.div>
      </div>

      {/* Supply Drawer */}
      <EarnSupplyDrawer
        market={selectedMarket}
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
      />
    </Layout>
  );
}
