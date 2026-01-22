/**
 * Borrow Modal Component
 * Handles the borrow flow with health factor projection
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Loader2, Check, ExternalLink, Info, Wallet, TrendingDown } from 'lucide-react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { getExplorerTxUrl } from '@/lib/chainConfig';
import type { BorrowMarket, UserAccountData, BorrowStep } from '@/hooks/useAaveBorrow';

interface BorrowModalProps {
  market: BorrowMarket | null;
  accountData: UserAccountData | null;
  isOpen: boolean;
  onClose: () => void;
  borrowStep: BorrowStep;
  borrowError: string | null;
  onBorrow: (market: BorrowMarket, amount: string, rateMode: 'variable' | 'stable') => Promise<void>;
  onReset: () => void;
}

export function BorrowModal({
  market,
  accountData,
  isOpen,
  onClose,
  borrowStep,
  borrowError,
  onBorrow,
  onReset,
}: BorrowModalProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [amount, setAmount] = useState('');
  const [rateMode, setRateMode] = useState<'variable' | 'stable'>('variable');

  const isChainMatch = market ? chainId === market.chainId : false;

  // Reset state when modal closes or market changes
  useEffect(() => {
    if (!isOpen) {
      setAmount('');
      setRateMode('variable');
      onReset();
    }
  }, [isOpen, market?.id, onReset]);

  // Calculate projected values
  const projections = useMemo(() => {
    if (!amount || !market || !accountData || parseFloat(amount) <= 0) {
      return null;
    }

    try {
      const borrowAmountUsd = parseFloat(amount) * market.priceInUsd;
      const newTotalDebtUsd = accountData.totalDebtUsd + borrowAmountUsd;
      
      // Calculate new health factor
      // HF = (totalCollateral * liquidationThreshold) / totalDebt
      const liquidationThreshold = Number(accountData.currentLiquidationThreshold) / 10000;
      const newHealthFactor = newTotalDebtUsd > 0 
        ? (accountData.totalCollateralUsd * liquidationThreshold) / newTotalDebtUsd
        : Infinity;

      // Calculate new borrow limit used
      const maxBorrow = accountData.totalCollateralUsd * (Number(accountData.ltv) / 10000);
      const newBorrowLimitUsed = maxBorrow > 0 ? (newTotalDebtUsd / maxBorrow) * 100 : 0;

      return {
        borrowAmountUsd,
        newTotalDebtUsd,
        newHealthFactor,
        newBorrowLimitUsed,
        isHealthFactorCritical: newHealthFactor < 1.0,
        isHealthFactorWarning: newHealthFactor >= 1.0 && newHealthFactor < 1.1,
      };
    } catch {
      return null;
    }
  }, [amount, market, accountData]);

  // Max borrow amount
  const maxBorrowAmount = useMemo(() => {
    if (!accountData || !market) return '0';
    
    // Use available borrows or liquidity, whichever is lower
    const maxUsd = Math.min(accountData.availableBorrowsUsd, market.availableLiquidityUsd);
    const maxTokens = maxUsd / market.priceInUsd;
    
    // Leave some buffer for safety (95% of max)
    return (maxTokens * 0.95).toFixed(market.decimals > 6 ? 6 : market.decimals);
  }, [accountData, market]);

  const handleMax = useCallback(() => {
    setAmount(maxBorrowAmount);
  }, [maxBorrowAmount]);

  const handleBorrow = useCallback(async () => {
    if (!market || !amount || parseFloat(amount) <= 0) return;
    await onBorrow(market, amount, rateMode);
  }, [market, amount, rateMode, onBorrow]);

  // Format APY
  const formatAPY = (apy: number) => {
    if (apy < 0.01) return '<0.01%';
    if (apy > 100) return '>100%';
    return `${apy.toFixed(2)}%`;
  };

  // Format health factor
  const formatHealthFactor = (hf: number) => {
    if (!isFinite(hf) || hf > 100) return '∞';
    return hf.toFixed(2);
  };

  const getHealthFactorColor = (hf: number) => {
    if (!isFinite(hf) || hf >= 2) return 'text-success';
    if (hf >= 1.5) return 'text-yellow-500';
    if (hf >= 1.1) return 'text-warning';
    return 'text-destructive';
  };

  if (!market) return null;

  const canBorrow = 
    amount && 
    parseFloat(amount) > 0 && 
    projections && 
    !projections.isHealthFactorCritical &&
    (borrowStep === 'idle' || borrowStep === 'error');

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
                  <div className="relative">
                    <img
                      src={market.assetLogo}
                      alt={market.assetSymbol}
                      className="w-10 h-10 rounded-full bg-muted"
                    />
                    <img
                      src={market.chainLogo}
                      alt={market.chainName}
                      className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border border-card bg-card"
                    />
                  </div>
                  <div>
                    <div className="font-semibold">Borrow {market.assetSymbol}</div>
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
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Not connected */}
                {!isConnected && (
                  <div className="glass rounded-xl p-6 text-center">
                    <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Connect your wallet to borrow</p>
                  </div>
                )}

                {/* Wrong chain */}
                {isConnected && !isChainMatch && (
                  <div className="glass rounded-xl p-4 text-center">
                    <p className="text-muted-foreground mb-3">
                      Please switch to {market.chainName} to borrow
                    </p>
                    <Button 
                      onClick={() => switchChain?.({ chainId: market.chainId })}
                      className="gap-2"
                    >
                      Switch to {market.chainName}
                    </Button>
                  </div>
                )}

                {/* No collateral */}
                {isConnected && isChainMatch && (!accountData || accountData.totalCollateralUsd === 0) && (
                  <div className="glass rounded-xl p-4 text-center">
                    <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-3" />
                    <p className="font-medium mb-1">No Collateral</p>
                    <p className="text-sm text-muted-foreground">
                      You need to supply assets as collateral before you can borrow.
                    </p>
                  </div>
                )}

                {/* Borrow form */}
                {isConnected && isChainMatch && accountData && accountData.totalCollateralUsd > 0 && borrowStep !== 'complete' && (
                  <>
                    {/* Rate Mode Selection */}
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">Interest Rate</label>
                      <RadioGroup
                        value={rateMode}
                        onValueChange={(v) => setRateMode(v as 'variable' | 'stable')}
                        className="grid grid-cols-2 gap-3"
                      >
                        <div className={cn(
                          'flex items-center space-x-2 rounded-lg border p-3 cursor-pointer transition-colors',
                          rateMode === 'variable' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                        )}>
                          <RadioGroupItem value="variable" id="variable" />
                          <Label htmlFor="variable" className="cursor-pointer flex-1">
                            <div className="font-medium">Variable</div>
                            <div className="text-xs text-warning">{formatAPY(market.variableBorrowAPY)} APY</div>
                          </Label>
                        </div>
                        <div className={cn(
                          'flex items-center space-x-2 rounded-lg border p-3 transition-colors',
                          !market.stableBorrowEnabled && 'opacity-50',
                          rateMode === 'stable' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                          market.stableBorrowEnabled ? 'cursor-pointer' : 'cursor-not-allowed'
                        )}>
                          <RadioGroupItem value="stable" id="stable" disabled={!market.stableBorrowEnabled} />
                          <Label htmlFor="stable" className={cn('flex-1', market.stableBorrowEnabled && 'cursor-pointer')}>
                            <div className="font-medium">Stable</div>
                            <div className="text-xs text-warning">
                              {market.stableBorrowEnabled ? formatAPY(market.stableBorrowAPY) + ' APY' : 'Not available'}
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-muted-foreground">Amount to Borrow</label>
                        <button
                          onClick={handleMax}
                          className="text-xs text-primary hover:text-primary/80 transition-colors"
                          disabled={borrowStep !== 'idle' && borrowStep !== 'error'}
                        >
                          Max: {parseFloat(maxBorrowAmount).toFixed(4)} {market.assetSymbol}
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder="0.0"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          disabled={borrowStep !== 'idle' && borrowStep !== 'error'}
                          className="h-14 text-lg pr-24"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Badge variant="secondary">{market.assetSymbol}</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Projections */}
                    {projections && (
                      <div className="glass rounded-xl p-4 space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Borrow Amount</span>
                          <span className="font-medium">
                            ~${projections.borrowAmountUsd.toFixed(2)}
                          </span>
                        </div>
                        
                        {/* Health Factor Projection */}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Info className="w-3.5 h-3.5" />
                            Health Factor After
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={getHealthFactorColor(accountData.healthFactorFormatted)}>
                              {formatHealthFactor(accountData.healthFactorFormatted)}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className={cn(
                              'font-medium',
                              getHealthFactorColor(projections.newHealthFactor)
                            )}>
                              {formatHealthFactor(projections.newHealthFactor)}
                            </span>
                          </div>
                        </div>

                        {/* Borrow Limit Projection */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Borrow Limit Used</span>
                            <span>
                              {accountData.borrowLimitUsedPercent.toFixed(1)}% → {' '}
                              <span className="font-medium">{projections.newBorrowLimitUsed.toFixed(1)}%</span>
                            </span>
                          </div>
                          <Progress 
                            value={Math.min(projections.newBorrowLimitUsed, 100)} 
                            className="h-1.5"
                          />
                        </div>

                        {/* Warnings */}
                        {projections.isHealthFactorCritical && (
                          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-destructive">
                              <span className="font-medium">Cannot borrow:</span> This would put your health factor below 1.0, 
                              risking immediate liquidation.
                            </div>
                          </div>
                        )}

                        {projections.isHealthFactorWarning && (
                          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-warning">
                              <span className="font-medium">Warning:</span> Your health factor will be very low. 
                              Consider borrowing less to avoid liquidation risk.
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Error */}
                    {borrowError && (
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <p className="text-sm text-destructive">{borrowError}</p>
                      </div>
                    )}

                    {/* Borrow Button */}
                    <Button
                      className="w-full h-12 text-base"
                      disabled={!canBorrow}
                      onClick={handleBorrow}
                    >
                      {borrowStep === 'idle' || borrowStep === 'error' ? (
                        <>
                          <TrendingDown className="w-4 h-4 mr-2" />
                          Borrow {market.assetSymbol}
                        </>
                      ) : (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Borrowing...
                        </>
                      )}
                    </Button>
                  </>
                )}

                {/* Success State */}
                {borrowStep === 'complete' && (
                  <div className="glass rounded-xl p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                      <Check className="w-6 h-6 text-success" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Borrow Successful!</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      You have successfully borrowed {amount} {market.assetSymbol}
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
