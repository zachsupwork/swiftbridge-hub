/**
 * RPC Configuration & Health Status Panel
 * 
 * Shows per-chain RPC configuration and allows testing endpoints.
 * Displays detailed error information (HTTP status, CORS, timeouts, etc.)
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle, 
  Loader2, Play, Settings, Wifi, WifiOff, RefreshCw, Clock,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  SUPPORTED_CHAINS, 
  testRpcHealth, 
  maskRpcUrl,
  type RpcHealthResult 
} from '@/lib/chainConfig';
import { cn } from '@/lib/utils';

interface RpcDebugPanelProps {
  className?: string;
  partialFailures?: { chainId: number; chainName: string; error: string }[];
  onRetryChain?: (chainId: number) => void;
  onRetryAll?: () => void;
}

export function RpcDebugPanel({ 
  className,
  partialFailures = [],
  onRetryChain,
  onRetryAll,
}: RpcDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [testResults, setTestResults] = useState<Map<number, RpcHealthResult>>(new Map());
  const [testingChains, setTestingChains] = useState<Set<number>>(new Set());

  // Calculate overall status
  const { totalConfigured, totalMissing, totalFailed, allHealthy } = useMemo(() => {
    let configured = 0;
    let missing = 0;
    let failed = partialFailures.length;
    
    SUPPORTED_CHAINS.forEach(chain => {
      if (chain.rpcUrl) configured++;
      else missing++;
    });
    
    return {
      totalConfigured: configured,
      totalMissing: missing,
      totalFailed: failed,
      allHealthy: missing === 0 && failed === 0,
    };
  }, [partialFailures]);

  // Initialize with basic info
  useEffect(() => {
    const initial = new Map<number, RpcHealthResult>();
    SUPPORTED_CHAINS.forEach(chain => {
      initial.set(chain.chainId, {
        chainId: chain.chainId,
        chainName: chain.name,
        rpcEnvKey: chain.rpcEnvKey,
        rpcDefined: !!chain.rpcUrl,
        rpcPrefix: maskRpcUrl(chain.rpcUrl),
        rpcSource: chain.rpcSource,
        testSuccess: null,
        testResult: null,
        testError: null,
        httpStatus: null,
        latencyMs: null,
        errorType: 'none',
      });
    });
    setTestResults(initial);
  }, []);

  const handleTestChain = async (chainId: number) => {
    setTestingChains(prev => new Set(prev).add(chainId));
    
    try {
      const result = await testRpcHealth(chainId);
      setTestResults(prev => {
        const updated = new Map(prev);
        updated.set(chainId, result);
        return updated;
      });
    } finally {
      setTestingChains(prev => {
        const updated = new Set(prev);
        updated.delete(chainId);
        return updated;
      });
    }
  };

  const handleTestAll = async () => {
    for (const chain of SUPPORTED_CHAINS) {
      await handleTestChain(chain.chainId);
    }
  };

  const getStatusIcon = (result: RpcHealthResult) => {
    if (testingChains.has(result.chainId)) {
      return <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />;
    }
    
    // Check if this chain has a partial failure
    const hasFailed = partialFailures.some(f => f.chainId === result.chainId);
    if (hasFailed) {
      return <XCircle className="w-4 h-4 text-destructive" />;
    }
    
    if (!result.rpcDefined) {
      return <AlertCircle className="w-4 h-4 text-warning" />;
    }
    
    if (result.testSuccess === true) {
      return <CheckCircle className="w-4 h-4 text-success" />;
    }
    if (result.testSuccess === false) {
      return <XCircle className="w-4 h-4 text-destructive" />;
    }
    
    return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
  };

  const getErrorTypeLabel = (result: RpcHealthResult): string | null => {
    if (!result.testError) return null;
    
    switch (result.errorType) {
      case 'rate_limit': return 'RATE LIMITED';
      case 'timeout': return 'TIMEOUT';
      case 'cors': return 'CORS BLOCKED';
      case 'network': return 'NETWORK ERROR';
      case 'http': return `HTTP ${result.httpStatus}`;
      case 'chain_mismatch': return 'WRONG CHAIN';
      default: return 'ERROR';
    }
  };

  // Show partial failures banner if any
  const hasPartialFailures = partialFailures.length > 0;

  return (
    <div className={cn(
      "rounded-lg border",
      hasPartialFailures 
        ? "border-warning/50 bg-warning/5" 
        : allHealthy 
          ? "border-success/30 bg-success/5" 
          : "border-border bg-background/50",
      className
    )}>
      {/* Partial failures banner */}
      {hasPartialFailures && (
        <div className="px-4 py-2 border-b border-warning/30 bg-warning/10">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-warning">
              <AlertTriangle className="w-4 h-4" />
              <span>
                Some chains unavailable: {partialFailures.map(f => f.chainName).join(', ')}
              </span>
            </div>
            <div className="flex gap-2">
              {onRetryAll && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetryAll}
                  className="h-7 text-xs border-warning/40 text-warning hover:bg-warning/10"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry All
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full px-4 py-3 text-left text-sm font-medium",
          hasPartialFailures ? "text-warning" : "text-foreground"
        )}
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4" />
          <span>RPC Configuration</span>
          <Badge 
            variant="outline" 
            className={cn(
              "text-[10px] h-5",
              hasPartialFailures
                ? "border-warning/40 text-warning bg-warning/10"
                : allHealthy 
                  ? "border-success/40 text-success bg-success/10" 
                  : "border-border"
            )}
          >
            {totalConfigured - totalFailed}/{SUPPORTED_CHAINS.length} Working
          </Badge>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4">
          {/* Quick actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={handleTestAll}
              disabled={testingChains.size > 0}
              className="text-xs h-8"
            >
              <Play className="w-3 h-3 mr-1" />
              Test All RPCs
            </Button>
            <span className="text-xs text-muted-foreground">
              Tests eth_chainId on each endpoint
            </span>
          </div>

          {/* Chain status grid */}
          <div className="grid gap-2">
            {Array.from(testResults.values()).map((result) => {
              const failure = partialFailures.find(f => f.chainId === result.chainId);
              const errorLabel = getErrorTypeLabel(result);
              
              return (
                <div
                  key={result.chainId}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    failure 
                      ? "bg-destructive/5 border-destructive/30" 
                      : "bg-background/50 border-border/30"
                  )}
                >
                  {/* Status icon */}
                  {getStatusIcon(result)}
                  
                  {/* Chain name */}
                  <div className="w-20 font-medium text-sm">{result.chainName}</div>
                  
                  {/* RPC source badge */}
                  <Badge 
                    variant="outline"
                    className={cn(
                      "text-[10px] h-5",
                      result.rpcSource === 'env' 
                        ? "border-success/40 text-success" 
                        : result.rpcSource === 'fallback'
                          ? "border-warning/40 text-warning"
                          : "border-destructive/40 text-destructive"
                    )}
                  >
                    {result.rpcSource === 'env' ? 'ENV' : result.rpcSource === 'fallback' ? 'FALLBACK' : 'MISSING'}
                  </Badge>

                  {/* Error type badge */}
                  {(errorLabel || failure) && (
                    <Badge 
                      variant="outline"
                      className="text-[10px] h-5 border-destructive/40 text-destructive"
                    >
                      {errorLabel || 'FAILED'}
                    </Badge>
                  )}

                  {/* Latency */}
                  {result.latencyMs !== null && result.testSuccess && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {result.latencyMs}ms
                    </div>
                  )}

                  {/* RPC URL preview */}
                  <div className="flex-1 min-w-0 text-right">
                    <div className="text-[10px] text-muted-foreground font-mono truncate">
                      {result.rpcPrefix}
                    </div>
                    {(result.testError || failure?.error) && (
                      <div className="text-[10px] text-destructive truncate mt-0.5">
                        {result.testError || failure?.error}
                      </div>
                    )}
                    {result.testResult && (
                      <div className="text-[10px] text-success truncate mt-0.5">
                        ✓ {result.testResult}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1">
                    {failure && onRetryChain && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRetryChain(result.chainId)}
                        className="h-7 px-2 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTestChain(result.chainId)}
                      disabled={testingChains.has(result.chainId) || !result.rpcDefined}
                      className="h-7 px-2 text-xs"
                    >
                      {testingChains.has(result.chainId) ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        'Test'
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Env var instructions */}
          <div className="text-xs text-muted-foreground border-t border-border/30 pt-3">
            <p className="flex items-center gap-1 mb-2">
              💡 <span className="font-medium">Required environment variables:</span>
            </p>
            <pre className="p-3 bg-background/60 rounded-lg font-mono text-[10px] overflow-x-auto border border-border/30">
{`VITE_RPC_ETHEREUM=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
VITE_RPC_ARBITRUM=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
VITE_RPC_OPTIMISM=https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY
VITE_RPC_POLYGON=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
VITE_RPC_BASE=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
VITE_RPC_AVALANCHE=https://avax-mainnet.g.alchemy.com/v2/YOUR_KEY`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
