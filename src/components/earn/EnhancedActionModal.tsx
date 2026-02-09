/**
 * Enhanced Morpho Action Modal
 * 
 * Features:
 * - Before/After simulation preview
 * - Multi-step transaction flow
 * - Risk warnings near liquidation
 * - Fee transparency
 * - Withdraw max safe / Repay all
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  AlertTriangle, 
  Loader2, 
  Check, 
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  Shield,
  ExternalLink,
  Info,
  ArrowDown,
  Zap,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { RiskBar } from '@/components/common/RiskBar';
import { TokenIconStable } from '@/components/common/TokenIconStable';
import { 
  MORPHO_BLUE_ABI, 
  MORPHO_BLUE_ADDRESS,
  marketToParams,
  calculateFee,
  type ActionStep,
  getStepDescription,
} from '@/lib/morpho/blueActions';
import { getMorphoChainConfig } from '@/lib/morpho/config';
import type { MorphoMarket } from '@/lib/morpho/types';
import { FEE_WALLET, isPlatformFeeConfigured, FEE_BPS } from '@/lib/env';
import { toast } from '@/hooks/use-toast';
import { CHAIN_EXPLORERS } from '@/lib/wagmiConfig';

export type ActionType = 'supply' | 'withdraw' | 'borrow' | 'repay' | 'supplyCollateral' | 'withdrawCollateral';

interface MorphoActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: MorphoMarket | null;
  actionType: ActionType;
  existingSupply?: bigint;
  existingBorrow?: bigint;
  existingCollateral?: bigint;
  existingCollateralUsd?: number;
  existingBorrowUsd?: number;
}

interface SimulationResult {
  collateralBefore: number;
  collateralAfter: number;
  debtBefore: number;
  debtAfter: number;
  ltvBefore: number;
  ltvAfter: number;
  healthBefore: number | null;
  healthAfter: number | null;
  liquidationDistance: number;
  isRisky: boolean;
  isLiquidatable: boolean;
}

export function MorphoActionModal({
  isOpen,
  onClose,
  market,
  actionType: initialActionType,
  existingSupply = 0n,
  existingBorrow = 0n,
  existingCollateral = 0n,
  existingCollateralUsd = 0,
  existingBorrowUsd = 0,
}: MorphoActionModalProps) {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [actionType, setActionType] = useState<ActionType>(initialActionType);
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<ActionStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [feeTxHash, setFeeTxHash] = useState<Hash | undefined>();
  const [approvalTxHash, setApprovalTxHash] = useState<Hash | undefined>();
  const [actionTxHash, setActionTxHash] = useState<Hash | undefined>();

  // Reset action type when modal opens
  useEffect(() => {
    if (isOpen) {
      setActionType(initialActionType);
    }
  }, [isOpen, initialActionType]);

  // Get token info based on action type
  const token = useMemo(() => {
    if (!market) return null;
    
    // For collateral actions, use collateral asset
    if (actionType === 'supplyCollateral' || actionType === 'withdrawCollateral') {
      return market.collateralAsset;
    }
    
    // For supply/withdraw/borrow/repay, use loan asset
    return market.loanAsset;
  }, [market, actionType]);

  const decimals = token?.decimals || 18;
  const tokenAddress = token?.address as `0x${string}` | undefined;

  // Read token balance
  const { data: tokenBalance, refetch: refetchBalance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!tokenAddress },
  });

  // Read token allowance for Morpho
  const { data: morphoAllowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, MORPHO_BLUE_ADDRESS] : undefined,
    query: { enabled: !!address && !!tokenAddress },
  });

  // Wait for transactions
  const { isLoading: isFeeConfirming, isSuccess: isFeeConfirmed } = useWaitForTransactionReceipt({
    hash: feeTxHash,
  });

  const { isLoading: isApprovalConfirming, isSuccess: isApprovalConfirmed } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
  });

  const { isLoading: isActionConfirming, isSuccess: isActionConfirmed } = useWaitForTransactionReceipt({
    hash: actionTxHash,
  });

  // Parse amount
  const parsedAmount = useMemo(() => {
    try {
      return parseUnits(amount || '0', decimals);
    } catch {
      return 0n;
    }
  }, [amount, decimals]);

  // Calculate fee (only for supply/borrow)
  const feeInfo = useMemo(() => {
    if (actionType === 'withdraw' || actionType === 'repay' || actionType === 'withdrawCollateral') {
      return null;
    }
    return calculateFee(parsedAmount, decimals);
  }, [parsedAmount, decimals, actionType]);

  // Net amount after fee
  const netAmount = useMemo(() => {
    if (!feeInfo) return parsedAmount;
    return parsedAmount - feeInfo.feeAmount;
  }, [parsedAmount, feeInfo]);

  // Calculate simulation
  const simulation = useMemo((): SimulationResult | null => {
    if (!market) return null;
    
    const lltv = market.lltv;
    let collateralBefore = existingCollateralUsd;
    let debtBefore = existingBorrowUsd;
    let collateralAfter = collateralBefore;
    let debtAfter = debtBefore;

    // Estimate USD value of action
    // This is a simplification - real implementation should use oracle prices
    const amountNum = parseFloat(amount || '0');
    const estimatedUsd = amountNum * (market.totalSupplyUsd / 100); // Rough estimate

    switch (actionType) {
      case 'supplyCollateral':
        collateralAfter = collateralBefore + estimatedUsd;
        break;
      case 'withdrawCollateral':
        collateralAfter = Math.max(0, collateralBefore - estimatedUsd);
        break;
      case 'borrow':
        debtAfter = debtBefore + estimatedUsd;
        break;
      case 'repay':
        debtAfter = Math.max(0, debtBefore - estimatedUsd);
        break;
      case 'supply':
        // Supply to earn doesn't affect collateral for borrowing
        break;
      case 'withdraw':
        // Withdraw from earn doesn't affect collateral
        break;
    }

    const ltvBefore = collateralBefore > 0 ? (debtBefore / collateralBefore) * 100 : 0;
    const ltvAfter = collateralAfter > 0 ? (debtAfter / collateralAfter) * 100 : 0;

    const healthBefore = debtBefore > 0 && collateralBefore > 0 
      ? (collateralBefore * (lltv / 100)) / debtBefore 
      : null;
    const healthAfter = debtAfter > 0 && collateralAfter > 0 
      ? (collateralAfter * (lltv / 100)) / debtAfter 
      : null;

    const liquidationDistance = healthAfter !== null ? Math.max(0, (healthAfter - 1) * 100) : 100;
    const isRisky = healthAfter !== null && healthAfter < 1.2;
    const isLiquidatable = healthAfter !== null && healthAfter < 1;

    return {
      collateralBefore,
      collateralAfter,
      debtBefore,
      debtAfter,
      ltvBefore,
      ltvAfter,
      healthBefore,
      healthAfter,
      liquidationDistance,
      isRisky,
      isLiquidatable,
    };
  }, [market, amount, actionType, existingCollateralUsd, existingBorrowUsd]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setStep('idle');
      setError(null);
      setFeeTxHash(undefined);
      setApprovalTxHash(undefined);
      setActionTxHash(undefined);
    }
  }, [isOpen]);

  // Check if wrong chain
  const isWrongChain = market && walletChainId !== market.chainId;
  const chainConfig = market ? getMorphoChainConfig(market.chainId) : null;

  // Handle chain switch
  const handleSwitchChain = useCallback(async () => {
    if (!market) return;
    try {
      await switchChain({ chainId: market.chainId });
    } catch (err) {
      console.error('Failed to switch chain:', err);
    }
  }, [market, switchChain]);

  // Get max amount
  const maxAmount = useMemo(() => {
    switch (actionType) {
      case 'supply':
      case 'supplyCollateral':
        return tokenBalance || 0n;
      case 'withdraw':
        return existingSupply;
      case 'withdrawCollateral':
        // Max safe = keep health > 1.05
        if (existingBorrow === 0n) return existingCollateral;
        // Would need price oracle for accurate calculation
        return existingCollateral / 2n; // Conservative
      case 'borrow':
        // Max based on collateral and LLTV
        return 0n; // Would need oracle
      case 'repay':
        // Min of balance and debt
        const balance = tokenBalance || 0n;
        return balance < existingBorrow ? balance : existingBorrow;
      default:
        return 0n;
    }
  }, [actionType, tokenBalance, existingSupply, existingBorrow, existingCollateral]);

  const handleSetMax = useCallback(() => {
    if (maxAmount > 0n) {
      // For repay, use existing borrow for "Repay All"
      const maxValue = actionType === 'repay' ? existingBorrow : maxAmount;
      setAmount(formatUnits(maxValue, decimals));
    }
  }, [maxAmount, decimals, actionType, existingBorrow]);

  // Withdraw max safe
  const handleWithdrawMaxSafe = useCallback(() => {
    if (!market || existingBorrow === 0n) {
      handleSetMax();
      return;
    }
    // Keep health factor at 1.2 minimum
    // This is simplified - real implementation needs oracle prices
    const safeWithdrawRatio = 0.8; // 80% of what seems safe
    const safeAmount = (existingCollateral * BigInt(Math.floor(safeWithdrawRatio * 100))) / 100n;
    setAmount(formatUnits(safeAmount, decimals));
  }, [market, existingBorrow, existingCollateral, decimals, handleSetMax]);

  // Execute the action
  const executeAction = useCallback(async () => {
    if (!market || !address || !tokenAddress || parsedAmount === 0n) return;

    try {
      setError(null);
      const marketParams = marketToParams(market);

      // Step 1: Fee transfer (if applicable)
      if (feeInfo && feeInfo.feeAmount > 0n) {
        setStep('fee_transfer');
        const feeTransferTx = await writeContractAsync({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [FEE_WALLET, feeInfo.feeAmount],
        } as any);
        setFeeTxHash(feeTransferTx);
        setStep('fee_confirming');
        // Wait for confirmation
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Step 2: Token approval for Morpho (for supply/repay/supplyCollateral)
      const needsApproval = ['supply', 'repay', 'supplyCollateral'].includes(actionType);
      if (needsApproval) {
        const amountToApprove = feeInfo ? netAmount : parsedAmount;
        const currentAllowance = morphoAllowance || 0n;
        
        if (currentAllowance < amountToApprove) {
          setStep('approval');
          const approvalTx = await writeContractAsync({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [MORPHO_BLUE_ADDRESS, amountToApprove],
          } as any);
          setApprovalTxHash(approvalTx);
          setStep('approval_pending');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      // Step 3: Execute Morpho action
      setStep('action');

      let txHash: Hash;
      const actionAmount = feeInfo ? netAmount : parsedAmount;

      switch (actionType) {
        case 'supply':
          txHash = await writeContractAsync({
            address: MORPHO_BLUE_ADDRESS,
            abi: MORPHO_BLUE_ABI,
            functionName: 'supply',
            args: [marketParams, actionAmount, 0n, address, '0x'],
          } as any);
          break;

        case 'withdraw':
          txHash = await writeContractAsync({
            address: MORPHO_BLUE_ADDRESS,
            abi: MORPHO_BLUE_ABI,
            functionName: 'withdraw',
            args: [marketParams, parsedAmount, 0n, address, address],
          } as any);
          break;

        case 'borrow':
          txHash = await writeContractAsync({
            address: MORPHO_BLUE_ADDRESS,
            abi: MORPHO_BLUE_ABI,
            functionName: 'borrow',
            args: [marketParams, actionAmount, 0n, address, address],
          } as any);
          break;

        case 'repay':
          txHash = await writeContractAsync({
            address: MORPHO_BLUE_ADDRESS,
            abi: MORPHO_BLUE_ABI,
            functionName: 'repay',
            args: [marketParams, parsedAmount, 0n, address, '0x'],
          } as any);
          break;

        case 'supplyCollateral':
          txHash = await writeContractAsync({
            address: MORPHO_BLUE_ADDRESS,
            abi: MORPHO_BLUE_ABI,
            functionName: 'supplyCollateral',
            args: [marketParams, actionAmount, address, '0x'],
          } as any);
          break;

        case 'withdrawCollateral':
          txHash = await writeContractAsync({
            address: MORPHO_BLUE_ADDRESS,
            abi: MORPHO_BLUE_ABI,
            functionName: 'withdrawCollateral',
            args: [marketParams, parsedAmount, address, address],
          } as any);
          break;

        default:
          throw new Error(`Unknown action type: ${actionType}`);
      }

      setActionTxHash(txHash);
      setStep('action_pending');

    } catch (err: unknown) {
      console.error('Action failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Transaction failed';
      setError(errorMessage.length > 100 ? errorMessage.slice(0, 100) + '...' : errorMessage);
      setStep('error');
    }
  }, [
    market, address, tokenAddress, parsedAmount, netAmount, 
    feeInfo, morphoAllowance, actionType,
    writeContractAsync,
  ]);

  // Handle transaction confirmations
  useEffect(() => {
    if (isActionConfirmed && step === 'action_pending') {
      setStep('success');
      refetchBalance();
      toast({
        title: 'Transaction Successful',
        description: `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} completed successfully.`,
      });
    }
  }, [isActionConfirmed, step, actionType, refetchBalance]);

  const isLoading = step !== 'idle' && step !== 'success' && step !== 'error';
  const canExecute = parsedAmount > 0n && !isLoading && !isWrongChain && isConnected && !simulation?.isLiquidatable;

  const getActionIcon = () => {
    switch (actionType) {
      case 'supply': 
      case 'supplyCollateral': 
        return <TrendingUp className="w-5 h-5" />;
      case 'withdraw':
      case 'withdrawCollateral': 
        return <TrendingDown className="w-5 h-5" />;
      case 'borrow': return <Wallet className="w-5 h-5" />;
      case 'repay': return <Shield className="w-5 h-5" />;
    }
  };

  const getActionLabel = () => {
    switch (actionType) {
      case 'supply': return 'Supply';
      case 'withdraw': return 'Withdraw';
      case 'borrow': return 'Borrow';
      case 'repay': return 'Repay';
      case 'supplyCollateral': return 'Add Collateral';
      case 'withdrawCollateral': return 'Remove Collateral';
    }
  };

  const formatUsd = (value: number) => {
    if (value === 0) return '$0.00';
    if (value < 0.01) return '<$0.01';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (!market || !token) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TokenIconStable symbol={token.symbol} size="sm" />
            {getActionLabel()} {token.symbol}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <TokenIconStable symbol={market.loanAsset.symbol} size="sm" />
            {market.loanAsset.symbol}
            {market.collateralAsset && ` / ${market.collateralAsset.symbol}`}
            {' • LLTV: '}{market.lltv.toFixed(0)}%
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action tabs for positions */}
          {(existingSupply > 0n || existingBorrow > 0n || existingCollateral > 0n) && (
            <Tabs value={actionType} onValueChange={(v) => setActionType(v as ActionType)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="supply" className="text-xs">Supply</TabsTrigger>
                <TabsTrigger value="withdraw" className="text-xs" disabled={existingSupply === 0n}>Withdraw</TabsTrigger>
                <TabsTrigger value="borrow" className="text-xs">Borrow</TabsTrigger>
                <TabsTrigger value="repay" className="text-xs" disabled={existingBorrow === 0n}>Repay</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Wrong chain warning */}
          {isWrongChain && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-medium text-warning">Wrong Network</p>
                <p className="text-muted-foreground text-xs">
                  Switch to {chainConfig?.label}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSwitchChain}
                disabled={isSwitching}
              >
                {isSwitching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Switch'}
              </Button>
            </div>
          )}

          {/* Amount input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Amount</label>
              <div className="flex gap-2">
                {actionType === 'repay' && existingBorrow > 0n && (
                  <button
                    onClick={() => setAmount(formatUnits(existingBorrow, decimals))}
                    className="text-xs text-primary hover:underline"
                  >
                    Repay All
                  </button>
                )}
                {actionType === 'withdrawCollateral' && existingBorrow > 0n && (
                  <button
                    onClick={handleWithdrawMaxSafe}
                    className="text-xs text-primary hover:underline"
                  >
                    Max Safe
                  </button>
                )}
                <button
                  onClick={handleSetMax}
                  className="text-xs text-primary hover:underline"
                >
                  Max: {formatUnits(maxAmount, decimals).slice(0, 10)} {token.symbol}
                </button>
              </div>
            </div>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={isLoading}
              className="text-lg font-mono"
            />
          </div>

          {/* Fee info */}
          {feeInfo && feeInfo.feeAmount > 0n && (
            <div className="p-3 rounded-lg bg-muted/30 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Info className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Platform Fee ({(FEE_BPS / 100).toFixed(2)}%)</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Fee Amount</span>
                <span className="font-mono">{feeInfo.feeAmountFormatted} {token.symbol}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>You'll {getActionLabel().toLowerCase()}</span>
                <span className="font-mono font-medium">{formatUnits(netAmount, decimals)} {token.symbol}</span>
              </div>
            </div>
          )}

          {/* Before/After Simulation */}
          {simulation && (simulation.debtBefore > 0 || simulation.debtAfter > 0 || simulation.collateralBefore > 0) && (
            <div className="p-3 rounded-lg bg-muted/30 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Zap className="w-4 h-4 text-primary" />
                Transaction Preview
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-muted-foreground">Metric</div>
                <div className="text-center text-muted-foreground">Before</div>
                <div className="text-center text-muted-foreground">After</div>
                
                {/* Collateral */}
                <div>Collateral</div>
                <div className="text-center">{formatUsd(simulation.collateralBefore)}</div>
                <div className={cn(
                  "text-center font-medium",
                  simulation.collateralAfter > simulation.collateralBefore && "text-success",
                  simulation.collateralAfter < simulation.collateralBefore && "text-warning",
                )}>
                  {formatUsd(simulation.collateralAfter)}
                </div>
                
                {/* Debt */}
                <div>Debt</div>
                <div className="text-center">{formatUsd(simulation.debtBefore)}</div>
                <div className={cn(
                  "text-center font-medium",
                  simulation.debtAfter < simulation.debtBefore && "text-success",
                  simulation.debtAfter > simulation.debtBefore && "text-warning",
                )}>
                  {formatUsd(simulation.debtAfter)}
                </div>
                
                {/* LTV */}
                <div>LTV</div>
                <div className="text-center">{simulation.ltvBefore.toFixed(1)}%</div>
                <div className={cn(
                  "text-center font-medium",
                  simulation.ltvAfter < simulation.ltvBefore && "text-success",
                  simulation.ltvAfter > simulation.ltvBefore && "text-warning",
                  simulation.ltvAfter >= market.lltv && "text-destructive",
                )}>
                  {simulation.ltvAfter.toFixed(1)}%
                </div>
                
                {/* Health Factor */}
                <div>Health</div>
                <div className="text-center">
                  {simulation.healthBefore !== null ? simulation.healthBefore.toFixed(2) : '∞'}
                </div>
                <div className={cn(
                  "text-center font-medium",
                  simulation.healthAfter === null && "text-success",
                  simulation.healthAfter !== null && simulation.healthAfter > 1.5 && "text-success",
                  simulation.healthAfter !== null && simulation.healthAfter > 1 && simulation.healthAfter <= 1.5 && "text-warning",
                  simulation.healthAfter !== null && simulation.healthAfter <= 1 && "text-destructive",
                )}>
                  {simulation.healthAfter !== null ? simulation.healthAfter.toFixed(2) : '∞'}
                </div>
              </div>

              {/* Risk bar */}
              <RiskBar 
                healthFactor={simulation.healthAfter} 
                lltv={market.lltv}
                size="sm"
              />
            </div>
          )}

          {/* Risk warnings */}
          {simulation?.isLiquidatable && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium text-sm">Liquidation Risk!</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                This action would put your position at immediate liquidation risk. Reduce the amount.
              </p>
            </div>
          )}

          {simulation?.isRisky && !simulation?.isLiquidatable && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium text-sm">High Risk</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Your health factor will be low. Consider a smaller amount.
              </p>
            </div>
          )}

          {/* Transaction steps */}
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
                  {getStepDescription(step, getActionLabel())}
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

          {/* Error message */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Action button */}
          <Button
            onClick={executeAction}
            disabled={!canExecute}
            className="w-full gap-2"
            variant={simulation?.isRisky ? 'destructive' : 'default'}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {getStepDescription(step, getActionLabel())}
              </>
            ) : step === 'success' ? (
              <>
                <Check className="w-4 h-4" />
                Done
              </>
            ) : (
              <>
                {getActionIcon()}
                {getActionLabel()} {token.symbol}
              </>
            )}
          </Button>

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground text-center">
            Non-custodial. Smart contract risk. APY is variable.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
