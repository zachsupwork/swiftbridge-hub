/**
 * Supply Drawer/Modal Component
 * Handles the supply flow with mandatory platform fee
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  AlertTriangle, 
  Loader2, 
  Check, 
  ExternalLink,
  Info,
  Wallet,
  ArrowRight,
} from 'lucide-react';
import { useAccount, useChainId, useSwitchChain, useReadContract, useWriteContract } from 'wagmi';
import { parseUnits, formatUnits, erc20Abi } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LendingMarket } from '@/hooks/useLendingMarkets';
import { getPoolAddress, getExplorerUrl } from '@/hooks/useLendingMarkets';
import { getAavePoolAddress, getExplorerTxUrl, SUPPORTED_CHAINS } from '@/lib/chainConfig';
import { FEE_WALLET, FEE_BPS, getFeePercentage, isPlatformFeeConfigured, calculateFeeAmounts } from '@/lib/env';
import { logEarnEvent } from '@/lib/earnLogger';
import { ERC20_ABI, AAVE_V3_POOL_ABI, AAVE_REFERRAL_CODE } from '@/lib/aaveV3';

interface EarnSupplyDrawerProps {
  market: LendingMarket | null;
  isOpen: boolean;
  onClose: () => void;
}

type SupplyStep = 'idle' | 'approving' | 'transferring_fee' | 'supplying' | 'complete' | 'error';

export function EarnSupplyDrawer({ market, isOpen, onClose }: EarnSupplyDrawerProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<SupplyStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHashes, setTxHashes] = useState<{ fee?: string; supply?: string }>({});

  const poolAddress = market ? getAavePoolAddress(market.chainId) : null;
  const isChainMatch = market ? chainId === market.chainId : false;
  const isFeeConfigured = isPlatformFeeConfigured();

  // Read token balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: market?.assetAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!market && !!address && isChainMatch,
    },
  });

  // Reset state when drawer closes or market changes
  useEffect(() => {
    if (!isOpen) {
      setAmount('');
      setStep('idle');
      setError(null);
      setTxHashes({});
    }
  }, [isOpen, market?.id]);

  // Calculate fee and supply amounts
  const { feeAmount, supplyAmount, feeDisplay, supplyDisplay } = useMemo(() => {
    if (!amount || !market || parseFloat(amount) <= 0) {
      return { feeAmount: 0n, supplyAmount: 0n, feeDisplay: '0', supplyDisplay: '0' };
    }
    try {
      const parsed = parseUnits(amount, market.decimals);
      const { feeAmount, supplyAmount } = calculateFeeAmounts(parsed);
      return {
        feeAmount,
        supplyAmount,
        feeDisplay: formatUnits(feeAmount, market.decimals),
        supplyDisplay: formatUnits(supplyAmount, market.decimals),
      };
    } catch {
      return { feeAmount: 0n, supplyAmount: 0n, feeDisplay: '0', supplyDisplay: '0' };
    }
  }, [amount, market]);

  const balanceFormatted = balance !== undefined && market 
    ? formatUnits(balance, market.decimals) 
    : '0';

  const handleMax = useCallback(() => {
    if (balance !== undefined && market) {
      setAmount(formatUnits(balance, market.decimals));
    }
  }, [balance, market]);

  const handleSupply = useCallback(async () => {
    if (!market || !address || !poolAddress || !amount || parseFloat(amount) <= 0) return;
    if (!isFeeConfigured) {
      setError('Platform fee not configured');
      return;
    }

    setStep('approving');
    setError(null);

    try {
      const totalAmount = parseUnits(amount, market.decimals);
      
      if (balance !== undefined && totalAmount > balance) {
        throw new Error('Insufficient balance');
      }

      const { feeAmount, supplyAmount } = calculateFeeAmounts(totalAmount);

      if (supplyAmount <= 0n) {
        throw new Error('Amount too small after fee');
      }

      // Step 1: Approve and transfer fee to FEE_WALLET
      setStep('transferring_fee');
      
      logEarnEvent({
        action: 'fee_tx_sent',
        chainId: market.chainId,
        assetSymbol: market.assetSymbol,
        assetAddress: market.assetAddress,
        walletAddress: address,
        feeAmount: feeAmount.toString(),
      });

      // Approve fee wallet for transfer
      await writeContractAsync({
        address: market.assetAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [FEE_WALLET, feeAmount],
      } as any);

      // Transfer fee
      const feeTxHash = await writeContractAsync({
        address: market.assetAddress,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [FEE_WALLET, feeAmount],
      } as any);

      setTxHashes(prev => ({ ...prev, fee: feeTxHash }));
      
      logEarnEvent({
        action: 'fee_tx_success',
        chainId: market.chainId,
        assetSymbol: market.assetSymbol,
        walletAddress: address,
        feeAmount: feeAmount.toString(),
        txHash: feeTxHash,
      });

      // Step 2: Approve Aave Pool
      setStep('supplying');

      // Approve pool
      await writeContractAsync({
        address: market.assetAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [poolAddress, supplyAmount],
      } as any);

      logEarnEvent({
        action: 'supply_tx_sent',
        chainId: market.chainId,
        assetSymbol: market.assetSymbol,
        assetAddress: market.assetAddress,
        walletAddress: address,
        amount: supplyAmount.toString(),
      });

      // Supply to Aave
      const supplyTxHash = await writeContractAsync({
        address: poolAddress,
        abi: AAVE_V3_POOL_ABI,
        functionName: 'supply',
        args: [market.assetAddress, supplyAmount, address, AAVE_REFERRAL_CODE],
      } as any);

      setTxHashes(prev => ({ ...prev, supply: supplyTxHash }));
      setStep('complete');

      logEarnEvent({
        action: 'supply_tx_success',
        chainId: market.chainId,
        assetSymbol: market.assetSymbol,
        assetAddress: market.assetAddress,
        walletAddress: address,
        amount: supplyAmount.toString(),
        txHash: supplyTxHash,
      });

      await refetchBalance();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transaction failed';
      
      if (errorMessage.includes('User rejected') || errorMessage.includes('User denied')) {
        setError('Transaction cancelled');
        logEarnEvent({
          action: 'user_cancelled',
          chainId: market.chainId,
          assetSymbol: market.assetSymbol,
          walletAddress: address,
        });
      } else {
        setError(errorMessage);
        logEarnEvent({
          action: 'error',
          chainId: market.chainId,
          assetSymbol: market.assetSymbol,
          walletAddress: address,
          error: errorMessage,
        });
      }
      setStep('error');
    }
  }, [market, address, poolAddress, amount, balance, isFeeConfigured, writeContractAsync, refetchBalance]);

  const handleReset = useCallback(() => {
    setAmount('');
    setStep('idle');
    setError(null);
    setTxHashes({});
  }, []);

  if (!market) return null;

  const formatAPY = (apy: number) => {
    if (apy < 0.01) return '<0.01%';
    if (apy > 100) return '>100%';
    return `${apy.toFixed(2)}%`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-card border-l border-border shadow-2xl overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border bg-card/95 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={market.assetLogo}
                    alt={market.assetSymbol}
                    className="w-10 h-10 rounded-full bg-muted"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
                    }}
                  />
                  <img
                    src={market.chainLogo}
                    alt={market.chainName}
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border border-card bg-card"
                  />
                </div>
                <div>
                  <div className="font-semibold">Supply {market.assetSymbol}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    {market.chainName}
                    <Badge variant="outline" className="text-[10px] px-1 h-4 border-primary/30 text-primary">
                      Aave V3
                    </Badge>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* APY Display */}
              <div className="glass rounded-xl p-4 text-center">
                <div className="text-sm text-muted-foreground mb-1">Supply APY</div>
                <div className="text-4xl font-bold text-gradient">
                  {formatAPY(market.supplyAPY)}
                </div>
                {market.isVariable && (
                  <div className="text-xs text-muted-foreground mt-1">Variable Rate</div>
                )}
              </div>

              {/* Not connected */}
              {!isConnected && (
                <div className="glass rounded-xl p-6 text-center">
                  <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">Connect your wallet to supply assets</p>
                </div>
              )}

              {/* Wrong chain */}
              {isConnected && !isChainMatch && (
                <div className="glass rounded-xl p-4 text-center">
                  <p className="text-muted-foreground mb-3">
                    Please switch to {market.chainName} to supply
                  </p>
                  <Button 
                    onClick={() => switchChain?.({ chainId: market.chainId })}
                    className="gap-2"
                  >
                    Switch to {market.chainName}
                  </Button>
                </div>
              )}

              {/* Chain not supported for supply */}
              {isConnected && isChainMatch && !poolAddress && (
                <div className="glass rounded-xl p-4 text-center">
                  <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-3" />
                  <p className="font-medium mb-2">Direct supply not available</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    In-app supply is not yet supported on {market.chainName}. 
                    You can supply directly on Aave.
                  </p>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      const url = new URL(market.protocolUrl);
                      url.searchParams.set('utm_source', 'cryptodefibridge');
                      window.open(url.toString(), '_blank');
                    }}
                  >
                    Open on Aave
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Supply form */}
              {isConnected && isChainMatch && poolAddress && step !== 'complete' && (
                <>
                  {/* Amount Input */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-muted-foreground">Amount</label>
                      <button
                        onClick={handleMax}
                        className="text-xs text-primary hover:text-primary/80 transition-colors"
                        disabled={step !== 'idle' && step !== 'error'}
                      >
                        Balance: {parseFloat(balanceFormatted).toFixed(4)} {market.assetSymbol}
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="0.0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={step !== 'idle' && step !== 'error'}
                        className="h-14 text-lg pr-24"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Badge variant="secondary">{market.assetSymbol}</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Fee Breakdown */}
                  {amount && parseFloat(amount) > 0 && (
                    <div className="glass rounded-xl p-4 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Info className="w-3.5 h-3.5" />
                          Platform Fee ({getFeePercentage()}%)
                        </span>
                        <span>{parseFloat(feeDisplay).toFixed(6)} {market.assetSymbol}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">You will supply</span>
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="font-medium text-primary">
                            {parseFloat(supplyDisplay).toFixed(6)} {market.assetSymbol}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-border/30">
                        <span className="text-muted-foreground">Destination</span>
                        <span>Aave V3 on {market.chainName}</span>
                      </div>
                    </div>
                  )}

                  {/* Transaction Status */}
                  {step !== 'idle' && step !== 'error' && (
                    <div className="glass rounded-xl p-4 space-y-3">
                      <TransactionStep 
                        label="Processing fee"
                        status={step === 'transferring_fee' ? 'pending' : txHashes.fee ? 'complete' : 'idle'}
                        txHash={txHashes.fee}
                        chainId={market.chainId}
                      />
                      <TransactionStep 
                        label="Supplying to Aave"
                        status={step === 'supplying' ? 'pending' : txHashes.supply ? 'complete' : 'idle'}
                        txHash={txHashes.supply}
                        chainId={market.chainId}
                      />
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  )}

                  {/* Supply Button */}
                  <Button
                    className="w-full h-12 text-base"
                    disabled={
                      !amount || 
                      parseFloat(amount) <= 0 || 
                      (step !== 'idle' && step !== 'error') ||
                      !isFeeConfigured
                    }
                    onClick={handleSupply}
                  >
                    {step === 'idle' || step === 'error' ? (
                      'Supply'
                    ) : step === 'approving' ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Approving...</>
                    ) : step === 'transferring_fee' ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing fee...</>
                    ) : (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Supplying...</>
                    )}
                  </Button>
                </>
              )}

              {/* Success state */}
              {step === 'complete' && (
                <div className="glass rounded-xl p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-success" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Supply Complete!</h3>
                  <p className="text-muted-foreground mb-4">
                    You have successfully supplied {parseFloat(supplyDisplay).toFixed(4)} {market.assetSymbol} to Aave V3.
                  </p>
                  
                  {txHashes.supply && (
                    <a
                      href={getExplorerUrl(market.chainId, txHashes.supply)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline mb-4"
                    >
                      View on Explorer
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={handleReset}>
                      Supply More
                    </Button>
                    <Button className="flex-1" onClick={onClose}>
                      Done
                    </Button>
                  </div>
                </div>
              )}

              {/* Risk Warning */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Supplying assets involves smart contract risk. APY is variable and not guaranteed. 
                  This app is non-custodial.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 p-4 border-t border-border bg-card/95 backdrop-blur">
              <p className="text-[10px] text-muted-foreground text-center">
                Powered by Aave V3. Platform fee ({getFeePercentage()}%) is mandatory and disclosed.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function TransactionStep({ 
  label, 
  status, 
  txHash,
  chainId,
}: { 
  label: string; 
  status: 'idle' | 'pending' | 'complete';
  txHash?: string;
  chainId: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {status === 'pending' && (
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        )}
        {status === 'complete' && (
          <Check className="w-4 h-4 text-success" />
        )}
        {status === 'idle' && (
          <span className="w-4 h-4 rounded-full border border-muted-foreground/30" />
        )}
        <span className={cn(
          "text-sm",
          status === 'complete' && "text-success",
          status === 'idle' && "text-muted-foreground"
        )}>
          {label}
        </span>
      </div>
      {txHash && (
        <a
          href={getExplorerUrl(chainId, txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          View <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}
