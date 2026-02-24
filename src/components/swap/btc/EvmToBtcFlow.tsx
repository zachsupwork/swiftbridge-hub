import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Bitcoin, Loader2, AlertTriangle, Wallet, Info, CheckCircle2, XCircle, ExternalLink, Clock, Copy, Check } from 'lucide-react';
import { useAccount, useSendTransaction, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseUnits, formatUnits, erc20Abi } from 'viem';
import { Button } from '@/components/ui/button';
import { TokenSelector } from '@/components/swap/TokenSelector';
import { ChainSelector } from '@/components/swap/ChainSelector';
import { cn } from '@/lib/utils';
import { BTC_CHAIN_ID, BTC_TOKEN_ADDRESS } from '@/lib/lifiBtc';
import { getRoutes, type Token, type Route, getTransactionStatus } from '@/lib/lifiClient';
import {
  executeRoute as executeRouteEngine,
  type StepResult,
} from '@/lib/routeExecutor';
import { isNativeToken } from '@/lib/transactionHelper';

interface EvmToBtcFlowProps {
  onBack: () => void;
}

type FlowState = 'input' | 'quoting' | 'quoted' | 'executing' | 'tracking' | 'completed' | 'failed';

const BTC_ADDRESS_REGEX = /^(bc1[a-z0-9]{25,}|tb1[a-z0-9]{25,}|[13][a-km-zA-HJ-NP-Z1-9]{25,})$/;

function validateBtcAddress(addr: string): boolean {
  return BTC_ADDRESS_REGEX.test(addr.trim());
}

function getExplorerUrl(chainId: number, hash: string): string {
  if (chainId === BTC_CHAIN_ID) return `https://mempool.space/tx/${hash}`;
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io/tx/',
    10: 'https://optimistic.etherscan.io/tx/',
    137: 'https://polygonscan.com/tx/',
    42161: 'https://arbiscan.io/tx/',
    8453: 'https://basescan.org/tx/',
    43114: 'https://snowtrace.io/tx/',
  };
  return `${explorers[chainId] || 'https://etherscan.io/tx/'}${hash}`;
}

export function EvmToBtcFlow({ onBack }: EvmToBtcFlowProps) {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [fromChainId, setFromChainId] = useState(137);
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [btcAddress, setBtcAddress] = useState('');
  const [btcAddressTouched, setBtcAddressTouched] = useState(false);

  const [flowState, setFlowState] = useState<FlowState>('input');
  const [route, setRoute] = useState<Route | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [executionMessage, setExecutionMessage] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);

  // Tracking state
  const [trackingStatus, setTrackingStatus] = useState<string>('PENDING');
  const [receivingTxHash, setReceivingTxHash] = useState<string | null>(null);
  const [receivedAmount, setReceivedAmount] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const isBtcAddressValid = btcAddress.trim().length > 0 && validateBtcAddress(btcAddress);
  const btcAddressError = btcAddressTouched && btcAddress.trim().length > 0 && !isBtcAddressValid;

  const isFromNative = fromToken ? isNativeToken(fromToken.address) : false;

  const { data: nativeBalance } = useReadContract({
    // dummy — we use wagmi's useBalance for native
  } as any);

  const hasValidInputs = isConnected && fromToken && fromAmount && parseFloat(fromAmount) > 0 && isBtcAddressValid;

  // Reset on input change
  useEffect(() => {
    setRoute(null);
    setFlowState('input');
    setError(null);
  }, [fromChainId, fromToken, fromAmount, btcAddress]);

  const handleGetQuote = useCallback(async () => {
    if (!fromToken || !fromAmount || parseFloat(fromAmount) <= 0 || !isBtcAddressValid || !address) {
      setError('Please fill in all fields with valid values.');
      return;
    }

    setFlowState('quoting');
    setError(null);

    try {
      const fromAmountWei = parseUnits(fromAmount, fromToken.decimals).toString();

      const response = await getRoutes({
        fromChainId,
        toChainId: BTC_CHAIN_ID,
        fromTokenAddress: fromToken.address,
        toTokenAddress: BTC_TOKEN_ADDRESS,
        fromAmount: fromAmountWei,
        fromAddress: address,
        toAddress: btcAddress.trim(),
        slippage: 0.03,
      });

      if (!response.routes || response.routes.length === 0) {
        throw new Error('No available route for this pair right now. Try a different token, chain, or amount.');
      }

      setRoute(response.routes[0]);
      setFlowState('quoted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get quote');
      setFlowState('input');
    }
  }, [fromToken, fromAmount, fromChainId, isBtcAddressValid, address, btcAddress]);

  const handleExecute = useCallback(async () => {
    if (!route || !address || !fromToken || !publicClient) return;

    setFlowState('executing');
    setError(null);
    setStepResults([]);
    setExecutionMessage('');

    try {
      if (walletChainId !== fromChainId) {
        throw new Error(`Please switch to chain ${fromChainId} in your wallet.`);
      }

      const result = await executeRouteEngine(route, {
        walletChainId: walletChainId!,
        walletAddress: address as `0x${string}`,
        sendTransaction: async (params) => await sendTransactionAsync(params),
        approveToken: async ({ tokenAddress, spender, amount }) =>
          await writeContractAsync({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [spender, amount],
          } as any),
        waitForReceipt: async (hash) => {
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          return { status: receipt.status === 'success' ? 'success' : 'reverted' };
        },
        readAllowance: async ({ tokenAddress, owner, spender }) => {
          const data = await (publicClient as any).readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [owner, spender],
          });
          return data as bigint;
        },
        onUpdate: (update) => {
          setStepResults([...update.stepResults]);
          setExecutionMessage(update.message);
        },
      });

      if (result.success && result.stepResults.length > 0) {
        const lastHash = result.stepResults[result.stepResults.length - 1].txHash;
        setTxHash(lastHash);
        setFlowState('tracking');
      } else {
        throw new Error(result.error || 'Execution failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setFlowState('quoted');
    }
  }, [route, address, fromToken, publicClient, walletChainId, fromChainId, sendTransactionAsync, writeContractAsync]);

  // Poll bridge status when tracking
  useEffect(() => {
    if (flowState !== 'tracking' || !txHash || !route) return;

    let cancelled = false;
    let delay = 5000;

    const poll = async () => {
      while (!cancelled) {
        try {
          const tool = route.steps[0]?.tool;
          const status = await getTransactionStatus(txHash, route.fromChainId, BTC_CHAIN_ID, tool);

          if (cancelled) return;

          setTrackingStatus(status.status);

          if (status.status === 'DONE') {
            setReceivingTxHash(status.receiving?.txHash || null);
            setReceivedAmount(status.receiving?.amount || null);
            setFlowState('completed');
            return;
          }
          if (status.status === 'FAILED') {
            setFlowState('failed');
            return;
          }
          delay = 5000;
        } catch {
          delay = Math.min(delay * 2, 20000);
        }
        await new Promise(r => setTimeout(r, delay));
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [flowState, txHash, route]);

  const handleReset = useCallback(() => {
    setFlowState('input');
    setRoute(null);
    setError(null);
    setFromAmount('');
    setFromToken(null);
    setBtcAddress('');
    setBtcAddressTouched(false);
    setTxHash(null);
    setStepResults([]);
    setExecutionMessage('');
    setTrackingStatus('PENDING');
    setReceivingTxHash(null);
    setReceivedAmount(null);
  }, []);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const estimatedBtc = route
    ? (parseInt(route.toAmount) / 1e8).toFixed(8)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-lg mx-auto"
    >
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Bitcoin className="w-4 h-4 text-orange-500" />
            </div>
            <h2 className="text-lg font-bold">EVM → BTC Swap</h2>
          </div>
        </div>

        {/* Completed */}
        {flowState === 'completed' && (
          <div className="py-6 text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
            <h3 className="font-semibold text-lg">Swap Complete!</h3>
            <p className="text-sm text-muted-foreground">
              BTC has been sent to your Bitcoin address.
            </p>
            {receivedAmount && (
              <p className="text-2xl font-bold font-mono">
                {(parseInt(receivedAmount) / 1e8).toFixed(8)} <span className="text-sm text-muted-foreground">BTC</span>
              </p>
            )}
            <div className="space-y-2">
              {txHash && (
                <a href={getExplorerUrl(fromChainId, txHash)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-sm text-primary hover:underline">
                  View EVM transaction <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {receivingTxHash && (
                <a href={`https://mempool.space/tx/${receivingTxHash}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-sm text-primary hover:underline">
                  View BTC payout on Mempool <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <Button onClick={handleReset} variant="outline" className="w-full mt-2">New Swap</Button>
          </div>
        )}

        {/* Failed */}
        {flowState === 'failed' && (
          <div className="py-6 text-center space-y-4">
            <XCircle className="w-14 h-14 text-destructive mx-auto" />
            <h3 className="font-semibold text-lg">Swap Failed</h3>
            <p className="text-sm text-muted-foreground">The cross-chain transfer failed. Your source funds may be refunded.</p>
            {txHash && (
              <a href={getExplorerUrl(fromChainId, txHash)} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-sm text-primary hover:underline">
                View transaction <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <Button onClick={handleReset} variant="outline" className="w-full">Try Again</Button>
          </div>
        )}

        {/* Tracking */}
        {flowState === 'tracking' && (
          <div className="py-6 text-center space-y-4">
            <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
            <h3 className="font-semibold">Processing Swap…</h3>
            <p className="text-sm text-muted-foreground">
              Your EVM transaction was submitted. Waiting for BTC payout to your address.
            </p>

            <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm border border-border/30 text-left">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Destination</span>
                <span className="font-mono text-xs">{btcAddress.slice(0, 10)}…{btcAddress.slice(-6)}</span>
              </div>
              {estimatedBtc && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected BTC</span>
                  <span className="font-mono font-bold">~{estimatedBtc}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="capitalize">{trackingStatus.toLowerCase()}</span>
              </div>
            </div>

            {txHash && (
              <a href={getExplorerUrl(fromChainId, txHash)} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-sm text-primary hover:underline">
                View EVM transaction <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Executing */}
        {flowState === 'executing' && (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin" />
            <p className="text-sm text-muted-foreground">{executionMessage || 'Preparing transaction…'}</p>
          </div>
        )}

        {/* Quoting */}
        {flowState === 'quoting' && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin" />
            <p className="text-sm text-muted-foreground">Finding best EVM → BTC route…</p>
          </div>
        )}

        {/* Quoted — review */}
        {flowState === 'quoted' && route && (
          <>
            <div className="bg-muted/20 rounded-xl p-4 space-y-3 border border-border/30">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">You send</span>
                <span className="font-bold">{fromAmount} {fromToken?.symbol}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">You receive (est.)</span>
                <span className="font-bold font-mono">{estimatedBtc} BTC</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">BTC destination</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs">{btcAddress.slice(0, 8)}…{btcAddress.slice(-6)}</span>
                  <button onClick={() => copyToClipboard(btcAddress, 'dest')} className="text-primary">
                    {copiedField === 'dest' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Route via</span>
                <span>{route.steps.map(s => s.toolDetails?.name || s.tool).join(' → ')}</span>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button onClick={handleExecute} className="w-full py-6 text-lg gradient-primary text-primary-foreground hover:opacity-90">
              Confirm Swap to BTC
            </Button>
            <button onClick={() => { setRoute(null); setFlowState('input'); }} className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors py-1">
              ← Edit inputs
            </button>
          </>
        )}

        {/* Input state */}
        {flowState === 'input' && (
          <>
            {/* From: EVM token */}
            <div className="bg-muted/20 rounded-xl p-4 space-y-3 border border-border/30">
              <span className="text-sm font-semibold">From: EVM Token</span>
              <div className="grid grid-cols-2 gap-3">
                <ChainSelector
                  selectedChainId={fromChainId}
                  onSelect={(chain) => { setFromChainId(chain.id); setFromToken(null); }}
                  label="Chain"
                />
                <TokenSelector
                  chainId={fromChainId}
                  selectedToken={fromToken}
                  onSelect={setFromToken}
                  label="Token"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
                <input
                  type="number"
                  placeholder="0.0"
                  step="any"
                  min="0"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="w-full p-3 rounded-xl border border-border/30 bg-muted/10 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center -my-2 relative z-10">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg ring-4 ring-card">
                <span className="text-primary-foreground text-lg">↓</span>
              </div>
            </div>

            {/* To: BTC */}
            <div className="bg-muted/20 rounded-xl p-4 space-y-3 border border-border/30">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                  <Bitcoin className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold">To: Bitcoin (BTC)</span>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Your BTC Address</label>
                <input
                  type="text"
                  placeholder="bc1q... or 1... or 3..."
                  value={btcAddress}
                  onChange={(e) => { setBtcAddress(e.target.value); setBtcAddressTouched(true); }}
                  className={cn(
                    "w-full p-3 rounded-xl border bg-muted/10 text-sm font-mono focus:outline-none focus:ring-2 transition-all",
                    btcAddressError
                      ? "border-destructive/50 focus:ring-destructive/30"
                      : "border-border/30 focus:ring-primary/30"
                  )}
                />
                {btcAddressError && (
                  <p className="text-xs text-destructive mt-1">
                    Invalid BTC address. Must start with bc1, 1, or 3.
                  </p>
                )}
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Only enter a Bitcoin address. Funds will be sent to the BTC network.</span>
              </div>
            </div>

            {/* Info */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground/80 px-1">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                You'll sign an EVM transaction. The bridge will convert and send BTC to your address.
                Routes powered by LI.FI.
              </span>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Action */}
            {!isConnected ? (
              <ConnectButton.Custom>
                {({ openConnectModal, mounted }) => (
                  <Button
                    onClick={() => mounted && openConnectModal()}
                    className="w-full py-6 text-lg gap-2 gradient-primary text-primary-foreground hover:opacity-90"
                  >
                    <Wallet className="w-5 h-5" />
                    Connect Wallet
                  </Button>
                )}
              </ConnectButton.Custom>
            ) : (
              <Button
                onClick={handleGetQuote}
                disabled={!hasValidInputs}
                className="w-full py-6 text-lg gradient-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Get Quote
              </Button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
