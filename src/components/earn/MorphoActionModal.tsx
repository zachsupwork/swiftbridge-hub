/**
 * Morpho Action Modal Component
 * 
 * Handles supply, withdraw, borrow, repay with 2-step fee flow.
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
} from 'lucide-react';
import { 
  useAccount, 
  useChainId, 
  useSwitchChain, 
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
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
import { cn } from '@/lib/utils';
import { 
  MORPHO_BLUE_ABI, 
  MORPHO_BLUE_ADDRESS,
  marketToParams,
  calculateFee,
  type ActionStep,
  getStepDescription,
} from '@/lib/morpho/blueActions';
import { getMorphoChainConfig, getChainRpcUrl } from '@/lib/morpho/config';
import type { MorphoMarket } from '@/lib/morpho/types';
import { FEE_WALLET, isPlatformFeeConfigured } from '@/lib/env';
import { toast } from '@/hooks/use-toast';
import { CHAIN_EXPLORERS } from '@/lib/wagmiConfig';

type ActionType = 'supply' | 'withdraw' | 'borrow' | 'repay';

interface MorphoActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: MorphoMarket | null;
  actionType: ActionType;
  existingSupply?: bigint;
  existingBorrow?: bigint;
  existingCollateral?: bigint;
}

export function MorphoActionModal({
  isOpen,
  onClose,
  market,
  actionType,
  existingSupply = 0n,
  existingBorrow = 0n,
  existingCollateral = 0n,
}: MorphoActionModalProps) {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<ActionStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [feeTxHash, setFeeTxHash] = useState<Hash | undefined>();
  const [approvalTxHash, setApprovalTxHash] = useState<Hash | undefined>();
  const [actionTxHash, setActionTxHash] = useState<Hash | undefined>();

  // Get token info based on action type
  const token = useMemo(() => {
    if (!market) return null;
    
    // For borrow/repay, use loan asset
    // For supply/withdraw, use loan asset
    // For collateral actions, would use collateral asset
    return market.loanAsset;
  }, [market]);

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

  // Read fee wallet allowance
  const { data: feeAllowance, refetch: refetchFeeAllowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && isPlatformFeeConfigured() ? [address, FEE_WALLET] : undefined,
    query: { enabled: !!address && !!tokenAddress && isPlatformFeeConfigured() },
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

  // Calculate fee
  const feeInfo = useMemo(() => {
    if (actionType === 'withdraw' || actionType === 'repay') return null;
    return calculateFee(parsedAmount, decimals);
  }, [parsedAmount, decimals, actionType]);

  // Net amount after fee
  const netAmount = useMemo(() => {
    if (!feeInfo) return parsedAmount;
    return parsedAmount - feeInfo.feeAmount;
  }, [parsedAmount, feeInfo]);

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
        return tokenBalance || 0n;
      case 'withdraw':
        return existingSupply;
      case 'borrow':
        // Would need to calculate based on collateral
        return 0n; // Placeholder
      case 'repay':
        return existingBorrow;
      default:
        return 0n;
    }
  }, [actionType, tokenBalance, existingSupply, existingBorrow]);

  const handleSetMax = useCallback(() => {
    if (maxAmount > 0n) {
      setAmount(formatUnits(maxAmount, decimals));
    }
  }, [maxAmount, decimals]);

  // Execute the action
  const executeAction = useCallback(async () => {
    if (!market || !address || !tokenAddress || parsedAmount === 0n) return;

    try {
      setError(null);
      const marketParams = marketToParams(market);

      // Step 1: Fee approval (if needed)
      if (feeInfo && feeInfo.feeAmount > 0n) {
        // Check if fee approval needed
        const currentFeeAllowance = feeAllowance || 0n;
        if (currentFeeAllowance < feeInfo.feeAmount) {
          setStep('fee_approval');
          const feeApprovalTx = await writeContractAsync({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [FEE_WALLET, feeInfo.feeAmount],
          } as any);
          setFeeTxHash(feeApprovalTx);
          setStep('fee_pending');
          // Wait handled by useWaitForTransactionReceipt
          return;
        }

        // Step 2: Fee transfer
        setStep('fee_transfer');
        const feeTransferTx = await writeContractAsync({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [FEE_WALLET, feeInfo.feeAmount],
        } as any);
        setFeeTxHash(feeTransferTx);
        setStep('fee_confirming');
        // Wait for fee transfer to confirm
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Step 3: Token approval for Morpho (for supply/repay)
      if (actionType === 'supply' || actionType === 'repay') {
        const amountToApprove = actionType === 'supply' ? netAmount : parsedAmount;
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
          // Wait for approval
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Step 4: Execute Morpho action
      setStep('action');

      let txHash: Hash;

      switch (actionType) {
        case 'supply':
          txHash = await writeContractAsync({
            address: MORPHO_BLUE_ADDRESS,
            abi: MORPHO_BLUE_ABI,
            functionName: 'supply',
            args: [marketParams, netAmount, 0n, address, '0x'],
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
            args: [marketParams, netAmount, 0n, address, address],
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

        default:
          throw new Error(`Unknown action type: ${actionType}`);
      }

      setActionTxHash(txHash);
      setStep('action_pending');

    } catch (err: unknown) {
      console.error('Action failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Transaction failed';
      setError(errorMessage);
      setStep('error');
    }
  }, [
    market, address, tokenAddress, parsedAmount, netAmount, 
    feeInfo, feeAllowance, morphoAllowance, actionType,
    writeContractAsync,
  ]);

  // Handle transaction confirmations
  useEffect(() => {
    if (isFeeConfirmed && step === 'fee_pending') {
      refetchFeeAllowance();
      // Continue with the flow
      executeAction();
    }
  }, [isFeeConfirmed, step]);

  useEffect(() => {
    if (isApprovalConfirmed && step === 'approval_pending') {
      refetchAllowance();
      // Continue with the flow
      executeAction();
    }
  }, [isApprovalConfirmed, step]);

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
  const canExecute = parsedAmount > 0n && !isLoading && !isWrongChain && isConnected;

  const getActionIcon = () => {
    switch (actionType) {
      case 'supply': return <TrendingUp className="w-5 h-5" />;
      case 'withdraw': return <TrendingDown className="w-5 h-5" />;
      case 'borrow': return <Wallet className="w-5 h-5" />;
      case 'repay': return <Shield className="w-5 h-5" />;
    }
  };

  const getActionColor = () => {
    switch (actionType) {
      case 'supply': return 'text-success';
      case 'withdraw': return 'text-warning';
      case 'borrow': return 'text-primary';
      case 'repay': return 'text-secondary';
    }
  };

  if (!market || !token) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={getActionColor()}>{getActionIcon()}</span>
            {actionType.charAt(0).toUpperCase() + actionType.slice(1)} {token.symbol}
          </DialogTitle>
          <DialogDescription>
            {market.collateralAsset 
              ? `${token.symbol} / ${market.collateralAsset.symbol} on ${chainConfig?.label || 'Unknown'}`
              : `${token.symbol} on ${chainConfig?.label || 'Unknown'}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Wrong chain warning */}
          {isWrongChain && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-medium text-warning">Wrong Network</p>
                <p className="text-muted-foreground text-xs">
                  Please switch to {chainConfig?.label}
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
              <button
                onClick={handleSetMax}
                className="text-xs text-primary hover:underline"
              >
                Max: {formatUnits(maxAmount, decimals).slice(0, 10)} {token.symbol}
              </button>
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
                <span className="text-muted-foreground">Platform Fee ({feeInfo.feePercentage}%)</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Fee Amount</span>
                <span className="font-mono">{feeInfo.feeAmountFormatted} {token.symbol}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>You'll {actionType}</span>
                <span className="font-mono font-medium">{formatUnits(netAmount, decimals)} {token.symbol}</span>
              </div>
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
                  {getStepDescription(step, actionType)}
                </span>
              </div>
              
              {/* Transaction links */}
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
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {getStepDescription(step, actionType)}
              </>
            ) : step === 'success' ? (
              <>
                <Check className="w-4 h-4" />
                Done
              </>
            ) : (
              <>
                {getActionIcon()}
                {actionType.charAt(0).toUpperCase() + actionType.slice(1)} {token.symbol}
              </>
            )}
          </Button>

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground text-center">
            Non-custodial. Smart contract risk. Rates variable.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
