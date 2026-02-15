/**
 * Reusable "Refresh / Sync" balance button used across Portfolio, Swap, and Earn screens.
 */

import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SyncBalancesButtonProps {
  isLoading: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
  variant?: 'default' | 'compact' | 'inline';
  className?: string;
}

export function SyncBalancesButton({
  isLoading,
  lastUpdated,
  onRefresh,
  variant = 'default',
  className,
}: SyncBalancesButtonProps) {
  const ageText = lastUpdated
    ? `${Math.round((Date.now() - lastUpdated.getTime()) / 1000)}s ago`
    : null;

  if (variant === 'inline') {
    return (
      <button
        onClick={onRefresh}
        disabled={isLoading}
        className={cn(
          'inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50',
          className
        )}
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <RefreshCw className="w-3 h-3" />
        )}
        {isLoading ? 'Syncing…' : 'Refresh'}
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={onRefresh}
        disabled={isLoading}
        className={cn(
          'flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50',
          className
        )}
        title={ageText ? `Last synced: ${ageText}` : 'Sync balances'}
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin text-primary" />
        ) : (
          <RefreshCw className="w-3 h-3" />
        )}
        {isLoading ? 'Syncing…' : ageText ? `Synced ${ageText}` : 'Sync'}
      </button>
    );
  }

  return (
    <Button
      onClick={onRefresh}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className={cn('gap-1.5', className)}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <RefreshCw className="w-4 h-4" />
      )}
      {isLoading ? 'Syncing…' : 'Refresh'}
    </Button>
  );
}
