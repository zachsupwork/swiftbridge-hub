import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, Settings, Loader2, AlertTriangle, Zap } from 'lucide-react';
import { useAccount, useSendTransaction, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { TokenSelector } from './TokenSelector';
import { ChainSelector } from './ChainSelector';
import { FeeBreakdown } from './FeeBreakdown';
import { TransactionTracker } from './TransactionTracker';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Token, Chain, Route, getRoutes, getIntegratorFee, getStepTransaction } from '@/lib/lifiClient';
import { saveSwap, SwapRecord } from '@/lib/swapStorage';
import { cn } from '@/lib/utils';

type SwapState = 'idle' | 'quoting' | 'quoted' | 'approving' | 'swapping' | 'tracking';

export function SwapCard() {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();

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

  // Clear tokens when chain changes
  useEffect(() => {
    setFromToken(null);
  }, [fromChainId]);

  useEffect(() => {
    setToToken(null);
  }, [toChainId]);

  // Clear route when inputs change
  useEffect(() => {
    setRoute(null);
    setState('idle');
    setError(null);
  }, [fromChainId, toChainId, fromToken, toToken, fromAmount]);

  const handleSwapChains = useCallback(() => {
    const tempChain = fromChainId;
    const tempToken = fromToken;
    setFromChainId(toChainId);
    setToChainId(tempChain);
    setFromToken(toToken);
    setToToken(tempToken);
  }, [fromChainId, toChainId, fromToken, toToken]);

  const handleQuote = async () => {
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
      setError('Please fill in all fields');
      return;
    }

    setState('quoting');
    setError(null);

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
        throw new Error('No route found');
      }

      setRoute(response.routes[0]);
      setState('quoted');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get quote';
      setError(errorMessage);
      setState('idle');
    }
  };

  const handleExecute = async () => {
    if (!route || !address || !fromToken || !toToken) return;

    setState('swapping');
    setError(null);

    try {
      // Switch chain if needed
      if (walletChainId !== fromChainId) {
        await switchChainAsync({ chainId: fromChainId });
      }

      // Get transaction data for the first step
      const stepWithTx = await getStepTransaction(route.steps[0]);
      
      if (!stepWithTx.transactionRequest) {
        throw new Error('No transaction data received');
      }

      const tx = stepWithTx.transactionRequest;

      // Send transaction
      const hash = await sendTransactionAsync({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: BigInt(tx.value || '0'),
      });

      setTxHash(hash);

      // Save swap record
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
      console.error('Swap failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Transaction failed';
      setError(errorMessage);
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
  };

  const isTestnet = fromChainId === 11155111 || toChainId === 11155111;

  if (state === 'tracking' && txHash && route && swapId) {
    return (
      <div className="w-full max-w-md mx-auto space-y-4">
        <TransactionTracker
          txHash={txHash}
          route={route}
          swapId={swapId}
          onComplete={() => {}}
        />
        <Button
          onClick={handleReset}
          variant="outline"
          className="w-full"
        >
          New Swap
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="glass rounded-2xl p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Swap
          </h2>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              showSettings ? "bg-primary/10 text-primary" : "hover:bg-muted"
            )}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Settings */}
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-muted/50 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Slippage Tolerance</span>
              <span className="text-sm font-medium">{slippage}%</span>
            </div>
            <Slider
              value={[slippage]}
              onValueChange={([v]) => setSlippage(v)}
              min={0.1}
              max={5}
              step={0.1}
              className="mb-2"
            />
            <div className="flex gap-2">
              {[0.1, 0.5, 1, 3].map((v) => (
                <button
                  key={v}
                  onClick={() => setSlippage(v)}
                  className={cn(
                    "flex-1 py-1 rounded text-xs font-medium transition-colors",
                    slippage === v ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {v}%
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Testnet warning */}
        {isTestnet && (
          <div className="bg-warning/10 text-warning text-xs p-3 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Testnet routes may be limited. Some swaps might not be available.</span>
          </div>
        )}

        {/* From section */}
        <div className="bg-muted/30 rounded-xl p-4 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <ChainSelector
                selectedChainId={fromChainId}
                onSelect={(chain) => setFromChainId(chain.id)}
                label="From Chain"
              />
            </div>
            <div className="flex-1">
              <TokenSelector
                chainId={fromChainId}
                selectedToken={fromToken}
                onSelect={setFromToken}
                label="From Token"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
            <input
              type="number"
              placeholder="0.00"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="w-full p-3 rounded-xl glass text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-transparent"
            />
          </div>
        </div>

        {/* Swap button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={handleSwapChains}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:scale-110 transition-transform shadow-lg glow"
          >
            <ArrowDown className="w-5 h-5 text-primary-foreground" />
          </button>
        </div>

        {/* To section */}
        <div className="bg-muted/30 rounded-xl p-4 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <ChainSelector
                selectedChainId={toChainId}
                onSelect={(chain) => setToChainId(chain.id)}
                label="To Chain"
                excludeChainId={fromChainId === toChainId ? undefined : undefined}
              />
            </div>
            <div className="flex-1">
              <TokenSelector
                chainId={toChainId}
                selectedToken={toToken}
                onSelect={setToToken}
                label="To Token"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">You receive</label>
            <div className="w-full p-3 rounded-xl glass text-2xl font-bold text-muted-foreground">
              {route
                ? formatUnits(BigInt(route.toAmount), toToken?.decimals || 18).slice(0, 10)
                : '0.00'}
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Fee breakdown */}
        {route && <FeeBreakdown route={route} />}

        {/* Action buttons */}
        {!isConnected ? (
          <Button disabled className="w-full py-6 text-lg">
            Connect Wallet to Swap
          </Button>
        ) : state === 'quoting' || state === 'approving' || state === 'swapping' ? (
          <Button disabled className="w-full py-6 text-lg gradient-primary">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            {state === 'quoting' ? 'Finding best route...' : state === 'approving' ? 'Approving...' : 'Confirm in wallet...'}
          </Button>
        ) : route ? (
          <Button
            onClick={handleExecute}
            className="w-full py-6 text-lg gradient-primary text-primary-foreground hover:opacity-90"
          >
            Execute Swap
          </Button>
        ) : (
          <Button
            onClick={handleQuote}
            disabled={!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0}
            className="w-full py-6 text-lg gradient-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Get Quote
          </Button>
        )}
      </div>
    </motion.div>
  );
}
