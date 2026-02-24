import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Bitcoin, Loader2, AlertTriangle, Wallet, RefreshCw, Info } from 'lucide-react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TokenSelector } from '@/components/swap/TokenSelector';
import { ChainSelector } from '@/components/swap/ChainSelector';
import { BtcManualDeposit } from './BtcManualDeposit';
import { BtcWalletConnect } from './BtcWalletConnect';
import { BtcStatusTracker } from './BtcStatusTracker';
import { cn } from '@/lib/utils';
import {
  createBtcRoute,
  btcToSats,
  BTC_CHAIN_ID,
  saveActiveBtcSwap,
  getActiveBtcSwaps,
  updateBtcSwapStatus,
  type BtcDepositInstructions,
  type ActiveBtcSwap,
} from '@/lib/lifiBtc';
import type { Token } from '@/lib/lifiClient';

interface BtcDepositFlowProps {
  onBack: () => void;
}

type FlowState = 'input' | 'quoting' | 'deposit' | 'tracking';

export function BtcDepositFlow({ onBack }: BtcDepositFlowProps) {
  const { address: evmAddress, isConnected: evmConnected } = useAccount();

  const [toChainId, setToChainId] = useState(8453); // Default Base
  const [toToken, setToToken] = useState<Token | null>(null);
  const [btcAmount, setBtcAmount] = useState('');
  const [flowState, setFlowState] = useState<FlowState>('input');
  const [instructions, setInstructions] = useState<BtcDepositInstructions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSwap, setActiveSwap] = useState<ActiveBtcSwap | null>(null);
  const [sendMode, setSendMode] = useState<'manual' | 'wallet'>('manual');
  const [expired, setExpired] = useState(false);

  // Check for resumable swaps
  useEffect(() => {
    const swaps = getActiveBtcSwaps();
    const pending = swaps.find(s => s.status !== 'completed' && s.status !== 'failed' && s.status !== 'expired');
    if (pending && pending.btcTxHash) {
      setActiveSwap(pending);
      setFlowState('tracking');
    }
  }, []);

  // Expiry timer
  useEffect(() => {
    if (!instructions?.expiresAt) return;
    const check = () => {
      if (Date.now() > (instructions.expiresAt || 0)) {
        setExpired(true);
      }
    };
    const interval = setInterval(check, 5000);
    check();
    return () => clearInterval(interval);
  }, [instructions?.expiresAt]);

  const handleGetQuote = useCallback(async () => {
    if (!evmAddress || !toToken || !btcAmount || parseFloat(btcAmount) <= 0) {
      setError('Please fill in all fields and connect your EVM wallet.');
      return;
    }

    setFlowState('quoting');
    setError(null);
    setExpired(false);

    try {
      const sats = btcToSats(btcAmount);
      if (sats === '0') throw new Error('Invalid BTC amount');

      const result = await createBtcRoute({
        fromAmount: sats,
        toChainId,
        toTokenAddress: toToken.address,
        toAddress: evmAddress,
        slippage: 0.03,
      });

      setInstructions(result);

      // Save as active swap
      const swap: ActiveBtcSwap = {
        id: `btc-${Date.now()}-${result.routeId.slice(0, 8)}`,
        depositInstructions: result,
        toChainId,
        toTokenSymbol: toToken.symbol,
        toAddress: evmAddress,
        createdAt: Date.now(),
        status: 'waiting',
      };
      saveActiveBtcSwap(swap);
      setActiveSwap(swap);
      setFlowState('deposit');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create BTC route');
      setFlowState('input');
    }
  }, [evmAddress, toToken, btcAmount, toChainId]);

  const handleConfirmSent = useCallback(() => {
    if (!activeSwap) return;
    // Without a txHash, we can't poll status yet — ask user to enter it or just wait
    // For manual flow, we start polling once user provides txHash
    setFlowState('tracking');
    updateBtcSwapStatus(activeSwap.id, { status: 'waiting' });
  }, [activeSwap]);

  const handleTxSent = useCallback((txHash: string) => {
    if (!activeSwap) return;
    const updated = { ...activeSwap, btcTxHash: txHash, status: 'deposited' as const };
    setActiveSwap(updated);
    updateBtcSwapStatus(activeSwap.id, { btcTxHash: txHash, status: 'deposited' });
    setFlowState('tracking');
  }, [activeSwap]);

  const handleReset = useCallback(() => {
    setFlowState('input');
    setInstructions(null);
    setActiveSwap(null);
    setError(null);
    setBtcAmount('');
    setToToken(null);
    setExpired(false);
  }, []);

  const handleRequote = useCallback(() => {
    setFlowState('input');
    setInstructions(null);
    setExpired(false);
  }, []);

  const hasValidInputs = evmConnected && toToken && btcAmount && parseFloat(btcAmount) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-lg mx-auto"
    >
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Bitcoin className="w-4 h-4 text-orange-500" />
            </div>
            <h2 className="text-lg font-bold">BTC → EVM Swap</h2>
          </div>
        </div>

        {/* Tracking state */}
        {flowState === 'tracking' && activeSwap && (
          <BtcStatusTracker
            swap={activeSwap}
            onComplete={() => {}}
            onReset={handleReset}
          />
        )}

        {/* Quoting state */}
        {flowState === 'quoting' && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin" />
            <p className="text-sm text-muted-foreground">Finding best BTC route…</p>
          </div>
        )}

        {/* Deposit state */}
        {flowState === 'deposit' && instructions && (
          <>
            {/* Route summary */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30 text-sm">
              <span className="text-muted-foreground">
                {instructions.amountBtc} BTC → {toToken?.symbol} on {toChainId === 8453 ? 'Base' : `Chain ${toChainId}`}
              </span>
              <span className="text-xs text-muted-foreground">via {instructions.tool}</span>
            </div>

            {/* Send mode tabs */}
            <Tabs value={sendMode} onValueChange={(v) => setSendMode(v as 'manual' | 'wallet')}>
              <TabsList className="w-full">
                <TabsTrigger value="manual" className="flex-1 text-xs">QR / Manual Send</TabsTrigger>
                <TabsTrigger value="wallet" className="flex-1 text-xs">Connect BTC Wallet</TabsTrigger>
              </TabsList>

              <TabsContent value="manual">
                <BtcManualDeposit
                  instructions={instructions}
                  onConfirmSent={handleConfirmSent}
                  onRequote={handleRequote}
                  expired={expired}
                />
              </TabsContent>

              <TabsContent value="wallet">
                <BtcWalletConnect
                  instructions={instructions}
                  onTxSent={handleTxSent}
                  onFallbackToManual={() => setSendMode('manual')}
                />
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Input state */}
        {flowState === 'input' && (
          <>
            {/* From: BTC */}
            <div className="bg-muted/20 rounded-xl p-4 space-y-3 border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                  <Bitcoin className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold">From: Bitcoin (BTC)</span>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">BTC Amount</label>
                <input
                  type="number"
                  placeholder="0.001"
                  step="0.0001"
                  min="0"
                  value={btcAmount}
                  onChange={(e) => setBtcAmount(e.target.value)}
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

            {/* To: EVM */}
            <div className="bg-muted/20 rounded-xl p-4 space-y-3 border border-border/30">
              <div className="grid grid-cols-2 gap-3">
                <ChainSelector
                  selectedChainId={toChainId}
                  onSelect={(chain) => {
                    setToChainId(chain.id);
                    setToToken(null);
                  }}
                  label="To Chain"
                />
                <TokenSelector
                  chainId={toChainId}
                  selectedToken={toToken}
                  onSelect={setToToken}
                  label="To Token"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">You receive (estimated)</label>
                <div className="w-full p-3 rounded-xl border border-border/30 bg-muted/10 text-2xl font-bold min-h-[52px] flex items-center text-muted-foreground/50 text-sm font-normal">
                  Quote after clicking below
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground/80 px-1">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                You'll receive a unique BTC deposit address. Send BTC there and receive tokens on the selected chain.
                Routes powered by LI.FI (ThorChain).
              </span>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Action button */}
            {!evmConnected ? (
              <ConnectButton.Custom>
                {({ openConnectModal, mounted }) => (
                  <Button
                    onClick={() => mounted && openConnectModal()}
                    className="w-full py-6 text-lg gap-2 gradient-primary text-primary-foreground hover:opacity-90"
                  >
                    <Wallet className="w-5 h-5" />
                    Connect EVM Wallet (Recipient)
                  </Button>
                )}
              </ConnectButton.Custom>
            ) : (
              <Button
                onClick={handleGetQuote}
                disabled={!hasValidInputs}
                className="w-full py-6 text-lg gradient-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Get BTC Quote
              </Button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
