/**
 * Friendly "balances syncing" state for when no tokens are found.
 * Replaces dead-end "No tokens found" messages with retry option.
 */

import { Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BalanceSyncingStateProps {
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  chainName?: string;
  walletAddress?: string;
  searchActive?: boolean;
}

export function BalanceSyncingState({
  isLoading,
  error,
  onRefresh,
  chainName,
  walletAddress,
  searchActive,
}: BalanceSyncingStateProps) {
  if (searchActive) {
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <p className="text-muted-foreground">No tokens match your search</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
        <p className="text-muted-foreground">Syncing balances{chainName ? ` on ${chainName}` : ' across chains'}…</p>
        <p className="text-xs text-muted-foreground/60 mt-2">This may take a few seconds</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-8 text-center space-y-4">
      <div>
        <p className="font-medium text-foreground mb-1">
          {error ? 'Having trouble fetching balances' : 'Balances still syncing'}
        </p>
        <p className="text-sm text-muted-foreground">
          {error
            ? "We're having trouble reaching the network right now. Your funds are safe."
            : `Sometimes wallets take a moment to report tokens${chainName ? ` on ${chainName}` : ' across chains'}. Tap Refresh to sync again.`}
        </p>
      </div>
      <div className="flex items-center justify-center gap-3">
        <Button onClick={onRefresh} variant="outline" size="sm" className="gap-1.5">
          <RefreshCw className="w-4 h-4" />
          Refresh / Sync
        </Button>
        {walletAddress && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => window.open(`https://debank.com/profile/${walletAddress}`, '_blank')}
          >
            <ExternalLink className="w-4 h-4" />
            View in Explorer
          </Button>
        )}
      </div>
    </div>
  );
}
