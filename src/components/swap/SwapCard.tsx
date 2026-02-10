import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, ArrowUpDown, Settings, Loader2, AlertTriangle, Zap, Bug, Info, Wallet, Clock, CheckCircle2, XCircle, RefreshCw, ChevronDown } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useSendTransaction, useBalance, useReadContract } from 'wagmi';
import { parseUnits, formatUnits, erc20Abi } from 'viem';
import { TokenSelector } from './TokenSelector';
import { ChainSelector } from './ChainSelector';
import { FeeBreakdown } from './FeeBreakdown';
import { TransactionTracker } from './TransactionTracker';
import { SimulationSummary } from './SimulationSummary';
import { IntegratorFeeTooltip, IntegratorDebugPanel } from './IntegratorDebug';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Token, Route, getRoutes, getIntegratorFee, getStepTransaction } from '@/lib/lifiClient';
import { saveSwap, SwapRecord } from '@/lib/swapStorage';
import { cn } from '@/lib/utils';
import {
  normalizeTxRequest,
  getTransactionSimulation,
  logTransactionDetails,
  TransactionValidationError,
  type TransactionSimulation,
} from '@/lib/transactionHelper';
import { isChainSupported, getChainName, getSupportedChainIds } from '@/lib/wagmiConfig';
import { useMultiWallet } from '@/lib/wallets';
import { 
  validatePreflight, 
  getQuoteTimeRemaining, 
  isQuoteExpired,
  getErrorSuggestions,
  type PreflightResult,
} from '@/lib/swapPreflight';

type SwapState = 'idle' | 'quoting' | 'quoted' | 'approving' | 'swapping' | 'tracking';

const QUOTE_MAX_AGE = 45;

export function SwapCard() {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  // Removed useSwitchChain — causes "getChainId is not a function" on MetaMask.
  // Chain mismatch is handled via UI prompt below.
  const wallets = useMultiWallet();

  const [fromChainId, setFromChainId] = useState(1);
  const [toChainId, setToChainId] = useState(1);
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [showSettings, setShowSettings] = useState(false);

  const [state, setState] = useState<SwapState>('idle');
  const [route, setRoute] = useState<Route | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [swapId, setSwapId] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [txSimulation, setTxSimulation] = useState<TransactionSimulation | null>(null);
  const [showRouteDetails, setShowRouteDetails] = useState(false);
  
  const [quoteTimestamp, setQuoteTimestamp] = useState<number>(0);
  const [quoteTimeRemaining, setQuoteTimeRemaining] = useState<string>('');
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null);

  const { data: nativeBalanceData } = useBalance({
    address,
    chainId: fromChainId,
    query: { enabled: !!address && isConnected },
  });

  const isNativeToken = fromToken?.address?.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
                        fromToken?.address?.toLowerCase() === '0x0000000000000000000000000000000000000000';
  
  const { data: tokenBalance } = useReadContract({
    address: fromToken?.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: fromChainId,
    query: { enabled: !!address && !!fromToken && !isNativeToken },
  });

  const spenderAddress = route?.steps?.[0]?.estimate?.approvalAddress as `0x${string}` | undefined;
  const { data: currentAllowance } = useReadContract({
    address: fromToken?.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && spenderAddress ? [address, spenderAddress] : undefined,
    chainId: fromChainId,
    query: { enabled: !!address && !!fromToken && !!spenderAddress && !isNativeToken },
  });

  useEffect(() => { setFromToken(null); }, [fromChainId]);
  useEffect(() => { setToToken(null); }, [toChainId]);

  useEffect(() => {
    setRoute(null);
    setState('idle');
    setError(null);
    setTxSimulation(null);
    setQuoteTimestamp(0);
    setPreflightResult(null);
    setShowRouteDetails(false);
  }, [fromChainId, toChainId, fromToken, toToken, fromAmount]);

  useEffect(() => {
    if (!quoteTimestamp || state !== 'quoted') {
      setQuoteTimeRemaining('');
      return;
    }
    const interval = setInterval(() => {
      const remaining = getQuoteTimeRemaining(quoteTimestamp, QUOTE_MAX_AGE);
      setQuoteTimeRemaining(remaining);
      if (isQuoteExpired(quoteTimestamp, QUOTE_MAX_AGE)) {
        setError('Quote expired. Please get a new quote.');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [quoteTimestamp, state]);

  useEffect(() => {
    if (!route || !address || !fromToken) {
      setPreflightResult(null);
      return;
    }
    const fromTokenBalance = isNativeToken 
      ? (nativeBalanceData?.value || 0n)
      : (tokenBalance || 0n);

    const result = validatePreflight({
      route,
      walletChainId: walletChainId || 0,
      walletAddress: address,
      fromTokenBalance,
      nativeBalance: nativeBalanceData?.value || 0n,
      currentAllowance: currentAllowance || 0n,
      quoteTimestamp,
      maxQuoteAgeSeconds: QUOTE_MAX_AGE,
    });
    setPreflightResult(result);
  }, [route, address, fromToken, walletChainId, nativeBalanceData, tokenBalance, currentAllowance, quoteTimestamp, isNativeToken]);

  const handleSwapChains = useCallback(() => {
    const tempChain = fromChainId;
    const tempToken = fromToken;
    setFromChainId(toChainId);
    setToChainId(tempChain);
    setFromToken(toToken);
    setToToken(tempToken);
  }, [fromChainId, toChainId, fromToken, toToken]);

  // Compute max amount
  const maxFromAmount = useMemo(() => {
    if (!fromToken) return '';
    const bal = isNativeToken ? nativeBalanceData?.value : tokenBalance;
    if (!bal) return '';
    return formatUnits(bal, fromToken.decimals);
  }, [fromToken, isNativeToken, nativeBalanceData, tokenBalance]);

  const hasValidInputs = fromToken && toToken && fromAmount && parseFloat(fromAmount) > 0;
  const isFromChainSupported = isChainSupported(fromChainId);
  const isToChainSupported = isChainSupported(toChainId);
  const isRouteChainSupported = route ? isChainSupported(route.fromChainId) : true;
  const isQuoteValid = route && quoteTimestamp && !isQuoteExpired(quoteTimestamp, QUOTE_MAX_AGE);

  const helperText = useMemo(() => {
    if (!isConnected) return 'Connect wallet to get a quote.';
    if (!hasValidInputs) return 'Select tokens and enter an amount.';
    if (state === 'quoting') return 'Finding best route...';
    if (route && preflightResult?.errors.length) return preflightResult.errors[0];
    if (route) return 'Review quote, then click Swap to execute.';
    return 'Click Get Quote to estimate output, fees, and route.';
  }, [isConnected, hasValidInputs, state, route, preflightResult]);

  const buttonLabel = useMemo(() => {
    if (!isConnected) return 'Connect Wallet';
    if (state === 'quoting') return 'Finding Route...';
    if (state === 'approving') return 'Approving...';
    if (state === 'swapping') return 'Confirm in Wallet...';
    if (route && !isQuoteValid) return 'Quote Expired - Refresh';
    if (route) return 'Swap';
    return 'Get Quote';
  }, [isConnected, state, route, isQuoteValid]);

  const handleQuote = async () => {
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
      setError('Please fill in all fields');
      return;
    }
    setState('quoting');
    setError(null);
    setPreflightResult(null);
    try {
      const fromAmountWei = parseUnits(fromAmount, fromToken.decimals).toString();
      const response = await getRoutes({
        fromChainId,
        toChainId,
        fromTokenAddress: fromToken.address,
        toTokenAddress: toToken.address,
        fromAmount: fromAmountWei,
        fromAddress: address,
        slippage: slippage / 100,
      });
      if (response.routes.length === 0) {
        throw new Error('No route found. Try a different token pair, smaller amount, or higher slippage.');
      }
      setRoute(response.routes[0]);
      setQuoteTimestamp(Date.now());
      setState('quoted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get quote');
      setState('idle');
    }
  };

  const handleExecute = async () => {
    if (!route || !address || !fromToken || !toToken) return;
    setState('swapping');
    setError(null);
    setTxSimulation(null);
    try {
      if (!isChainSupported(fromChainId)) {
        throw new TransactionValidationError(
          `Chain "${getChainName(fromChainId)}" (ID: ${fromChainId}) is not supported yet.`
        );
      }
      if (walletChainId !== fromChainId) {
        throw new TransactionValidationError(
          `Wrong network. Please switch to ${getChainName(fromChainId)} in your wallet before swapping.`
        );
      }
      const stepWithTx = await getStepTransaction(route.steps[0]);
      if (!stepWithTx.transactionRequest) {
        throw new TransactionValidationError('No transaction data received');
      }
      const tx = stepWithTx.transactionRequest;
      const simulation = getTransactionSimulation(tx, fromToken.address, fromToken.symbol);
      setTxSimulation(simulation);
      const normalizedTx = normalizeTxRequest(tx, fromToken.address);
      logTransactionDetails(fromChainId, normalizedTx, simulation);
      const hash = await sendTransactionAsync({
        to: normalizedTx.to,
        data: normalizedTx.data,
        value: normalizedTx.value,
        gas: normalizedTx.gas,
      });
      setTxHash(hash);
      const integratorFee = getIntegratorFee();
      const fromAmountUSD = parseFloat(route.fromAmountUSD) || 0;
      const swapRecord: SwapRecord = {
        id: `${Date.now()}-${hash.slice(0, 8)}`,
        timestamp: Date.now(),
        fromChainId,
        toChainId,
        fromToken: fromToken.symbol,
        toToken: toToken.symbol,
        fromAmount: fromAmount,
        toAmount: formatUnits(BigInt(route.toAmount), toToken.decimals),
        fromAmountUSD: route.fromAmountUSD,
        toAmountUSD: route.toAmountUSD,
        txHash: hash,
        status: 'pending',
        integratorFee: (parseFloat(fromAmount) * integratorFee).toFixed(6),
        integratorFeeUSD: (fromAmountUSD * integratorFee).toFixed(4),
      };
      saveSwap(swapRecord);
      setSwapId(swapRecord.id);
      setState('tracking');
    } catch (err) {
      if (err instanceof TransactionValidationError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Transaction failed');
      }
      setState('quoted');
    }
  };

  const handleReset = () => {
    setRoute(null);
    setTxHash(null);
    setSwapId(null);
    setFromAmount('');
    setState('idle');
    setError(null);
    setTxSimulation(null);
  };

  const isTestnet = fromChainId === 11155111 || toChainId === 11155111;

  if (state === 'tracking' && txHash && route && swapId) {
    return (
      <div className="w-full max-w-lg mx-auto space-y-4">
        <TransactionTracker txHash={txHash} route={route} swapId={swapId} onComplete={() => {}} />
        <Button onClick={handleReset} variant="outline" className="w-full">New Swap</Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-lg mx-auto"
    >
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Swap & Bridge
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                showDebug ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
              )}
              title="Debug panel"
            >
              <Bug className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                showSettings ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
              )}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Settings */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-muted/30 rounded-xl p-4 border border-border/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Slippage Tolerance</span>
                  <span className="text-sm font-semibold">{slippage}%</span>
                </div>
                <Slider value={[slippage]} onValueChange={([v]) => setSlippage(v)} min={0.1} max={5} step={0.1} className="mb-2" />
                <div className="flex gap-2">
                  {[0.1, 0.5, 1, 3].map((v) => (
                    <button
                      key={v}
                      onClick={() => setSlippage(v)}
                      className={cn(
                        "flex-1 py-1 rounded-lg text-xs font-medium transition-colors",
                        slippage === v ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Testnet warning */}
        {isTestnet && (
          <div className="bg-warning/10 text-warning text-xs p-3 rounded-lg flex items-center gap-2 border border-warning/20">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Testnet routes may be limited.</span>
          </div>
        )}

        {/* FROM section */}
        <div className="bg-muted/20 rounded-xl p-4 space-y-3 border border-border/30">
          <div className="grid grid-cols-2 gap-3">
            <ChainSelector selectedChainId={fromChainId} onSelect={(chain) => setFromChainId(chain.id)} label="From Chain" />
            <TokenSelector chainId={fromChainId} selectedToken={fromToken} onSelect={setFromToken} label="From Token" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">Amount</label>
              {maxFromAmount && (
                <button
                  onClick={() => setFromAmount(maxFromAmount)}
                  className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  MAX
                </button>
              )}
            </div>
            <input
              type="number"
              placeholder="0.00"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="w-full p-3 rounded-xl border border-border/30 bg-muted/10 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>
        </div>

        {/* Switch button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={handleSwapChains}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-lg ring-4 ring-card"
          >
            <ArrowUpDown className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>

        {/* TO section */}
        <div className="bg-muted/20 rounded-xl p-4 space-y-3 border border-border/30">
          <div className="grid grid-cols-2 gap-3">
            <ChainSelector selectedChainId={toChainId} onSelect={(chain) => setToChainId(chain.id)} label="To Chain" />
            <TokenSelector chainId={toChainId} selectedToken={toToken} onSelect={setToToken} label="To Token" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">You receive</label>
            <div className="w-full p-3 rounded-xl border border-border/30 bg-muted/10 text-2xl font-bold min-h-[52px] flex items-center">
              <AnimatePresence mode="wait">
                {state === 'quoting' ? (
                  <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-base font-medium">Finding best route…</span>
                  </motion.span>
                ) : route ? (
                  <motion.span key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-foreground">
                    {formatUnits(BigInt(route.toAmount), toToken?.decimals || 18).slice(0, 10)}
                  </motion.span>
                ) : (
                  <motion.span key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-muted-foreground/50 font-normal">
                    —
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Helper text */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-start gap-2 text-xs text-muted-foreground/80">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{helperText}</span>
          </div>
          <div className="flex items-center gap-2">
            {route && quoteTimeRemaining && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs gap-1",
                  quoteTimeRemaining === 'Expired' 
                    ? "bg-destructive/10 text-destructive border-destructive/30"
                    : "bg-success/10 text-success border-success/30"
                )}
              >
                <Clock className="w-3 h-3" />
                {quoteTimeRemaining}
              </Badge>
            )}
            <IntegratorFeeTooltip />
          </div>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg flex items-center gap-2 border border-destructive/20"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Route details accordion */}
        {route && (
          <div className="rounded-xl border border-border/30 overflow-hidden">
            <button
              onClick={() => setShowRouteDetails(!showRouteDetails)}
              className="w-full flex items-center justify-between p-3 text-sm hover:bg-muted/20 transition-colors"
            >
              <span className="text-muted-foreground font-medium">Route Details & Fees</span>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showRouteDetails && "rotate-180")} />
            </button>
            <AnimatePresence>
              {showRouteDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <FeeBreakdown route={route} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Debug panels */}
        {showDebug && <IntegratorDebugPanel route={route} fromChainId={fromChainId} toChainId={toChainId} />}
        {showDebug && txSimulation && (
          <SimulationSummary
            to={txSimulation.to}
            valueEth={txSimulation.valueEth}
            gasLimit={txSimulation.gasLimit}
            isNativeToken={txSimulation.isNativeToken}
            fromTokenSymbol={txSimulation.fromTokenSymbol}
            dataLength={txSimulation.dataLength}
          />
        )}

        {/* Action button */}
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
        ) : !isFromChainSupported || !isToChainSupported ? (
          <Button disabled className="w-full py-6 text-lg bg-destructive/20 text-destructive">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Chain Not Supported
          </Button>
        ) : state === 'quoting' || state === 'approving' || state === 'swapping' ? (
          <Button disabled className="w-full py-6 text-lg gradient-primary">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            {buttonLabel}
          </Button>
        ) : route && !isRouteChainSupported ? (
          <Button disabled className="w-full py-6 text-lg bg-destructive/20 text-destructive">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Route Chain Not Configured
          </Button>
        ) : route ? (
          <Button
            onClick={handleExecute}
            className="w-full py-6 text-lg gradient-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Swap
          </Button>
        ) : (
          <Button
            onClick={handleQuote}
            disabled={!hasValidInputs}
            className="w-full py-6 text-lg gradient-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Get Quote
          </Button>
        )}
      </div>
    </motion.div>
  );
}
