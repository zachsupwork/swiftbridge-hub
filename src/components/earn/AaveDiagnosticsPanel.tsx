/**
 * Aave Diagnostics Panel
 * 
 * A comprehensive diagnostic tool to identify exactly which Aave contract call fails.
 * Runs 5 sequential steps to isolate the issue.
 */

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Play, Copy, Check, CheckCircle, XCircle, Loader2, AlertTriangle, Bug } from 'lucide-react';
import { createPublicClient, http, type Chain, erc20Abi } from 'viem';
import { mainnet, arbitrum, optimism, polygon, base, avalanche } from 'viem/chains';
import { useAccount, useChainId } from 'wagmi';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getChainConfig, SUPPORTED_CHAINS, type ChainConfig } from '@/lib/chainConfig';
import { 
  AAVE_V3_ADDRESSES, 
  UI_POOL_DATA_PROVIDER_ABI,
  getAaveAddresses,
} from '@/lib/aaveAddressBook';
import { cn } from '@/lib/utils';

// Viem chain objects by chainId
const VIEM_CHAINS: Record<number, Chain> = {
  1: mainnet,
  42161: arbitrum,
  10: optimism,
  137: polygon,
  8453: base,
  43114: avalanche,
};

// Pool Addresses Provider ABI (minimal)
const POOL_ADDRESSES_PROVIDER_ABI = [
  {
    inputs: [],
    name: 'getPool',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Extended UI Pool Data Provider ABI with getReservesList
const UI_POOL_DATA_PROVIDER_EXTENDED_ABI = [
  ...UI_POOL_DATA_PROVIDER_ABI,
  {
    inputs: [
      { internalType: 'contract IPoolAddressesProvider', name: 'provider', type: 'address' }
    ],
    name: 'getReservesList',
    outputs: [
      { internalType: 'address[]', name: '', type: 'address[]' }
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

interface DiagnosticStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  result?: string;
  error?: string;
  details?: Record<string, unknown>;
}

interface DiagnosticReport {
  timestamp: string;
  chainId: number;
  chainName: string;
  rpcHostname: string;
  walletAddress: string | null;
  addresses: {
    poolAddressesProvider: string;
    pool: string;
    uiPoolDataProvider: string;
  };
  steps: DiagnosticStep[];
}

interface AaveDiagnosticsPanelProps {
  className?: string;
}

// Mask RPC URL for display
function maskRpcUrl(url: string | undefined): string {
  if (!url) return 'N/A';
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url.length > 30 ? `${url.substring(0, 15)}...${url.substring(url.length - 6)}` : url;
  }
}

// Get hostname from RPC URL
function getRpcHostname(url: string | undefined): string {
  if (!url) return 'N/A';
  try {
    return new URL(url).hostname;
  } catch {
    return 'invalid-url';
  }
}

export function AaveDiagnosticsPanel({ className }: AaveDiagnosticsPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<DiagnosticStep[]>([]);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [copied, setCopied] = useState(false);
  
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();

  // Get current chain config
  const currentChainConfig = getChainConfig(walletChainId);
  const aaveAddresses = getAaveAddresses(walletChainId);

  // Initialize step states
  const createInitialSteps = (): DiagnosticStep[] => [
    {
      id: 'rpc',
      name: 'RPC Sanity Check',
      description: 'Verify eth_chainId and eth_blockNumber',
      status: 'pending',
    },
    {
      id: 'provider',
      name: 'PoolAddressesProvider',
      description: 'Call getPool() to verify contract reachability',
      status: 'pending',
    },
    {
      id: 'reserves-list',
      name: 'Reserves List',
      description: 'Call getReservesList() on UiPoolDataProvider',
      status: 'pending',
    },
    {
      id: 'reserves-data',
      name: 'Market Data Fetch',
      description: 'Call getReservesData() for full market data',
      status: 'pending',
    },
    {
      id: 'balance',
      name: 'Wallet Balance Test',
      description: 'Call ERC20 balanceOf() on first reserve asset',
      status: 'pending',
    },
  ];

  // Update a specific step
  const updateStep = useCallback((stepId: string, update: Partial<DiagnosticStep>) => {
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, ...update } : s));
  }, []);

  // Run diagnostics
  const runDiagnostics = useCallback(async () => {
    if (!currentChainConfig) {
      console.error('[Diagnostics] No chain config for chainId:', walletChainId);
      return;
    }

    setIsRunning(true);
    const initialSteps = createInitialSteps();
    setSteps(initialSteps);

    const reportData: DiagnosticReport = {
      timestamp: new Date().toISOString(),
      chainId: walletChainId,
      chainName: currentChainConfig.name,
      rpcHostname: getRpcHostname(currentChainConfig.rpcUrl),
      walletAddress: address || null,
      addresses: {
        poolAddressesProvider: aaveAddresses?.POOL_ADDRESSES_PROVIDER || 'N/A',
        pool: aaveAddresses?.POOL || 'N/A',
        uiPoolDataProvider: aaveAddresses?.UI_POOL_DATA_PROVIDER || 'N/A',
      },
      steps: [],
    };

    // Check prerequisites
    if (!currentChainConfig.rpcUrl) {
      updateStep('rpc', { 
        status: 'failed', 
        error: `Missing RPC: ${currentChainConfig.rpcEnvKey} not set` 
      });
      setIsRunning(false);
      return;
    }

    if (!aaveAddresses) {
      updateStep('rpc', { 
        status: 'failed', 
        error: `Chain ${walletChainId} not in Aave address book` 
      });
      setIsRunning(false);
      return;
    }

    const viemChain = VIEM_CHAINS[walletChainId];
    if (!viemChain) {
      updateStep('rpc', { 
        status: 'failed', 
        error: `Chain ${walletChainId} not configured in viem` 
      });
      setIsRunning(false);
      return;
    }

    // Create viem client
    const client = createPublicClient({
      chain: viemChain,
      transport: http(currentChainConfig.rpcUrl),
    });

    let firstReserveAddress: `0x${string}` | null = null;

    // STEP 1: RPC Sanity Check
    try {
      updateStep('rpc', { status: 'running' });
      
      const [chainId, blockNumber] = await Promise.all([
        client.getChainId(),
        client.getBlockNumber(),
      ]);

      if (chainId !== walletChainId) {
        throw new Error(`Chain ID mismatch: expected ${walletChainId}, got ${chainId}`);
      }

      updateStep('rpc', { 
        status: 'success', 
        result: `ChainId: ${chainId}, Block: ${blockNumber.toString()}` 
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      updateStep('rpc', { status: 'failed', error: errMsg });
      setIsRunning(false);
      setReport({ ...reportData, steps: [...initialSteps] });
      return;
    }

    // STEP 2: PoolAddressesProvider.getPool()
    try {
      updateStep('provider', { status: 'running' });
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const poolAddress = await (client.readContract as any)({
        address: aaveAddresses.POOL_ADDRESSES_PROVIDER,
        abi: POOL_ADDRESSES_PROVIDER_ABI,
        functionName: 'getPool',
      }) as `0x${string}`;

      if (!poolAddress || poolAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error('getPool() returned zero address');
      }

      // Verify it matches our address book
      const expectedPool = aaveAddresses.POOL;
      const matches = poolAddress.toLowerCase() === expectedPool.toLowerCase();

      updateStep('provider', { 
        status: 'success', 
        result: `Pool: ${poolAddress.slice(0, 10)}...${poolAddress.slice(-6)}`,
        details: { 
          returnedPool: poolAddress, 
          expectedPool, 
          matches 
        }
      });

      if (!matches) {
        console.warn('[Diagnostics] Pool address mismatch!', { returned: poolAddress, expected: expectedPool });
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      updateStep('provider', { 
        status: 'failed', 
        error: `PoolAddressesProvider.getPool() failed: ${errMsg}`,
        details: {
          contract: aaveAddresses.POOL_ADDRESSES_PROVIDER,
          chainId: walletChainId,
        }
      });
      setIsRunning(false);
      setReport({ ...reportData, steps: [...initialSteps] });
      return;
    }

    // STEP 3: UiPoolDataProvider.getReservesList()
    try {
      updateStep('reserves-list', { status: 'running' });
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reservesList = await (client.readContract as any)({
        address: aaveAddresses.UI_POOL_DATA_PROVIDER,
        abi: UI_POOL_DATA_PROVIDER_EXTENDED_ABI,
        functionName: 'getReservesList',
        args: [aaveAddresses.POOL_ADDRESSES_PROVIDER],
      }) as `0x${string}`[];

      if (!reservesList || reservesList.length === 0) {
        throw new Error('getReservesList() returned empty array');
      }

      firstReserveAddress = reservesList[0];

      updateStep('reserves-list', { 
        status: 'success', 
        result: `${reservesList.length} reserves found`,
        details: { 
          count: reservesList.length, 
          first: reservesList[0],
          last: reservesList[reservesList.length - 1],
        }
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      updateStep('reserves-list', { 
        status: 'failed', 
        error: `UiPoolDataProvider.getReservesList() failed: ${errMsg}`,
        details: {
          contract: aaveAddresses.UI_POOL_DATA_PROVIDER,
          args: [aaveAddresses.POOL_ADDRESSES_PROVIDER],
          chainId: walletChainId,
        }
      });
      setIsRunning(false);
      setReport({ ...reportData, steps: [...initialSteps] });
      return;
    }

    // STEP 4: UiPoolDataProvider.getReservesData()
    try {
      updateStep('reserves-data', { status: 'running' });
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (client.readContract as any)({
        address: aaveAddresses.UI_POOL_DATA_PROVIDER,
        abi: UI_POOL_DATA_PROVIDER_ABI,
        functionName: 'getReservesData',
        args: [aaveAddresses.POOL_ADDRESSES_PROVIDER],
      }) as [unknown[], unknown];

      const [reserves] = result;

      if (!reserves || !Array.isArray(reserves) || reserves.length === 0) {
        throw new Error('getReservesData() returned empty reserves array');
      }

      // Get first reserve symbol for display
      const firstReserve = reserves[0] as { symbol?: string; name?: string };
      const exampleSymbol = firstReserve?.symbol || 'Unknown';

      updateStep('reserves-data', { 
        status: 'success', 
        result: `${reserves.length} reserves, e.g. ${exampleSymbol}`,
        details: { 
          count: reserves.length,
          example: firstReserve,
        }
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      updateStep('reserves-data', { 
        status: 'failed', 
        error: `UiPoolDataProvider.getReservesData() failed: ${errMsg}`,
        details: {
          contract: aaveAddresses.UI_POOL_DATA_PROVIDER,
          args: [aaveAddresses.POOL_ADDRESSES_PROVIDER],
          chainId: walletChainId,
          fullError: String(error),
        }
      });
      setIsRunning(false);
      setReport({ ...reportData, steps: [...initialSteps] });
      return;
    }

    // STEP 5: ERC20 Balance Test
    if (isConnected && address && firstReserveAddress) {
      try {
        updateStep('balance', { status: 'running' });
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const readContractFn = client.readContract as any;
        const [balance, decimals] = await Promise.all([
          readContractFn({
            address: firstReserveAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address],
          }) as Promise<bigint>,
          readContractFn({
            address: firstReserveAddress,
            abi: erc20Abi,
            functionName: 'decimals',
          }) as Promise<number>,
        ]);

        const formatted = (Number(balance) / Math.pow(10, decimals)).toFixed(6);

        updateStep('balance', { 
          status: 'success', 
          result: `Balance: ${formatted} (${decimals} decimals)`,
          details: { 
            token: firstReserveAddress,
            rawBalance: balance.toString(),
            decimals,
          }
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        updateStep('balance', { 
          status: 'failed', 
          error: `ERC20 balance check failed: ${errMsg}`,
          details: { token: firstReserveAddress }
        });
      }
    } else {
      updateStep('balance', { 
        status: 'success', 
        result: isConnected ? 'No reserve address available' : 'Wallet not connected (skipped)' 
      });
    }

    setIsRunning(false);
    setReport({ ...reportData, steps: [...steps] });
  }, [currentChainConfig, walletChainId, address, isConnected, aaveAddresses, updateStep]);

  // Copy debug report
  const handleCopyReport = useCallback(() => {
    const reportText = JSON.stringify({
      timestamp: new Date().toISOString(),
      chainId: walletChainId,
      chainName: currentChainConfig?.name || 'Unknown',
      walletAddress: address || null,
      rpcHostname: getRpcHostname(currentChainConfig?.rpcUrl),
      addresses: {
        poolAddressesProvider: aaveAddresses?.POOL_ADDRESSES_PROVIDER || 'N/A',
        pool: aaveAddresses?.POOL || 'N/A',
        uiPoolDataProvider: aaveAddresses?.UI_POOL_DATA_PROVIDER || 'N/A',
      },
      steps: steps.map(s => ({
        name: s.name,
        status: s.status,
        result: s.result,
        error: s.error,
        details: s.details,
      })),
    }, null, 2);

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [walletChainId, currentChainConfig, address, aaveAddresses, steps]);

  const getStatusIcon = (status: DiagnosticStep['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  const hasErrors = steps.some(s => s.status === 'failed');
  const allPassed = steps.length > 0 && steps.every(s => s.status === 'success');

  return (
    <div className={cn(
      "rounded-lg border",
      hasErrors 
        ? "border-destructive/50 bg-destructive/5" 
        : allPassed 
          ? "border-success/30 bg-success/5"
          : "border-warning/50 bg-warning/5",
      className
    )}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full px-4 py-3 text-left text-sm font-medium",
          hasErrors ? "text-destructive" : allPassed ? "text-success" : "text-warning"
        )}
      >
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4" />
          <span>Aave Diagnostics</span>
          {hasErrors && (
            <Badge variant="destructive" className="text-[10px] h-5">
              Error Found
            </Badge>
          )}
          {allPassed && (
            <Badge variant="outline" className="text-[10px] h-5 border-success/40 text-success bg-success/10">
              All Passed
            </Badge>
          )}
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4">
          {/* Current State Display */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-background/50 border border-border/30 text-xs">
            <div>
              <span className="text-muted-foreground">Wallet:</span>{' '}
              <span className="font-mono">
                {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Chain:</span>{' '}
              <span className="font-medium">{currentChainConfig?.name || 'Unknown'} ({walletChainId})</span>
            </div>
            <div>
              <span className="text-muted-foreground">RPC Host:</span>{' '}
              <span className="font-mono">{maskRpcUrl(currentChainConfig?.rpcUrl)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Chain Supported:</span>{' '}
              <span className={aaveAddresses ? 'text-success' : 'text-destructive'}>
                {aaveAddresses ? 'Yes' : 'No'}
              </span>
            </div>
          </div>

          {/* Aave Addresses */}
          {aaveAddresses && (
            <div className="p-3 rounded-lg bg-background/50 border border-border/30 text-xs space-y-1">
              <div className="font-medium mb-2">Aave V3 Addresses for {currentChainConfig?.name}:</div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-40">PoolAddressesProvider:</span>
                <code className="font-mono text-[10px]">{aaveAddresses.POOL_ADDRESSES_PROVIDER}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-40">Pool:</span>
                <code className="font-mono text-[10px]">{aaveAddresses.POOL}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-40">UiPoolDataProvider:</span>
                <code className="font-mono text-[10px]">{aaveAddresses.UI_POOL_DATA_PROVIDER}</code>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={hasErrors ? "destructive" : "default"}
              onClick={runDiagnostics}
              disabled={isRunning || !currentChainConfig?.rpcUrl}
              className="text-xs h-8"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 mr-1" />
                  Run Diagnostics
                </>
              )}
            </Button>
            
            {steps.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyReport}
                className="text-xs h-8"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    Copy Debug Report
                  </>
                )}
              </Button>
            )}

            {!currentChainConfig?.rpcUrl && (
              <span className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                RPC not configured for this chain
              </span>
            )}
          </div>

          {/* Diagnostic Steps */}
          {steps.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Diagnostic Steps:</div>
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={cn(
                    "p-3 rounded-lg border",
                    step.status === 'failed' 
                      ? "border-destructive/30 bg-destructive/5"
                      : step.status === 'success'
                        ? "border-success/20 bg-success/5"
                        : "border-border/30 bg-background/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(step.status)}
                        <span className="font-medium text-sm">{step.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                      
                      {step.result && (
                        <div className="mt-2 text-xs text-success font-mono bg-success/10 px-2 py-1 rounded">
                          ✓ {step.result}
                        </div>
                      )}
                      
                      {step.error && (
                        <div className="mt-2 text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">
                          ✗ {step.error}
                        </div>
                      )}

                      {step.details && step.status === 'failed' && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            Show technical details
                          </summary>
                          <pre className="mt-1 text-[10px] bg-muted/50 p-2 rounded overflow-x-auto">
                            {JSON.stringify(step.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Supported Chains Info */}
          <div className="text-xs text-muted-foreground border-t border-border/30 pt-3">
            <p className="font-medium mb-1">Supported Chains:</p>
            <div className="flex flex-wrap gap-1">
              {SUPPORTED_CHAINS.map(chain => (
                <Badge
                  key={chain.chainId}
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    chain.chainId === walletChainId
                      ? "border-primary text-primary"
                      : "border-muted text-muted-foreground"
                  )}
                >
                  {chain.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
