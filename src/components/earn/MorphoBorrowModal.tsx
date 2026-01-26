/**
 * Morpho Borrow Modal
 * 
 * Detailed modal for borrowing the LOAN TOKEN from a Morpho Blue market.
 * Shows collateral requirements, max borrow, health factor, and liquidation risk.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  Loader2, 
  Check, 
  Wallet,
  Info,
  ExternalLink,
  HelpCircle,
  Shield,
  AlertCircle,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { 
  useAccount, 
  useChainId, 
  useSwitchChain, 
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from 'wagmi';
import { parseUnits, formatUnits, erc20Abi, type Hash } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { 
  MORPHO_BLUE_ABI, 
  MORPHO_BLUE_ADDRESS,
  marketToParams,
  type ActionStep,
  getStepDescription,
} from '@/lib/morpho/blueActions';
import { getMorphoChainConfig } from '@/lib/morpho/config';
import type { MorphoMarket } from '@/lib/morpho/types';
import { toast } from '@/hooks/use-toast';
import { CHAIN_EXPLORERS } from '@/lib/wagmiConfig';
import { TokenIcon } from '@/components/common/TokenIcon';
import { ChainIcon } from '@/components/common/ChainIcon';

interface MorphoBorrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: MorphoMarket | null;
  existingCollateral?: bigint;
  existingCollateralUsd?: number;
  existingBorrow?: bigint;
  existingBorrowUsd?: number;
  onSupplyCollateral?: () => void;
  onSuccess?: () => void;
}

export function MorphoBorrowModal({
  isOpen,
  onClose,
  market,
  existingCollateral = 0n,
  existingCollateralUsd = 0,
  existingBorrow = 0n,
  existingBorrowUsd = 0,
  onSupplyCollateral,
  onSuccess,
}: MorphoBorrowModalProps) {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<ActionStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [actionTxHash, setActionTxHash] = useState<Hash | undefined>();
  const [showExplanation, setShowExplanation] = useState(true);

  const loanToken = market?.loanAsset;
  const collateralToken = market?.collateralAsset;
  const loanDecimals = loanToken?.decimals || 18;
  const chainConfig = market ? getMorphoChainConfig(market.chainId) : null;

  // Wait for transaction
  const { isSuccess: isActionConfirmed } = useWaitForTransactionReceipt({
    hash: actionTxHash,
  });

  // Parse amount
  const parsedAmount = useMemo(() => {
    try {
      return parseUnits(amount || '0', loanDecimals);
    } catch {
      return 0n;
    }
  }, [amount, loanDecimals]);

  // Calculate max borrow based on collateral and LLTV
  const maxBorrowUsd = useMemo(() => {
    if (existingCollateralUsd <= 0 || !market) return 0;
    return existingCollateralUsd * (market.lltv / 100);
  }, [existingCollateralUsd, market]);

  const availableToBorrowUsd = useMemo(() => {
    return Math.max(0, maxBorrowUsd - existingBorrowUsd);
  }, [maxBorrowUsd, existingBorrowUsd]);

  // Calculate health factor after borrow
  const projectedBorrowUsd = useMemo(() => {
    // Simple estimate: assume 1:1 USD value for amount (in production, use oracle price)
    const amountFloat = parseFloat(amount || '0');
    return existingBorrowUsd + amountFloat;
  }, [amount, existingBorrowUsd]);

  const projectedHealthFactor = useMemo(() => {
    if (projectedBorrowUsd <= 0) return null;
    if (maxBorrowUsd <= 0) return 0;
    return maxBorrowUsd / projectedBorrowUsd;
  }, [maxBorrowUsd, projectedBorrowUsd]);

  const currentHealthFactor = useMemo(() => {
    if (existingBorrowUsd <= 0) return null;
    if (maxBorrowUsd <= 0) return 0;
    return maxBorrowUsd / existingBorrowUsd;
  }, [maxBorrowUsd, existingBorrowUsd]);

  const borrowLimitUsed = useMemo(() => {
    if (maxBorrowUsd <= 0) return 0;
    return (projectedBorrowUsd / maxBorrowUsd) * 100;
  }, [projectedBorrowUsd, maxBorrowUsd]);

  // Risk level
  const riskLevel = useMemo(() => {
    if (projectedHealthFactor === null) return 'safe';
    if (projectedHealthFactor > 1.5) return 'safe';
    if (projectedHealthFactor > 1.1) return 'moderate';
    if (projectedHealthFactor > 1) return 'risky';
    return 'liquidation';
  }, [projectedHealthFactor]);

  // Reset state
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setStep('idle');
      setError(null);
      setActionTxHash(undefined);
    }
  }, [isOpen]);

  const isWrongChain = market && walletChainId !== market.chainId;
  const hasCollateral = existingCollateralUsd > 0;

  // Handle chain switch
  const handleSwitchChain = useCallback(async () => {
    if (!market) return;
    try {
      await switchChain({ chainId: market.chainId });
    } catch (err) {
      console.error('Failed to switch chain:', err);
    }
  }, [market, switchChain]);

  // Set percentage of available borrow
  const handleSetPercentage = useCallback((percent: number) => {
    if (availableToBorrowUsd <= 0) return;
    const borrowAmount = (availableToBorrowUsd * percent) / 100;
    setAmount(borrowAmount.toFixed(4));
  }, [availableToBorrowUsd]);

  // Execute borrow
  const executeBorrow = useCallback(async () => {
    if (!market || !address || parsedAmount === 0n) return;

    try {
      setError(null);
      const marketParams = marketToParams(market);

      setStep('action');
      const txHash = await writeContractAsync({
        address: MORPHO_BLUE_ADDRESS,
        abi: MORPHO_BLUE_ABI,
        functionName: 'borrow',
        args: [marketParams, parsedAmount, 0n, address, address],
      } as any);

      setActionTxHash(txHash);
      setStep('action_pending');

    } catch (err: unknown) {
      console.error('Borrow failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Transaction failed';
      setError(errorMessage);
      setStep('error');
    }
  }, [market, address, parsedAmount, writeContractAsync]);

  // Handle confirmations
  useEffect(() => {
    if (isActionConfirmed && step === 'action_pending') {
      setStep('success');
      toast({
        title: 'Borrow Successful',
        description: `You borrowed ${amount} ${loanToken?.symbol}.`,
      });
      onSuccess?.();
    }
  }, [isActionConfirmed, step, amount, loanToken?.symbol, onSuccess]);

  const isLoading = step !== 'idle' && step !== 'success' && step !== 'error';
  const canExecute = parsedAmount > 0n && !isLoading && !isWrongChain && isConnected && hasCollateral && riskLevel !== 'liquidation';

  // Format helpers
  const formatAPY = (apy: number) => {
    if (!Number.isFinite(apy) || apy === 0) return '—';
    const normalized = apy <= 1.5 ? apy * 100 : apy;
    return `${normalized.toFixed(2)}%`;
  };

  const formatUsd = (value: number) => {
    if (!Number.isFinite(value) || value === 0) return '$0';
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  if (!market || !loanToken) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 overflow-hidden">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6 space-y-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                Borrow {loanToken.symbol}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 flex-wrap">
                <ChainIcon chainId={market.chainId} size="sm" />
                <span>{chainConfig?.label}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-warning font-medium">{formatAPY(market.borrowApy)} APR</span>
              </DialogDescription>
            </DialogHeader>

            {/* Wrong chain warning */}
            {isWrongChain && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-warning">Wrong Network</p>
                  <p className="text-muted-foreground text-xs">Switch to {chainConfig?.label}</p>
                </div>
                <Button size="sm" variant="outline" onClick={handleSwitchChain} disabled={isSwitching}>
                  {isSwitching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Switch'}
                </Button>
              </div>
            )}

            {/* No Collateral Warning */}
            {!hasCollateral && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Collateral Required</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You must supply <strong>{collateralToken?.symbol || 'collateral'}</strong> before you can borrow {loanToken.symbol}.
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={() => {
                    onClose();
                    onSupplyCollateral?.();
                  }}
                >
                  <TrendingUp className="w-4 h-4" />
                  Supply {collateralToken?.symbol || 'Collateral'} First
                </Button>
              </div>
            )}

            {/* Educational Explanation */}
            {hasCollateral && (
              <Collapsible open={showExplanation} onOpenChange={setShowExplanation}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Info className="w-4 h-4 text-primary" />
                      How borrowing works in this market
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {showExplanation ? 'Hide' : 'Show'}
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-3">
                    <div className="text-sm space-y-2">
                      <p className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Loan Asset</Badge>
                        <TokenIcon address={loanToken.address} symbol={loanToken.symbol} size="sm" />
                        <span className="font-medium">{loanToken.symbol}</span>
                        <span className="text-muted-foreground">← You borrow this</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Collateral</Badge>
                        {collateralToken && (
                          <TokenIcon address={collateralToken.address} symbol={collateralToken.symbol} size="sm" />
                        )}
                        <span className="font-medium">{collateralToken?.symbol || '—'}</span>
                        <span className="text-muted-foreground">← You deposited this</span>
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/30">
                      <p>• <strong>LLTV {market.lltv.toFixed(0)}%</strong>: You can borrow up to {market.lltv.toFixed(0)}% of your collateral value.</p>
                      <p>• <strong>Health Factor</strong>: If it drops below 1.0, your collateral can be liquidated.</p>
                      <p>• <strong>Interest accrues</strong> on your borrowed amount at the Borrow APR.</p>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Position Overview (if has collateral) */}
            {hasCollateral && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Shield className="w-4 h-4 text-primary" />
                  Your Position
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Collateral</div>
                    <div className="font-medium text-success">{formatUsd(existingCollateralUsd)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Max Borrow</div>
                    <div className="font-medium">{formatUsd(maxBorrowUsd)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Current Borrow</div>
                    <div className="font-medium text-warning">{formatUsd(existingBorrowUsd)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Available</div>
                    <div className="font-medium text-primary">{formatUsd(availableToBorrowUsd)}</div>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/30">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Health Factor</span>
                    <span className={cn(
                      "font-medium",
                      currentHealthFactor === null ? "text-success" :
                      currentHealthFactor > 1.5 ? "text-success" :
                      currentHealthFactor > 1 ? "text-warning" :
                      "text-destructive"
                    )}>
                      {currentHealthFactor === null ? '∞ (Safe)' : currentHealthFactor.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Amount Input */}
            {hasCollateral && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      Amount to Borrow
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs max-w-[200px]">
                              You can only borrow the loan asset ({loanToken.symbol}) in this market.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </label>
                    <span className="text-xs text-muted-foreground">
                      Available: {formatUsd(availableToBorrowUsd)}
                    </span>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={isLoading}
                      className="text-lg font-mono pr-20"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <TokenIcon address={loanToken.address} symbol={loanToken.symbol} size="sm" />
                      <span className="text-sm font-medium">{loanToken.symbol}</span>
                    </div>
                  </div>
                  
                  {/* Quick amount buttons */}
                  <div className="flex gap-2">
                    {[25, 50, 75, 90].map((percent) => (
                      <button
                        key={percent}
                        onClick={() => handleSetPercentage(percent)}
                        className={cn(
                          "flex-1 py-1.5 rounded text-xs font-medium transition-colors",
                          "bg-muted hover:bg-muted/80"
                        )}
                      >
                        {percent}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Risk Meter */}
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Borrow Limit Used</span>
                    <span className={cn(
                      "text-sm font-medium",
                      borrowLimitUsed < 70 ? "text-success" :
                      borrowLimitUsed < 90 ? "text-warning" :
                      "text-destructive"
                    )}>
                      {borrowLimitUsed.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(100, borrowLimitUsed)} 
                    className={cn(
                      "h-2",
                      borrowLimitUsed < 70 ? "[&>div]:bg-success" :
                      borrowLimitUsed < 90 ? "[&>div]:bg-warning" :
                      "[&>div]:bg-destructive"
                    )}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Safe</span>
                    <span>Moderate</span>
                    <span>Risky</span>
                    <span>Liquidation</span>
                  </div>

                  {/* Projected Health Factor */}
                  {parsedAmount > 0n && (
                    <div className="pt-3 border-t border-border/30">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Projected Health Factor</span>
                        <Badge variant="outline" className={cn(
                          riskLevel === 'safe' ? "bg-success/10 text-success border-success/30" :
                          riskLevel === 'moderate' ? "bg-warning/10 text-warning border-warning/30" :
                          "bg-destructive/10 text-destructive border-destructive/30"
                        )}>
                          {projectedHealthFactor?.toFixed(2) || '—'}
                        </Badge>
                      </div>
                      {riskLevel === 'liquidation' && (
                        <p className="text-xs text-destructive mt-2">
                          ⚠️ This would put your position at liquidation risk. Reduce the borrow amount.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Transaction Preview */}
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Zap className="w-4 h-4 text-primary" />
                    Transaction Preview
                  </div>
                  
                  <div className="flex items-center gap-3 p-2 rounded bg-primary/10">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-primary/20 text-primary">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">Borrow {amount || '0'} {loanToken.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        Borrow APR: {formatAPY(market.borrowApy)}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/30 text-xs text-muted-foreground">
                    No platform fee on Earn actions.
                  </div>
                </div>
              </>
            )}

            {/* Transaction Status */}
            {step !== 'idle' && (
              <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                <div className="flex items-center gap-2">
                  {step === 'success' ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : step === 'error' ? (
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  )}
                  <span className="text-sm font-medium">
                    {getStepDescription(step, 'borrow')}
                  </span>
                </div>
                
                {actionTxHash && (
                  <a
                    href={`${CHAIN_EXPLORERS[market.chainId] || 'https://etherscan.io/tx/'}${actionTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View transaction
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Action Button */}
            {hasCollateral && (
              <Button
                onClick={executeBorrow}
                disabled={!canExecute}
                className="w-full gap-2"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {getStepDescription(step, 'borrow')}
                  </>
                ) : step === 'success' ? (
                  <>
                    <Check className="w-4 h-4" />
                    Borrow Complete
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4" />
                    Borrow {loanToken.symbol}
                  </>
                )}
              </Button>
            )}

            {/* Definitions */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground">
                  <span className="flex items-center gap-1">
                    <HelpCircle className="w-3 h-3" />
                    What do these terms mean?
                  </span>
                  <span>Show</span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-3 rounded-lg bg-muted/30 text-xs space-y-2">
                <p><strong>LLTV (Liquidation LTV):</strong> The maximum loan-to-value ratio. If your borrow exceeds this, you can be liquidated.</p>
                <p><strong>Health Factor:</strong> A safety metric. Above 1.0 = safe. Below 1.0 = at risk of liquidation.</p>
                <p><strong>Borrow APR:</strong> The annual interest rate you pay on borrowed funds (variable).</p>
                <p><strong>Liquidation:</strong> If health factor drops below 1.0, anyone can repay your debt and take your collateral at a discount.</p>
              </CollapsibleContent>
            </Collapsible>

            {/* Disclaimer */}
            <p className="text-xs text-muted-foreground text-center">
              Non-custodial. Smart contract risk. APR is variable. Liquidation risk applies.
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
