/**
 * Repay Modal Component
 * Handles the repay flow for borrow positions
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Loader2, Check, Wallet } from 'lucide-react';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { parseUnits, formatUnits, erc20Abi } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { UserBorrowPosition, BorrowStep } from '@/hooks/useAaveBorrow';

interface RepayModalProps {
  position: UserBorrowPosition | null;
  isOpen: boolean;
  onClose: () => void;
  repayStep: BorrowStep;
  repayError: string | null;
  onRepay: (position: UserBorrowPosition, amount: string) => Promise<void>;
  onReset: () => void;
}

export function RepayModal({
  position,
  isOpen,
  onClose,
  repayStep,
  repayError,
  onRepay,
  onReset,
}: RepayModalProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  

  const [amount, setAmount] = useState('');

  const isChainMatch = position ? chainId === position.chainId : false;

  // Read wallet balance
  const { data: balance } = useReadContract({
    address: position?.assetAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!position && !!address && isChainMatch,
    },
  });

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAmount('');
      onReset();
    }
  }, [isOpen, position?.assetAddress, onReset]);

  // Calculate values
  const { balanceFormatted, debtFormatted, maxRepay } = useMemo(() => {
    if (!position) {
      return { balanceFormatted: '0', debtFormatted: '0', maxRepay: '0' };
    }

    const debt = position.rateMode === 'variable' 
      ? position.variableDebtFormatted 
      : position.stableDebtFormatted;

    const balFmt = balance ? formatUnits(balance, position.decimals) : '0';
    
    // Max repay is the minimum of balance and debt
    const maxRepayVal = Math.min(parseFloat(balFmt), parseFloat(debt));

    return {
      balanceFormatted: balFmt,
      debtFormatted: debt,
      maxRepay: maxRepayVal.toString(),
    };
  }, [position, balance]);

  const handleMax = useCallback(() => {
    setAmount(maxRepay);
  }, [maxRepay]);

  const handleRepay = useCallback(async () => {
    if (!position || !amount || parseFloat(amount) <= 0) return;
    await onRepay(position, amount);
  }, [position, amount, onRepay]);

  if (!position) return null;

  const canRepay = 
    amount && 
    parseFloat(amount) > 0 &&
    parseFloat(amount) <= parseFloat(maxRepay) &&
    (repayStep === 'idle' || repayStep === 'error');

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

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <img
                    src={position.assetLogo}
                    alt={position.assetSymbol}
                    className="w-10 h-10 rounded-full bg-muted"
                  />
                  <div>
                    <div className="font-semibold">Repay {position.assetSymbol}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      {position.chainName}
                      <Badge variant="outline" className="text-[10px] px-1 h-4">
                        {position.rateMode === 'variable' ? 'Variable' : 'Stable'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Not connected */}
                {!isConnected && (
                  <div className="glass rounded-xl p-6 text-center">
                    <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Connect your wallet to repay</p>
                  </div>
                )}

                {/* Wrong chain */}
                {isConnected && !isChainMatch && (
                  <div className="glass rounded-xl p-4 text-center">
                    <p className="text-muted-foreground mb-3">
                      Please switch to {position.chainName} in your wallet to repay.
                    </p>
                  </div>
                )}

                {/* Repay form */}
                {isConnected && isChainMatch && repayStep !== 'complete' && (
                  <>
                    {/* Debt Info */}
                    <div className="glass rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Current Debt</span>
                        <span className="text-warning font-medium">
                          {parseFloat(debtFormatted).toFixed(6)} {position.assetSymbol}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Your Balance</span>
                        <span>
                          {parseFloat(balanceFormatted).toFixed(6)} {position.assetSymbol}
                        </span>
                      </div>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-muted-foreground">Amount to Repay</label>
                        <button
                          onClick={handleMax}
                          className="text-xs text-primary hover:text-primary/80 transition-colors"
                          disabled={repayStep !== 'idle' && repayStep !== 'error'}
                        >
                          Max: {parseFloat(maxRepay).toFixed(4)} {position.assetSymbol}
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder="0.0"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          disabled={repayStep !== 'idle' && repayStep !== 'error'}
                          className="h-14 text-lg pr-24"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Badge variant="secondary">{position.assetSymbol}</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Insufficient balance warning */}
                    {amount && parseFloat(amount) > parseFloat(balanceFormatted) && (
                      <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-warning">
                          Insufficient balance. You need more {position.assetSymbol} to repay this amount.
                        </p>
                      </div>
                    )}

                    {/* Error */}
                    {repayError && (
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <p className="text-sm text-destructive">{repayError}</p>
                      </div>
                    )}

                    {/* Repay Button */}
                    <Button
                      className="w-full h-12 text-base"
                      disabled={!canRepay}
                      onClick={handleRepay}
                    >
                      {repayStep === 'idle' || repayStep === 'error' ? (
                        'Repay'
                      ) : repayStep === 'approving' ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Repaying...
                        </>
                      )}
                    </Button>
                  </>
                )}

                {/* Success State */}
                {repayStep === 'complete' && (
                  <div className="glass rounded-xl p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                      <Check className="w-6 h-6 text-success" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Repay Successful!</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      You have successfully repaid {amount} {position.assetSymbol}
                    </p>
                    <Button onClick={onClose} className="w-full">
                      Close
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
