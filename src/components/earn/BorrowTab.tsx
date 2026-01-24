/**
 * Borrow Tab Component
 * Main component for the Borrow tab in Earn page
 * 
 * ALWAYS CLICKABLE - Shows in-panel messages for unavailable states
 */

import { useState, useMemo } from 'react';
import { Search, RefreshCw, TrendingDown, Wallet, AlertTriangle, RefreshCcw, Shield, Info } from 'lucide-react';
import { useAccount, useChainId } from 'wagmi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAaveBorrow, type BorrowMarket } from '@/hooks/useAaveBorrow';
import { BorrowSummary } from './BorrowSummary';
import { BorrowMarketsTable } from './BorrowMarketsTable';
import { BorrowModal } from './BorrowModal';
import { YourBorrows } from './YourBorrows';

interface BorrowTabProps {
  className?: string;
}

export function BorrowTab({ className }: BorrowTabProps) {
  const { isConnected } = useAccount();
  const walletChainId = useChainId();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarket, setSelectedMarket] = useState<BorrowMarket | null>(null);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);

  // Borrow hook
  const {
    chainStatuses,
    borrowMarkets,
    userPositions,
    accountData,
    isLoading,
    isLoadingAccount,
    selectedChainId,
    setSelectedChainId,
    availableChains,
    refresh,
    retestChain,
    borrowStep,
    borrowError,
    borrow,
    repayStep,
    repayError,
    repay,
    resetBorrowState,
    resetRepayState,
  } = useAaveBorrow();

  // Filter markets by search
  const filteredMarkets = useMemo(() => {
    if (!searchQuery) return borrowMarkets;
    
    const query = searchQuery.toLowerCase();
    return borrowMarkets.filter(m => 
      m.assetSymbol.toLowerCase().includes(query) ||
      m.assetName.toLowerCase().includes(query) ||
      m.chainName.toLowerCase().includes(query)
    );
  }, [borrowMarkets, searchQuery]);

  // Check chain availability
  const isSelectedChainAvailable = useMemo(() => {
    if (!selectedChainId) return availableChains.length > 0;
    const status = chainStatuses.find(s => s.chainId === selectedChainId);
    return status?.status === 'ok';
  }, [chainStatuses, selectedChainId, availableChains]);

  // Get selected chain info
  const selectedChainInfo = useMemo(() => {
    if (!selectedChainId) return null;
    return chainStatuses.find(s => s.chainId === selectedChainId);
  }, [chainStatuses, selectedChainId]);

  // Get failed chains
  const failedChains = useMemo(() => {
    return chainStatuses.filter(s => s.status === 'error');
  }, [chainStatuses]);

  // Handle borrow click
  const handleBorrowClick = (market: BorrowMarket) => {
    setSelectedMarket(market);
    setIsBorrowModalOpen(true);
  };

  // Handle modal close
  const handleBorrowModalClose = () => {
    setIsBorrowModalOpen(false);
    setSelectedMarket(null);
    resetBorrowState();
  };

  // Handle chain change
  const handleChainChange = (value: string) => {
    if (value === 'all') {
      setSelectedChainId(undefined);
    } else {
      setSelectedChainId(parseInt(value, 10));
    }
  };

  // Check if user has collateral
  const hasCollateral = accountData && accountData.totalCollateralUsd > 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Failed chains warning */}
      {failedChains.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-warning font-medium">
              Some chains temporarily unavailable: {failedChains.map(c => c.chainName).join(', ')}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {failedChains.map(chain => (
                <Button
                  key={chain.chainId}
                  size="sm"
                  variant="outline"
                  onClick={() => retestChain(chain.chainId)}
                  className="h-7 text-xs gap-1"
                >
                  <RefreshCcw className="w-3 h-3" />
                  Retry {chain.chainName}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chain Selector + Refresh */}
      <div className="flex items-center gap-3">
        <Select
          value={selectedChainId?.toString() || 'all'}
          onValueChange={handleChainChange}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select chain" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Chains</SelectItem>
            {chainStatuses.map(chain => {
              const isAvailable = chain.status === 'ok';
              return (
                <SelectItem 
                  key={chain.chainId} 
                  value={chain.chainId.toString()}
                  disabled={!isAvailable}
                >
                  <div className="flex items-center gap-2">
                    {!isAvailable && <AlertTriangle className="w-3 h-3 text-warning" />}
                    {chain.chainName}
                    {!isAvailable && (
                      <Badge variant="outline" className="text-[10px] h-4 ml-1 text-warning border-warning/30">
                        Unavailable
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={refresh}
          disabled={isLoading}
          className="h-10 w-10"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </Button>
      </div>

      {/* Selected chain unavailable message */}
      {selectedChainId && !isSelectedChainAvailable && selectedChainInfo && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-destructive">
              {selectedChainInfo.chainName} is temporarily unavailable
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedChainInfo.error?.message || 'Unable to connect to this chain. Try again or select a different chain.'}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => retestChain(selectedChainId)}
              className="mt-3 gap-1"
            >
              <RefreshCcw className="w-3 h-3" />
              Retry Connection
            </Button>
          </div>
        </div>
      )}

      {/* Wallet not connected message */}
      {!isConnected && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border/50">
          <Wallet className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Connect wallet to view borrow position</p>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your wallet to see your borrowing power, health factor, and available markets.
            </p>
          </div>
        </div>
      )}

      {/* Connected but no collateral message */}
      {isConnected && !hasCollateral && !isLoadingAccount && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
          <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-primary">Supply collateral first to unlock borrowing</p>
            <p className="text-sm text-muted-foreground mt-1">
              Go to the "Lend" tab and supply assets as collateral. Once you have collateral, you can borrow against it.
            </p>
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <Info className="w-3 h-3" />
              <span>Your borrowing power depends on the assets you supply and their LTV ratio.</span>
            </div>
          </div>
        </div>
      )}

      {/* Summary - only show when connected */}
      {isConnected && isSelectedChainAvailable && (
        <BorrowSummary
          accountData={accountData}
          isLoading={isLoadingAccount}
          isConnected={isConnected}
          chainName={selectedChainInfo?.chainName}
          isChainAvailable={isSelectedChainAvailable}
        />
      )}

      {/* Your Borrows */}
      {isConnected && userPositions.length > 0 && (
        <YourBorrows
          positions={userPositions}
          isLoading={isLoadingAccount}
          repayStep={repayStep === 'borrowing' ? 'idle' : repayStep as 'idle' | 'approving' | 'repaying' | 'complete' | 'error'}
          repayError={repayError}
          onRepay={repay}
          onResetRepay={resetRepayState}
        />
      )}

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

      {/* Markets count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <TrendingDown className="w-4 h-4" />
          {filteredMarkets.length} borrow market{filteredMarkets.length !== 1 ? 's' : ''} available
        </p>
        {availableChains.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {availableChains.length} chain{availableChains.length !== 1 ? 's' : ''} active
          </Badge>
        )}
      </div>

      {/* Markets Table - always show if we have data */}
      {(isSelectedChainAvailable || borrowMarkets.length > 0) && (
        <BorrowMarketsTable
          markets={filteredMarkets}
          isLoading={isLoading}
          onBorrowClick={handleBorrowClick}
          accountData={accountData}
          chainStatuses={chainStatuses}
        />
      )}

      {/* No available chains */}
      {availableChains.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center p-8 rounded-lg bg-muted/30 border border-border/50">
          <AlertTriangle className="w-10 h-10 text-warning mb-3" />
          <p className="font-medium mb-1">No chains available</p>
          <p className="text-sm text-muted-foreground text-center mb-4">
            Unable to connect to any Aave V3 markets. This may be a temporary network issue.
          </p>
          <Button onClick={refresh} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry All Chains
          </Button>
        </div>
      )}

      {/* Borrow Modal */}
      <BorrowModal
        market={selectedMarket}
        accountData={accountData}
        isOpen={isBorrowModalOpen}
        onClose={handleBorrowModalClose}
        borrowStep={borrowStep}
        borrowError={borrowError}
        onBorrow={borrow}
        onReset={resetBorrowState}
      />
    </div>
  );
}
