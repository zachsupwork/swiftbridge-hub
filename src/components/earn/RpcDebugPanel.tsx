/**
 * RPC Debug Panel - DEV MODE ONLY
 * 
 * Shows RPC configuration status and allows testing endpoints
 */

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SUPPORTED_CHAINS, testRpcEndpoint, type RpcTestResult } from '@/lib/chainConfig';
import { cn } from '@/lib/utils';

interface RpcDebugPanelProps {
  className?: string;
}

export function RpcDebugPanel({ className }: RpcDebugPanelProps) {
  // Only render in development
  if (!import.meta.env.DEV) {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [testResults, setTestResults] = useState<Map<number, RpcTestResult>>(new Map());
  const [testingChains, setTestingChains] = useState<Set<number>>(new Set());

  // Initialize with basic info
  useEffect(() => {
    const initial = new Map<number, RpcTestResult>();
    SUPPORTED_CHAINS.forEach(chain => {
      initial.set(chain.chainId, {
        chainId: chain.chainId,
        chainName: chain.name,
        rpcEnvKey: chain.rpcEnvKey,
        rpcDefined: !!chain.rpcUrl,
        rpcPrefix: chain.rpcUrl ? chain.rpcUrl.substring(0, 25) + '...' : 'N/A',
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

  const getStatusIcon = (result: RpcTestResult) => {
    if (testingChains.has(result.chainId)) {
      return <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />;
    }
    if (result.testSuccess === true) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    if (result.testSuccess === false) {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    if (!result.rpcDefined) {
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
    return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className={cn("rounded-lg border border-yellow-500/50 bg-yellow-500/10", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-2 text-left text-sm font-medium text-yellow-500"
      >
        <span>🔧 RPC Debug Panel (DEV ONLY)</span>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleTestAll}
              disabled={testingChains.size > 0}
              className="text-xs"
            >
              <Play className="w-3 h-3 mr-1" />
              Test All RPCs
            </Button>
            <span className="text-xs text-muted-foreground">
              Click to test eth_chainId on each endpoint
            </span>
          </div>

          <div className="space-y-2">
            {Array.from(testResults.values()).map((result) => (
              <div
                key={result.chainId}
                className="flex items-center gap-3 p-2 rounded bg-background/50 text-xs"
              >
                {getStatusIcon(result)}
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{result.chainName}</div>
                  <div className="text-muted-foreground font-mono text-[10px] truncate">
                    {result.rpcEnvKey}: {result.rpcDefined ? result.rpcPrefix : 'NOT SET'}
                  </div>
                  {result.testError && (
                    <div className="text-red-400 text-[10px] truncate">
                      ❌ {result.testError}
                    </div>
                  )}
                  {result.testResult && (
                    <div className="text-green-400 text-[10px]">
                      ✓ {result.testResult}
                    </div>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleTestChain(result.chainId)}
                  disabled={testingChains.has(result.chainId)}
                  className="h-6 px-2 text-[10px]"
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

          <div className="text-[10px] text-muted-foreground border-t border-border/50 pt-2">
            <p>💡 Add RPC env vars to your .env file:</p>
            <pre className="mt-1 p-2 bg-background/50 rounded font-mono overflow-x-auto">
{`VITE_RPC_ETHEREUM=https://...
VITE_RPC_ARBITRUM=https://...
VITE_RPC_OPTIMISM=https://...
VITE_RPC_POLYGON=https://...
VITE_RPC_BASE=https://...
VITE_RPC_AVALANCHE=https://...`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
