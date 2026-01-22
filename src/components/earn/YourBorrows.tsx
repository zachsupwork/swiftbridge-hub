/**
 * Your Borrows Component
 * Displays user's active borrow positions with repay functionality
 */

import { useState } from 'react';
import { AlertCircle, Loader2, TrendingDown } from 'lucide-react';
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
import type { UserBorrowPosition } from '@/hooks/useAaveBorrow';
import { RepayModal } from './RepayModal';

type RepayStep = 'idle' | 'approving' | 'repaying' | 'complete' | 'error';

interface YourBorrowsProps {
  positions: UserBorrowPosition[];
  isLoading: boolean;
  repayStep: RepayStep;
  repayError: string | null;
  onRepay: (position: UserBorrowPosition, amount: string) => Promise<void>;
  onResetRepay: () => void;
  className?: string;
}

export function YourBorrows({
  positions,
  isLoading,
  repayStep,
  repayError,
  onRepay,
  onResetRepay,
  className,
}: YourBorrowsProps) {
  const [selectedPosition, setSelectedPosition] = useState<UserBorrowPosition | null>(null);
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);

  // Format APY
  const formatAPY = (apy: number) => {
    if (apy < 0.01) return '<0.01%';
    if (apy > 100) return '>100%';
    return `${apy.toFixed(2)}%`;
  };

  // Format amount
  const formatAmount = (value: string, symbol: string) => {
    const num = parseFloat(value);
    if (num === 0) return `0 ${symbol}`;
    if (num < 0.0001) return `<0.0001 ${symbol}`;
    return `${num.toFixed(4)} ${symbol}`;
  };

  const handleRepayClick = (position: UserBorrowPosition) => {
    setSelectedPosition(position);
    setIsRepayModalOpen(true);
  };

  const handleCloseRepayModal = () => {
    setIsRepayModalOpen(false);
    setSelectedPosition(null);
    onResetRepay();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('glass rounded-xl p-8', className)}>
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
          <p className="text-muted-foreground">Loading your positions...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (positions.length === 0) {
    return (
      <div className={cn('glass rounded-xl p-8', className)}>
        <div className="flex flex-col items-center justify-center text-center">
          <TrendingDown className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="font-medium mb-1">No Active Borrows</p>
          <p className="text-sm text-muted-foreground">
            You don't have any active borrow positions on this chain.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={cn('glass rounded-xl overflow-hidden', className)}>
        <div className="p-4 border-b border-border/50">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Your Borrows
          </h3>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead>Asset</TableHead>
              <TableHead>Debt</TableHead>
              <TableHead>Rate Mode</TableHead>
              <TableHead>APY</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position, index) => {
              const totalDebt = position.currentVariableDebt > position.currentStableDebt 
                ? position.variableDebtFormatted 
                : position.stableDebtFormatted;
              const apy = position.rateMode === 'variable' 
                ? position.variableBorrowAPY 
                : position.stableBorrowAPY;

              return (
                <TableRow 
                  key={`${position.assetAddress}-${index}`}
                  className="hover:bg-muted/30 border-border/30"
                >
                  {/* Asset */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img
                        src={position.assetLogo}
                        alt={position.assetSymbol}
                        className="w-8 h-8 rounded-full bg-muted"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
                        }}
                      />
                      <div>
                        <div className="font-medium">{position.assetSymbol}</div>
                        <div className="text-xs text-muted-foreground">{position.assetName}</div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Debt */}
                  <TableCell>
                    <span className="font-medium text-warning">
                      {formatAmount(totalDebt, position.assetSymbol)}
                    </span>
                  </TableCell>

                  {/* Rate Mode */}
                  <TableCell>
                    <Badge variant={position.rateMode === 'variable' ? 'secondary' : 'outline'}>
                      {position.rateMode === 'variable' ? 'Variable' : 'Stable'}
                    </Badge>
                  </TableCell>

                  {/* APY */}
                  <TableCell>
                    <span className="text-warning font-medium">
                      {formatAPY(apy)}
                    </span>
                  </TableCell>

                  {/* Repay Button */}
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRepayClick(position)}
                    >
                      Repay
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Repay Modal */}
      <RepayModal
        position={selectedPosition}
        isOpen={isRepayModalOpen}
        onClose={handleCloseRepayModal}
        repayStep={repayStep}
        repayError={repayError}
        onRepay={onRepay}
        onReset={onResetRepay}
      />
    </>
  );
}
