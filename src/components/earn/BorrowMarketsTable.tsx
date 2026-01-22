/**
 * Borrow Markets Table Component
 * Displays available borrow markets with APY and liquidity info
 */

import { useState, useMemo } from 'react';
import { ArrowUpDown, Loader2, AlertCircle } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import type { BorrowMarket } from '@/hooks/useAaveBorrow';

interface BorrowMarketsTableProps {
  markets: BorrowMarket[];
  isLoading: boolean;
  onBorrowClick: (market: BorrowMarket) => void;
  className?: string;
}

type SortKey = 'asset' | 'variableAPY' | 'stableAPY' | 'liquidity';
type SortDirection = 'asc' | 'desc';

export function BorrowMarketsTable({
  markets,
  isLoading,
  onBorrowClick,
  className,
}: BorrowMarketsTableProps) {
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
    <div className={cn('glass rounded-xl overflow-hidden', className)}>
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
          {sortedMarkets.map((market) => (
            <TableRow 
              key={market.id}
              className="hover:bg-muted/30 border-border/30"
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
                <Button
                  size="sm"
                  onClick={() => onBorrowClick(market)}
                  className="gap-1"
                >
                  Borrow
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
