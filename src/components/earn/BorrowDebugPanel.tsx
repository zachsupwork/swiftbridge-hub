/**
 * Borrow Debug Panel
 * Shows per-chain status, addresses, and allows retesting individual chains
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2, RotateCw, Copy, Check, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SUPPORTED_CHAINS } from '@/lib/chainConfig';
import { AAVE_V3_ADDRESSES } from '@/lib/aaveAddressBook';
import type { ChainBorrowStatus } from '@/hooks/useAaveBorrow';

interface BorrowDebugPanelProps {
  chainStatuses: ChainBorrowStatus[];
  onRetestChain: (chainId: number) => void;
  className?: string;
}

export function BorrowDebugPanel({ chainStatuses, onRetestChain, className }: BorrowDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Count statuses
  const okCount = chainStatuses.filter(s => s.status === 'ok').length;
  const errorCount = chainStatuses.filter(s => s.status === 'error').length;
  const loadingCount = chainStatuses.filter(s => s.status === 'loading').length;

  // Generate debug report
  const generateReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        ok: okCount,
        error: errorCount,
        loading: loadingCount,
      },
      chains: chainStatuses.map(status => {
        const config = SUPPORTED_CHAINS.find(c => c.chainId === status.chainId);
        const addresses = AAVE_V3_ADDRESSES[status.chainId];
        
        return {
          chainId: status.chainId,
          chainName: status.chainName,
          status: status.status,
          rpcEnvKey: config?.rpcEnvKey || 'N/A',
          rpcDefined: !!config?.rpcUrl,
          addresses: addresses ? {
            poolAddressesProvider: addresses.POOL_ADDRESSES_PROVIDER,
            pool: addresses.POOL,
            uiPoolDataProvider: addresses.UI_POOL_DATA_PROVIDER,
          } : 'Not configured',
          marketsCount: status.markets.length,
          lastFetched: status.lastFetched ? new Date(status.lastFetched).toISOString() : null,
          error: status.error || null,
        };
      }),
    };

    return JSON.stringify(report, null, 2);
  };

  const copyReport = () => {
    navigator.clipboard.writeText(generateReport());
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  // Mask RPC URL
  const maskRpc = (url: string | undefined): string => {
    if (!url) return 'NOT SET';
    return url.substring(0, 12) + '…';
  };

  return (
    <div className={cn('glass rounded-xl overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Bug className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">Borrow Debug Panel</span>
          <div className="flex items-center gap-2">
            {okCount > 0 && (
              <Badge variant="outline" className="text-xs border-success/40 text-success">
                {okCount} OK
              </Badge>
            )}
            {errorCount > 0 && (
              <Badge variant="outline" className="text-xs border-destructive/40 text-destructive">
                {errorCount} Failed
              </Badge>
            )}
            {loadingCount > 0 && (
              <Badge variant="outline" className="text-xs border-warning/40 text-warning">
                {loadingCount} Loading
              </Badge>
            )}
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Content */}
      {isOpen && (
        <div className="border-t border-border/50 p-4 space-y-4">
          {/* Copy Report Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={copyReport}
              className="gap-2"
            >
              {copiedReport ? (
                <>
                  <Check className="w-3 h-3" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy Debug Report
                </>
              )}
            </Button>
          </div>

          {/* Chain Status Grid */}
          <div className="space-y-3">
            {SUPPORTED_CHAINS.map(config => {
              const status = chainStatuses.find(s => s.chainId === config.chainId);
              const addresses = AAVE_V3_ADDRESSES[config.chainId];
              const isLoading = status?.status === 'loading';
              const isOk = status?.status === 'ok';
              const isError = status?.status === 'error';

              return (
                <div
                  key={config.chainId}
                  className={cn(
                    'rounded-lg border p-3 space-y-2',
                    isOk && 'border-success/30 bg-success/5',
                    isError && 'border-destructive/30 bg-destructive/5',
                    isLoading && 'border-warning/30 bg-warning/5',
                    !status && 'border-border/30 bg-muted/10'
                  )}
                >
                  {/* Chain Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img
                        src={config.logo}
                        alt={config.name}
                        className="w-5 h-5 rounded-full"
                      />
                      <span className="font-medium text-sm">{config.name}</span>
                      <span className="text-xs text-muted-foreground">
                        (Chain ID: {config.chainId})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOk && <CheckCircle className="w-4 h-4 text-success" />}
                      {isError && <XCircle className="w-4 h-4 text-destructive" />}
                      {isLoading && <Loader2 className="w-4 h-4 text-warning animate-spin" />}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRetestChain(config.chainId)}
                        disabled={isLoading}
                        className="h-7 px-2"
                      >
                        <RotateCw className={cn('w-3 h-3', isLoading && 'animate-spin')} />
                      </Button>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div>
                      <span className="text-muted-foreground">RPC Env:</span>{' '}
                      <code className="text-foreground">{config.rpcEnvKey}</code>
                    </div>
                    <div>
                      <span className="text-muted-foreground">RPC:</span>{' '}
                      <span className={config.rpcUrl ? 'text-success' : 'text-destructive'}>
                        {maskRpc(config.rpcUrl)}
                      </span>
                    </div>
                  </div>

                  {/* Addresses */}
                  {addresses && (
                    <div className="text-xs space-y-0.5 font-mono bg-muted/30 rounded p-2">
                      <div className="truncate">
                        <span className="text-muted-foreground">Provider:</span>{' '}
                        {addresses.POOL_ADDRESSES_PROVIDER}
                      </div>
                      <div className="truncate">
                        <span className="text-muted-foreground">Pool:</span>{' '}
                        {addresses.POOL}
                      </div>
                      <div className="truncate">
                        <span className="text-muted-foreground">UiProvider:</span>{' '}
                        {addresses.UI_POOL_DATA_PROVIDER}
                      </div>
                    </div>
                  )}

                  {/* Status Info */}
                  {isOk && status && (
                    <div className="text-xs text-success">
                      ✓ {status.markets.length} borrowable markets loaded
                      {status.lastFetched && (
                        <span className="text-muted-foreground ml-2">
                          ({new Date(status.lastFetched).toLocaleTimeString()})
                        </span>
                      )}
                    </div>
                  )}

                  {/* Error Details */}
                  {isError && status?.error && (
                    <div className="text-xs text-destructive bg-destructive/10 rounded p-2 space-y-1">
                      <div className="font-medium">Error: {status.error.message}</div>
                      {status.error.contract && (
                        <div className="text-destructive/80 truncate">
                          Contract: {status.error.contract}
                        </div>
                      )}
                      {status.error.functionName && (
                        <div className="text-destructive/80">
                          Function: {status.error.functionName}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
