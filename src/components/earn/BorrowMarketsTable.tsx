/**
 * Borrow Markets Table Component
 * Displays available borrow markets with APY and liquidity info
 */

import { useState, useMemo } from 'react';
import { ArrowUpDown, Loader2, AlertCircle, Wallet, Shield } from 'lucide-react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { BorrowMarket, UserAccountData } from '@/hooks/useAaveBorrow';

interface BorrowMarketsTableProps {
  markets: BorrowMarket[];
  isLoading: boolean;
  onBorrowClick: (market: BorrowMarket) => void;
  accountData?: UserAccountData | null;
  chainStatuses?: { chainId: number; status: 'ok' | 'error' | 'loading'; error?: { message: string } }[];
  className?: string;
}

type SortKey = 'asset' | 'variableAPY' | 'stableAPY' | 'liquidity';
type SortDirection = 'asc' | 'desc';

export function BorrowMarketsTable({
  markets,
  isLoading,
  onBorrowClick,
  accountData,
  chainStatuses = [],
  className,
}: BorrowMarketsTableProps) {
  const { isConnected } = useAccount();
  const [sortKey, setSortKey] = useState<SortKey>('liquidity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Sort markets
  const sortedMarkets = useMemo(() => {
    return [...markets].sort((a, b) => {
      let comparison = 0;
      
      switch (sortKey) {
        case 'asset':
          comparison = a.assetSymbol.localeCompare(b.assetSymbol);
          break;
        case 'variableAPY':
          comparison = a.variableBorrowAPY - b.variableBorrowAPY;
          break;
        case 'stableAPY':
          comparison = a.stableBorrowAPY - b.stableBorrowAPY;
          break;
        case 'liquidity':
          comparison = a.availableLiquidityUsd - b.availableLiquidityUsd;
          break;
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [markets, sortKey, sortDirection]);

  // Handle sort
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  // Format APY
  const formatAPY = (apy: number) => {
    if (apy < 0.01) return '<0.01%';
    if (apy > 100) return '>100%';
    return `${apy.toFixed(2)}%`;
  };

  // Format liquidity
  const formatLiquidity = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  // Check if user can borrow
  const hasCollateral = accountData && accountData.totalCollateralUsd > 0;

  // Get borrow button state and tooltip
  const getBorrowButtonState = (market: BorrowMarket) => {
    // Check if chain is unavailable
    const chainStatus = chainStatuses.find(s => s.chainId === market.chainId);
    if (chainStatus?.status === 'error') {
      return {
        disabled: true,
        tooltip: `Chain temporarily unavailable: ${chainStatus.error?.message || 'RPC error'}`,
        label: 'Unavailable',
      };
    }

    if (!isConnected) {
      return {
        disabled: true,
        tooltip: 'Connect wallet to borrow',
        label: 'Connect Wallet',
      };
    }

    if (!hasCollateral) {
      return {
        disabled: true,
        tooltip: 'Supply collateral and enable it to borrow',
        label: 'Supply First',
      };
    }

    if (!market.borrowingEnabled) {
      return {
        disabled: true,
        tooltip: 'Borrowing disabled for this asset',
        label: 'Disabled',
      };
    }

    if (market.availableLiquidity <= 0) {
      return {
        disabled: true,
        tooltip: 'No liquidity available',
        label: 'No Liquidity',
      };
    }

    return {
      disabled: false,
      tooltip: null,
      label: 'Borrow',
    };
  };

  // Sort header component
  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <button
      onClick={() => handleSort(sortKeyName)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className={cn(
        'w-3 h-3',
        sortKey === sortKeyName ? 'text-primary' : 'text-muted-foreground'
      )} />
    </button>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('glass rounded-xl p-8', className)}>
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
          <p className="text-muted-foreground">Loading borrow markets...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (markets.length === 0) {
    return (
      <div className={cn('glass rounded-xl p-8', className)}>
        <div className="flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="font-medium mb-1">No Borrow Markets Available</p>
          <p className="text-sm text-muted-foreground">
            No borrowable assets found on this chain. Try selecting a different chain.
          </p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn('glass rounded-xl overflow-hidden', className)}>
        {/* Info banners */}
        {!isConnected && (
          <div className="px-4 py-3 bg-muted/30 border-b border-border/50 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Connect your wallet to borrow assets</span>
          </div>
        )}
        
        {isConnected && !hasCollateral && (
          <div className="px-4 py-3 bg-warning/10 border-b border-warning/20 flex items-center gap-2">
            <Shield className="w-4 h-4 text-warning" />
            <span className="text-sm text-warning">Supply collateral in the "Lend" tab first to enable borrowing</span>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="w-[200px]">
                <SortHeader label="Asset" sortKeyName="asset" />
              </TableHead>
              <TableHead>
                <SortHeader label="Variable APY" sortKeyName="variableAPY" />
              </TableHead>
              <TableHead>
                <SortHeader label="Stable APY" sortKeyName="stableAPY" />
              </TableHead>
              <TableHead>
                <SortHeader label="Available Liquidity" sortKeyName="liquidity" />
              </TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMarkets.map((market) => {
              const buttonState = getBorrowButtonState(market);
              
              return (
                <TableRow 
                  key={market.id}
                  className={cn(
                    'hover:bg-muted/30 border-border/30',
                    buttonState.disabled && 'opacity-60'
                  )}
                >
                  {/* Asset */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={market.assetLogo}
                          alt={market.assetSymbol}
                          className="w-8 h-8 rounded-full bg-muted"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
                          }}
                        />
                        <img
                          src={market.chainLogo}
                          alt={market.chainName}
                          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border border-card bg-card"
                        />
                      </div>
                      <div>
                        <div className="font-medium">{market.assetSymbol}</div>
                        <div className="text-xs text-muted-foreground">{market.chainName}</div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Variable APY */}
                  <TableCell>
                    <span className="text-warning font-medium">
                      {formatAPY(market.variableBorrowAPY)}
                    </span>
                  </TableCell>

                  {/* Stable APY */}
                  <TableCell>
                    {market.stableBorrowEnabled ? (
                      <span className="text-warning font-medium">
                        {formatAPY(market.stableBorrowAPY)}
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        N/A
                      </Badge>
                    )}
                  </TableCell>

                  {/* Available Liquidity */}
                  <TableCell>
                    <div>
                      <div className="font-medium">{formatLiquidity(market.availableLiquidityUsd)}</div>
                      <div className="text-xs text-muted-foreground">
                        {market.availableLiquidity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {market.assetSymbol}
                      </div>
                    </div>
                  </TableCell>

                  {/* Borrow Button */}
                  <TableCell className="text-right">
                    {buttonState.tooltip ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant={buttonState.disabled ? 'outline' : 'default'}
                            disabled={buttonState.disabled}
                            onClick={() => !buttonState.disabled && onBorrowClick(market)}
                            className="gap-1"
                          >
                            {buttonState.label}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{buttonState.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => onBorrowClick(market)}
                        className="gap-1"
                      >
                        {buttonState.label}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
