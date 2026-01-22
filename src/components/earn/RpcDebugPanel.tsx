/**
 * RPC Configuration Status Panel
 * 
 * PERSISTENT DEBUG PANEL - Visible in Preview AND Production
 * Shows RPC configuration status and allows testing endpoints
 */

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle, Loader2, Play, Settings, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SUPPORTED_CHAINS, testRpcEndpoint, type RpcTestResult } from '@/lib/chainConfig';
import { cn } from '@/lib/utils';

interface RpcDebugPanelProps {
  className?: string;
}

// Mask RPC URL for security
function maskRpcUrl(url: string | undefined): string {
  if (!url) return 'Missing env var';
  if (url.length < 20) return url;
  const first = url.substring(0, 15);
  const last = url.substring(url.length - 6);
  return `${first}...${last}`;
}

export function RpcDebugPanel({ className }: RpcDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(true); // Default open for visibility
  const [testResults, setTestResults] = useState<Map<number, RpcTestResult>>(new Map());
  const [testingChains, setTestingChains] = useState<Set<number>>(new Set());

  // Calculate overall status
  const { totalConfigured, totalMissing, allConfigured } = useMemo(() => {
    let configured = 0;
    let missing = 0;
    SUPPORTED_CHAINS.forEach(chain => {
      if (chain.rpcUrl) configured++;
      else missing++;
    });
    return {
      totalConfigured: configured,
      totalMissing: missing,
      allConfigured: missing === 0,
    };
  }, []);

  // Initialize with basic info
  useEffect(() => {
    const initial = new Map<number, RpcTestResult>();
    SUPPORTED_CHAINS.forEach(chain => {
      initial.set(chain.chainId, {
        chainId: chain.chainId,
        chainName: chain.name,
        rpcEnvKey: chain.rpcEnvKey,
        rpcDefined: !!chain.rpcUrl,
        rpcPrefix: maskRpcUrl(chain.rpcUrl),
        testSuccess: null,
        testResult: null,
        testError: null,
      });
    });
    setTestResults(initial);
  }, []);

  const handleTestChain = async (chainId: number) => {
    setTestingChains(prev => new Set(prev).add(chainId));
    
    try {
      const result = await testRpcEndpoint(chainId);
      // Update with masked URL
      result.rpcPrefix = maskRpcUrl(SUPPORTED_CHAINS.find(c => c.chainId === chainId)?.rpcUrl);
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

  const getEnvVarStatusIcon = (result: RpcTestResult) => {
    if (result.rpcDefined) {
      return <CheckCircle className="w-4 h-4 text-success" />;
    }
    return <XCircle className="w-4 h-4 text-destructive" />;
  };

  const getConnectivityStatusIcon = (result: RpcTestResult) => {
    if (testingChains.has(result.chainId)) {
      return <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />;
    }
    if (result.testSuccess === true) {
      return <Wifi className="w-4 h-4 text-success" />;
    }
    if (result.testSuccess === false) {
      return <WifiOff className="w-4 h-4 text-destructive" />;
    }
    if (!result.rpcDefined) {
      return <WifiOff className="w-4 h-4 text-muted-foreground" />;
    }
    return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className={cn(
      "rounded-lg border",
      allConfigured 
        ? "border-success/30 bg-success/5" 
        : "border-warning/50 bg-warning/10",
      className
    )}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full px-4 py-3 text-left text-sm font-medium",
          allConfigured ? "text-success" : "text-warning"
        )}
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4" />
          <span>RPC Configuration Status</span>
          <Badge 
            variant="outline" 
            className={cn(
              "text-[10px] h-5",
              allConfigured 
                ? "border-success/40 text-success bg-success/10" 
                : "border-warning/40 text-warning bg-warning/10"
            )}
          >
            {totalConfigured}/{SUPPORTED_CHAINS.length} Configured
          </Badge>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4">
          {/* Quick summary */}
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
            {Array.from(testResults.values()).map((result) => (
              <div
                key={result.chainId}
                className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/30"
              >
                {/* Chain name */}
                <div className="w-24 font-medium text-sm">{result.chainName}</div>
                
                {/* Env var status */}
                <div className="flex items-center gap-1.5 min-w-[80px]">
                  {getEnvVarStatusIcon(result)}
                  <span className={cn(
                    "text-xs font-medium",
                    result.rpcDefined ? "text-success" : "text-destructive"
                  )}>
                    {result.rpcDefined ? 'SET' : 'NOT SET'}
                  </span>
                </div>

                {/* Connectivity status */}
                <div className="flex items-center gap-1.5 min-w-[90px]">
                  {getConnectivityStatusIcon(result)}
                  <span className={cn(
                    "text-xs",
                    result.testSuccess === true 
                      ? "text-success" 
                      : result.testSuccess === false 
                        ? "text-destructive" 
                        : "text-muted-foreground"
                  )}>
                    {testingChains.has(result.chainId) 
                      ? 'Testing...' 
                      : result.testSuccess === true 
                        ? 'Connected' 
                        : result.testSuccess === false 
                          ? 'Failed' 
                          : 'Not tested'}
                  </span>
                </div>

                {/* Masked RPC URL */}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-muted-foreground font-mono truncate">
                    <span className="text-foreground/60">{result.rpcEnvKey}:</span>{' '}
                    <span className={result.rpcDefined ? '' : 'text-destructive'}>
                      {result.rpcPrefix}
                    </span>
                  </div>
                  {result.testError && (
                    <div className="text-[10px] text-destructive truncate mt-0.5">
                      ❌ {result.testError}
                    </div>
                  )}
                  {result.testResult && (
                    <div className="text-[10px] text-success truncate mt-0.5">
                      ✓ {result.testResult}
                    </div>
                  )}
                </div>

                {/* Test button */}
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
            ))}
          </div>

          {/* Instructions */}
          <div className="text-xs text-muted-foreground border-t border-border/30 pt-3">
            <p className="flex items-center gap-1 mb-2">
              💡 <span className="font-medium">Add RPC env vars to your environment:</span>
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
