/**
 * Morpho Borrow Modal
 * 
 * Two-step modal:
 * Step 1: Supply collateral (supplyCollateral) if user has none
 * Step 2: Borrow the loan token
 * Advanced users can skip Step 1 if they already have collateral.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
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
  ChevronRight,
} from 'lucide-react';
import { 
  useAccount, 
  useChainId, 
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useBalance,
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

type BorrowStep = 'collateral' | 'borrow';

interface MorphoBorrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: MorphoMarket | null;
  existingCollateral?: bigint;
  existingCollateralUsd?: number;
  existingBorrow?: bigint;
  existingBorrowUsd?: number;
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
  onSuccess,
}: MorphoBorrowModalProps) {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  
  const { writeContractAsync } = useWriteContract();

  // ---- State ----
  const [borrowStep, setBorrowStep] = useState<BorrowStep>('collateral');
  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [step, setStep] = useState<ActionStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [actionTxHash, setActionTxHash] = useState<Hash | undefined>();
  const [approvalTxHash, setApprovalTxHash] = useState<Hash | undefined>();
  // Track collateral supplied in this session (for the step transition)
  const [sessionCollateralUsd, setSessionCollateralUsd] = useState(0);

  const loanToken = market?.loanAsset;
  const collateralToken = market?.collateralAsset;
  const loanDecimals = loanToken?.decimals || 18;
  const collateralDecimals = collateralToken?.decimals || 18;
  const chainConfig = market ? getMorphoChainConfig(market.chainId) : null;

  const hasCollateral = existingCollateralUsd > 0 || sessionCollateralUsd > 0;

  // Read collateral token balance
  const { data: collateralBalance } = useBalance({
    address,
    token: collateralToken?.address as `0x${string}` | undefined,
    chainId: market?.chainId,
    query: { enabled: !!address && !!collateralToken?.address && isOpen },
  });

  // Read collateral token allowance for Morpho Blue
  const { data: collateralAllowance, refetch: refetchAllowance } = useReadContract({
    address: collateralToken?.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, MORPHO_BLUE_ADDRESS] : undefined,
    chainId: market?.chainId,
    query: { enabled: !!address && !!collateralToken?.address && isOpen },
  });

  // Wait for tx receipts
  const { isSuccess: isActionConfirmed } = useWaitForTransactionReceipt({ hash: actionTxHash, chainId: market?.chainId });
  const { isSuccess: isApprovalConfirmed } = useWaitForTransactionReceipt({ hash: approvalTxHash, chainId: market?.chainId });

  // Parse amounts
  const parsedCollateral = useMemo(() => {
    try { return parseUnits(collateralAmount || '0', collateralDecimals); } catch { return 0n; }
  }, [collateralAmount, collateralDecimals]);

  const parsedBorrow = useMemo(() => {
    try { return parseUnits(borrowAmount || '0', loanDecimals); } catch { return 0n; }
  }, [borrowAmount, loanDecimals]);

  // Effective collateral for borrow calculations
  const effectiveCollateralUsd = existingCollateralUsd + sessionCollateralUsd;

  const maxBorrowUsd = useMemo(() => {
    if (effectiveCollateralUsd <= 0 || !market) return 0;
    return effectiveCollateralUsd * (market.lltv / 100);
  }, [effectiveCollateralUsd, market]);

  const availableToBorrowUsd = useMemo(() => {
    return Math.max(0, maxBorrowUsd - existingBorrowUsd);
  }, [maxBorrowUsd, existingBorrowUsd]);

  const projectedBorrowUsd = useMemo(() => {
    return existingBorrowUsd + parseFloat(borrowAmount || '0');
  }, [borrowAmount, existingBorrowUsd]);

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

  const riskLevel = useMemo(() => {
    if (projectedHealthFactor === null) return 'safe';
    if (projectedHealthFactor > 1.5) return 'safe';
    if (projectedHealthFactor > 1.1) return 'moderate';
    if (projectedHealthFactor > 1) return 'risky';
    return 'liquidation';
  }, [projectedHealthFactor]);

  // Needs approval?
  const needsApproval = useMemo(() => {
    if (!collateralAllowance || parsedCollateral === 0n) return false;
    return (collateralAllowance as bigint) < parsedCollateral;
  }, [collateralAllowance, parsedCollateral]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setCollateralAmount('');
      setBorrowAmount('');
      setStep('idle');
      setError(null);
      setActionTxHash(undefined);
      setApprovalTxHash(undefined);
      setSessionCollateralUsd(0);
      // Auto-select step based on existing collateral
      setBorrowStep(existingCollateralUsd > 0 ? 'borrow' : 'collateral');
    }
  }, [isOpen, existingCollateralUsd]);

  const isWrongChain = market && walletChainId !== market.chainId;



  // ---- Approve collateral token ----
  const executeApproveCollateral = useCallback(async () => {
    if (!collateralToken?.address || !address || parsedCollateral === 0n) return;
    try {
      setError(null);
      setStep('approval');
      const txHash = await writeContractAsync({
        address: collateralToken.address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [MORPHO_BLUE_ADDRESS, parsedCollateral],
        chainId: market?.chainId,
      } as any);
      setApprovalTxHash(txHash);
      setStep('approval_pending');
    } catch (err: unknown) {
      console.error('Approval failed:', err);
      setError(err instanceof Error ? err.message : 'Approval failed');
      setStep('error');
    }
  }, [collateralToken, address, parsedCollateral, writeContractAsync]);

  // After approval confirms, execute supply collateral
  useEffect(() => {
    if (isApprovalConfirmed && step === 'approval_pending') {
      refetchAllowance();
      executeSupplyCollateral();
    }
  }, [isApprovalConfirmed, step]);

  // ---- Supply Collateral ----
  const executeSupplyCollateral = useCallback(async () => {
    if (!market || !address || parsedCollateral === 0n) return;
    try {
      setError(null);
      const marketParams = marketToParams(market);
      setStep('action');
      const txHash = await writeContractAsync({
        address: MORPHO_BLUE_ADDRESS,
        abi: MORPHO_BLUE_ABI,
        functionName: 'supplyCollateral',
        args: [marketParams, parsedCollateral, address, '0x'],
        chainId: market.chainId,
      } as any);
      setActionTxHash(txHash);
      setStep('action_pending');
    } catch (err: unknown) {
      console.error('Supply collateral failed:', err);
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStep('error');
    }
  }, [market, address, parsedCollateral, writeContractAsync]);

  // Handle collateral supply confirmation → advance to borrow step
  useEffect(() => {
    if (isActionConfirmed && step === 'action_pending' && borrowStep === 'collateral') {
      const collateralAmountFloat = parseFloat(collateralAmount || '0');
      setSessionCollateralUsd(collateralAmountFloat); // rough USD estimate
      toast({
        title: 'Collateral Supplied',
        description: `You supplied ${collateralAmount} ${collateralToken?.symbol}. You can now borrow.`,
      });
      // Reset for borrow step
      setStep('idle');
      setActionTxHash(undefined);
      setApprovalTxHash(undefined);
      setError(null);
      setBorrowStep('borrow');
      onSuccess?.(); // trigger position refresh
    }
  }, [isActionConfirmed, step, borrowStep, collateralAmount, collateralToken?.symbol, onSuccess]);

  // ---- Execute Borrow ----
  const executeBorrow = useCallback(async () => {
    if (!market || !address || parsedBorrow === 0n) return;
    try {
      setError(null);
      const marketParams = marketToParams(market);
      setStep('action');
      const txHash = await writeContractAsync({
        address: MORPHO_BLUE_ADDRESS,
        abi: MORPHO_BLUE_ABI,
        functionName: 'borrow',
        args: [marketParams, parsedBorrow, 0n, address, address],
        chainId: market.chainId,
      } as any);
      setActionTxHash(txHash);
      setStep('action_pending');
    } catch (err: unknown) {
      console.error('Borrow failed:', err);
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStep('error');
    }
  }, [market, address, parsedBorrow, writeContractAsync]);

  // Handle borrow confirmation
  useEffect(() => {
    if (isActionConfirmed && step === 'action_pending' && borrowStep === 'borrow') {
      setStep('success');
      toast({
        title: 'Borrow Successful',
        description: `You borrowed ${borrowAmount} ${loanToken?.symbol}.`,
      });
      onSuccess?.();
    }
  }, [isActionConfirmed, step, borrowStep, borrowAmount, loanToken?.symbol, onSuccess]);

  // ---- Collateral step: handle approve or supply ----
  const handleCollateralAction = useCallback(() => {
    if (needsApproval) {
      executeApproveCollateral();
    } else {
      executeSupplyCollateral();
    }
  }, [needsApproval, executeApproveCollateral, executeSupplyCollateral]);

  const handleSetBorrowPercentage = useCallback((percent: number) => {
    if (availableToBorrowUsd <= 0) return;
    const amount = (availableToBorrowUsd * percent) / 100;
    setBorrowAmount(amount.toFixed(4));
  }, [availableToBorrowUsd]);

  const isLoading = step !== 'idle' && step !== 'success' && step !== 'error';
  const canBorrow = parsedBorrow > 0n && !isLoading && !isWrongChain && isConnected && hasCollateral && riskLevel !== 'liquidation';
  const canSupplyCollateral = parsedCollateral > 0n && !isLoading && !isWrongChain && isConnected;

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
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-bold">{loanToken.symbol}</Badge>
                <span>{chainConfig?.label}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-warning font-medium">{formatAPY(market.borrowApy)} APR</span>
              </DialogDescription>
            </DialogHeader>

            {/* Step Indicator */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                borrowStep === 'collateral' 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-success text-success-foreground"
              )}>
                {borrowStep === 'collateral' ? '1' : <Check className="w-3 h-3" />}
              </div>
              <span className={cn(
                "text-sm font-medium",
                borrowStep === 'collateral' ? "text-foreground" : "text-success"
              )}>
                Supply Collateral
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <div className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                borrowStep === 'borrow' 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
              )}>
                2
              </div>
              <span className={cn(
                "text-sm font-medium",
                borrowStep === 'borrow' ? "text-foreground" : "text-muted-foreground"
              )}>
                Borrow
              </span>
              {/* Skip link if already has collateral and on step 1 */}
              {hasCollateral && borrowStep === 'collateral' && (
                <button
                  onClick={() => setBorrowStep('borrow')}
                  className="ml-auto text-xs text-primary hover:underline"
                >
                  Skip →
                </button>
              )}
            </div>

            {/* Wrong chain warning */}
            {isWrongChain && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-warning">Wrong Network</p>
                  <p className="text-muted-foreground text-xs">Please switch to {chainConfig?.label} in your wallet to continue.</p>
                </div>
              </div>
            )}

            {/* ========== STEP 1: Supply Collateral ========== */}
            {borrowStep === 'collateral' && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Collateral Required</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        To borrow <strong>{loanToken.symbol}</strong>, you must supply{' '}
                        <strong>{collateralToken?.symbol || 'collateral'}</strong> first. 
                        Your collateral secures the loan and determines your borrow limit.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Collateral Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-bold">{collateralToken?.symbol || '?'}</Badge>
                      Supply {collateralToken?.symbol || 'Collateral'}
                    </label>
                    <span className="text-xs text-muted-foreground">
                      Balance: {collateralBalance 
                        ? parseFloat(formatUnits(collateralBalance.value, collateralDecimals)).toFixed(4)
                        : '0'
                      } {collateralToken?.symbol}
                    </span>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      value={collateralAmount}
                      onChange={(e) => setCollateralAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={isLoading}
                      className="text-lg font-mono pr-20"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <span className="text-sm font-medium">{collateralToken?.symbol}</span>
                    </div>
                  </div>
                  {/* Quick amount buttons */}
                  <div className="flex gap-2">
                    {[25, 50, 75, 100].map((percent) => (
                      <button
                        key={percent}
                        onClick={() => {
                          if (!collateralBalance) return;
                          const val = (collateralBalance.value * BigInt(percent)) / 100n;
                          setCollateralAmount(formatUnits(val, collateralDecimals));
                        }}
                        className="flex-1 py-1.5 rounded text-xs font-medium transition-colors bg-muted hover:bg-muted/80"
                      >
                        {percent}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info: LLTV and what this means */}
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-xs text-muted-foreground space-y-1">
                  <p>• <strong>LLTV {market.lltv.toFixed(0)}%</strong>: You can borrow up to {market.lltv.toFixed(0)}% of your collateral value.</p>
                  <p>• If your health factor drops below 1.0, your collateral may be liquidated.</p>
                  <p>• <strong>Supply (Earn)</strong> deposits the loan asset and does NOT give borrow power.</p>
                  <p>• <strong>Borrow requires collateral deposit</strong> in this specific market.</p>
                </div>

                {/* Collateral Action Button */}
                <Button
                  onClick={handleCollateralAction}
                  disabled={!canSupplyCollateral}
                  className="w-full gap-2"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {step === 'approval' || step === 'approval_pending'
                        ? `Approving ${collateralToken?.symbol}...`
                        : `Supplying ${collateralToken?.symbol}...`}
                    </>
                  ) : needsApproval ? (
                    <>
                      <Shield className="w-4 h-4" />
                      Approve {collateralToken?.symbol}
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-4 h-4" />
                      Supply {collateralToken?.symbol} as Collateral
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* ========== STEP 2: Borrow ========== */}
            {borrowStep === 'borrow' && (
              <div className="space-y-4">
                {/* Position Overview */}
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Shield className="w-4 h-4 text-primary" />
                    Your Position
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Collateral</div>
                      <div className="font-medium text-success">{formatUsd(effectiveCollateralUsd)}</div>
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

                {/* Borrow Amount Input */}
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
                              You borrow the loan asset ({loanToken.symbol}) against your deposited collateral.
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
                      value={borrowAmount}
                      onChange={(e) => setBorrowAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={isLoading}
                      className="text-lg font-mono pr-20"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <span className="text-sm font-bold">{loanToken.symbol}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {[25, 50, 75, 90].map((percent) => (
                      <button
                        key={percent}
                        onClick={() => handleSetBorrowPercentage(percent)}
                        className="flex-1 py-1.5 rounded text-xs font-medium transition-colors bg-muted hover:bg-muted/80"
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
                  {parsedBorrow > 0n && (
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

                {/* Borrow Button */}
                <Button
                  onClick={executeBorrow}
                  disabled={!canBorrow}
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

                {/* Go back to add more collateral */}
                <button
                  onClick={() => {
                    setStep('idle');
                    setError(null);
                    setBorrowStep('collateral');
                  }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
                >
                  ← Add more collateral
                </button>
              </div>
            )}

            {/* Transaction Status (shared) */}
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
                    {getStepDescription(step, borrowStep === 'collateral' ? 'supply collateral' : 'borrow')}
                  </span>
                </div>
                {(actionTxHash || approvalTxHash) && (
                  <a
                    href={`${CHAIN_EXPLORERS[market.chainId] || 'https://etherscan.io/tx/'}${actionTxHash || approvalTxHash}`}
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
                <p><strong>Collateral:</strong> The asset you deposit to secure your loan. It is NOT the asset you borrow.</p>
                <p><strong>Supply (Earn):</strong> Deposits the loan asset to earn interest. Does NOT give borrow power.</p>
              </CollapsibleContent>
            </Collapsible>

            <p className="text-xs text-muted-foreground text-center">
              Non-custodial. Smart contract risk. APR is variable. Liquidation risk applies.
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
