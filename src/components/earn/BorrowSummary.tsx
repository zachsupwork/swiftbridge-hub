/**
 * Borrow Summary Component
 * Shows user's borrow position summary for the selected chain
 */

import { TrendingDown, Shield, AlertTriangle, Wallet, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { UserAccountData } from '@/hooks/useAaveBorrow';

interface BorrowSummaryProps {
  accountData: UserAccountData | null;
  isLoading: boolean;
  isConnected: boolean;
  chainName?: string;
  isChainAvailable: boolean;
  className?: string;
}

export function BorrowSummary({
  accountData,
  isLoading,
  isConnected,
  chainName,
  isChainAvailable,
  className,
}: BorrowSummaryProps) {
  // Format currency
  const formatUsd = (value: number) => {
    if (value === 0) return '$0.00';
    if (value < 0.01) return '<$0.01';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format health factor with color coding
  const getHealthFactorColor = (hf: number) => {
    if (hf === 0 || !isFinite(hf)) return 'text-muted-foreground';
    if (hf >= 2) return 'text-success';
    if (hf >= 1.5) return 'text-yellow-500';
    if (hf >= 1.1) return 'text-warning';
    return 'text-destructive';
  };

  const formatHealthFactor = (hf: number) => {
    if (hf === 0) return '∞';
    if (!isFinite(hf) || hf > 100) return '∞';
    return hf.toFixed(2);
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className={cn('glass rounded-xl p-6', className)}>
        <div className="flex flex-col items-center justify-center text-center py-4">
          <Wallet className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Connect your wallet to view your borrow position</p>
        </div>
      </div>
    );
  }

  // Chain unavailable state
  if (!isChainAvailable) {
    return (
      <div className={cn('glass rounded-xl p-6', className)}>
        <div className="flex flex-col items-center justify-center text-center py-4">
          <AlertTriangle className="w-10 h-10 text-warning mb-3" />
          <p className="font-medium text-warning mb-1">Chain Unavailable</p>
          <p className="text-sm text-muted-foreground">
            {chainName ? `Borrow is not available on ${chainName} right now.` : 'This chain is currently unavailable.'}
            <br />Please select another chain.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('glass rounded-xl p-6', className)}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 bg-muted rounded animate-pulse" />
              <div className="h-6 w-24 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No account data (user has no positions)
  if (!accountData || accountData.totalCollateralUsd === 0) {
    return (
      <div className={cn('glass rounded-xl p-6', className)}>
        <div className="flex flex-col items-center justify-center text-center py-4">
          <Activity className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="font-medium mb-1">No Collateral Supplied</p>
          <p className="text-sm text-muted-foreground">
            Supply assets as collateral in the "Lend" tab first to enable borrowing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('glass rounded-xl p-6', className)}>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        {/* Total Collateral */}
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Shield className="w-3 h-3" />
            Total Collateral
          </div>
          <div className="text-xl font-semibold">
            {formatUsd(accountData.totalCollateralUsd)}
          </div>
        </div>

        {/* Total Debt */}
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <TrendingDown className="w-3 h-3" />
            Total Debt
          </div>
          <div className="text-xl font-semibold">
            {formatUsd(accountData.totalDebtUsd)}
          </div>
        </div>

        {/* Available to Borrow */}
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            Available to Borrow
          </div>
          <div className="text-xl font-semibold text-primary">
            {formatUsd(accountData.availableBorrowsUsd)}
          </div>
        </div>

        {/* Health Factor */}
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            Health Factor
          </div>
          <div className={cn('text-xl font-semibold', getHealthFactorColor(accountData.healthFactorFormatted))}>
            {formatHealthFactor(accountData.healthFactorFormatted)}
            {accountData.healthFactorFormatted > 0 && accountData.healthFactorFormatted < 1.1 && (
              <AlertTriangle className="w-4 h-4 inline ml-1" />
            )}
          </div>
        </div>

        {/* Borrow Limit Used */}
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            Borrow Limit Used
          </div>
          <div className="space-y-1.5">
            <div className="text-xl font-semibold">
              {accountData.borrowLimitUsedPercent.toFixed(1)}%
            </div>
            <Progress 
              value={Math.min(accountData.borrowLimitUsedPercent, 100)} 
              className="h-1.5"
            />
          </div>
        </div>
      </div>

      {/* Warning for low health factor */}
      {accountData.healthFactorFormatted > 0 && accountData.healthFactorFormatted < 1.5 && (
        <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-medium text-warning">Low Health Factor Warning:</span>{' '}
            <span className="text-muted-foreground">
              Your position is at risk of liquidation. Consider repaying some debt or adding more collateral.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
