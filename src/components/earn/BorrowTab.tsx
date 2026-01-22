/**
 * Borrow Tab Component
 * Main component for the Borrow tab in Earn page
 */

import { useState, useMemo } from 'react';
import { Search, RefreshCw, TrendingDown } from 'lucide-react';
import { useAccount, useChainId } from 'wagmi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAaveBorrow, type BorrowMarket } from '@/hooks/useAaveBorrow';
import { BorrowSummary } from './BorrowSummary';
import { BorrowMarketsTable } from './BorrowMarketsTable';
import { BorrowModal } from './BorrowModal';
import { YourBorrows } from './YourBorrows';
import { BorrowDebugPanel } from './BorrowDebugPanel';

interface BorrowTabProps {
  className?: string;
}

export function BorrowTab({ className }: BorrowTabProps) {
  const { address, isConnected } = useAccount();
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

  // Check if selected chain is available
  const isSelectedChainAvailable = useMemo(() => {
    if (!selectedChainId) return true;
    const status = chainStatuses.find(s => s.chainId === selectedChainId);
    return status?.status === 'ok';
  }, [chainStatuses, selectedChainId]);

  // Get selected chain name
  const selectedChainName = useMemo(() => {
    if (!selectedChainId) return undefined;
    return chainStatuses.find(s => s.chainId === selectedChainId)?.chainName;
  }, [chainStatuses, selectedChainId]);

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

  return (
    <div className={cn('space-y-6', className)}>
      {/* Debug Panel */}
      <BorrowDebugPanel
        chainStatuses={chainStatuses}
        onRetestChain={retestChain}
      />

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
            {availableChains.map(chain => (
              <SelectItem key={chain.chainId} value={chain.chainId.toString()}>
                <div className="flex items-center gap-2">
                  <img src={chain.logo} alt={chain.name} className="w-4 h-4 rounded-full" />
                  {chain.name}
                </div>
              </SelectItem>
            ))}
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

      {/* Summary */}
      <BorrowSummary
        accountData={accountData}
        isLoading={isLoadingAccount}
        isConnected={isConnected}
        chainName={selectedChainName}
        isChainAvailable={isSelectedChainAvailable}
      />

      {/* Your Borrows */}
      {isConnected && userPositions.length > 0 && (
      <YourBorrows
          positions={userPositions}
          isLoading={isLoadingAccount}
          repayStep={repayStep === 'borrowing' ? 'idle' : repayStep}
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
      </div>

      {/* Markets Table */}
      <BorrowMarketsTable
        markets={filteredMarkets}
        isLoading={isLoading}
        onBorrowClick={handleBorrowClick}
      />

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
