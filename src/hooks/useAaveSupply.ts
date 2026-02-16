/**
 * Aave V3 Supply Hook
 * 
 * Handles the supply flow with MANDATORY platform fee:
 * 1. Approve token for fee transfer (if needed)
 * 2. Transfer fee to FEE_WALLET
 * 3. Approve token for Aave Pool (if needed)
 * 4. Supply remaining amount to Aave V3 Pool
 */

import { useState, useCallback, useEffect } from 'react';
import { 
  useAccount, 
  useChainId, 
  useReadContract, 
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
} from 'wagmi';
import { parseUnits, formatUnits, type Hash, erc20Abi } from 'viem';
import { 
  getAavePoolAddress, 
  AAVE_V3_POOL_ABI, 
  AAVE_REFERRAL_CODE,
  isEarnChainSupported,
  ERC20_ABI,
} from '@/lib/aaveV3';
import { FEE_WALLET, isPlatformFeeConfigured, calculateFeeAmounts } from '@/lib/env';
import { logEarnEvent } from '@/lib/earnLogger';
import type { AaveMarket } from '@/lib/aaveMarkets';

export type SupplyStep = 
  | 'idle' 
  | 'approving_fee' 
  | 'transferring_fee' 
  | 'approving_aave' 
  | 'supplying' 
  | 'complete' 
  | 'error';

export interface SupplyState {
  step: SupplyStep;
  approvalTxHash?: Hash;
  feeTxHash?: Hash;
  supplyTxHash?: Hash;
  error?: string;
}

export interface UseAaveSupplyReturn {
  supplyState: SupplyState;
  balance: bigint | undefined;
  balanceFormatted: string;
  isLoading: boolean;
  supply: (amount: string) => Promise<void>;
  resetState: () => void;
  refetchBalance: () => void;
}

export function useAaveSupply(market: AaveMarket | null): UseAaveSupplyReturn {
  const { address } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();

  const [supplyState, setSupplyState] = useState<SupplyState>({ step: 'idle' });
  const [isLoading, setIsLoading] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<Hash | undefined>();

  const poolAddress = market ? getAavePoolAddress(market.chainId) : null;

  // Read token balance — MUST specify chainId to avoid reading from wrong chain
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: market?.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: market?.chainId,
    query: {
      enabled: !!market && !!address && chainId === market?.chainId,
    },
  });

  // Read allowance for FEE_WALLET
  const { data: feeAllowance, refetch: refetchFeeAllowance } = useReadContract({
    address: market?.address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && isPlatformFeeConfigured() ? [address, FEE_WALLET] : undefined,
    chainId: market?.chainId,
    query: {
      enabled: !!market && !!address && isPlatformFeeConfigured() && chainId === market?.chainId,
    },
  });

  // Read allowance for Aave Pool
  const { data: poolAllowance, refetch: refetchPoolAllowance } = useReadContract({
    address: market?.address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && poolAddress ? [address, poolAddress] : undefined,
    chainId: market?.chainId,
    query: {
      enabled: !!market && !!address && !!poolAddress && chainId === market?.chainId,
    },
  });

  // Wait for transaction receipt
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: pendingTxHash,
  });

  // When transaction confirms, refetch data
  useEffect(() => {
    if (txConfirmed && pendingTxHash) {
      refetchBalance();
      refetchFeeAllowance();
      refetchPoolAllowance();
    }
  }, [txConfirmed, pendingTxHash, refetchBalance, refetchFeeAllowance, refetchPoolAllowance]);

  const balanceFormatted = balance !== undefined && market 
    ? formatUnits(balance, market.decimals) 
    : '0';

  // Reset state
  const resetState = useCallback(() => {
    setSupplyState({ step: 'idle' });
    setPendingTxHash(undefined);
  }, []);

  // Main supply function with MANDATORY fee
  const supply = useCallback(async (amount: string) => {
    if (!market || !address || !poolAddress) {
      setSupplyState({ step: 'error', error: 'Wallet not connected or pool not found' });
      return;
    }

    // Validate chain support
    if (!isEarnChainSupported(chainId)) {
      setSupplyState({ step: 'error', error: 'Aave not supported on this network' });
      return;
    }

    if (chainId !== market.chainId) {
      setSupplyState({ step: 'error', error: 'Please switch to the correct network' });
      return;
    }

    // Validate fee configuration
    if (!isPlatformFeeConfigured()) {
      setSupplyState({ step: 'error', error: 'Platform fee configuration error' });
      return;
    }

    setIsLoading(true);

    try {
      // Parse amount
      const totalAmount = parseUnits(amount, market.decimals);
      
      if (totalAmount <= 0n) {
        throw new Error('Amount must be greater than 0');
      }

      // Check balance
      if (balance !== undefined && totalAmount > balance) {
        throw new Error('Insufficient balance');
      }

      // Calculate mandatory fee
      const { feeAmount, supplyAmount } = calculateFeeAmounts(totalAmount);

      if (supplyAmount <= 0n) {
        throw new Error('Amount too small after fee');
      }

      // Step 1: Approve fee transfer if needed
      const currentFeeAllowance = feeAllowance ?? 0n;
      if (currentFeeAllowance < feeAmount) {
        setSupplyState({ step: 'approving_fee' });

        logEarnEvent({
          action: 'approval_tx_sent',
          chainId,
          assetSymbol: market.symbol,
          assetAddress: market.address,
          walletAddress: address,
          amount: feeAmount.toString(),
          metadata: { type: 'fee_approval' },
        });

        const approveFeeTxHash = await writeContractAsync({
          address: market.address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [FEE_WALLET, feeAmount],
        } as any);

        setPendingTxHash(approveFeeTxHash);
        await new Promise(resolve => setTimeout(resolve, 3000));
        await refetchFeeAllowance();

        logEarnEvent({
          action: 'approval_tx_success',
          chainId,
          assetSymbol: market.symbol,
          walletAddress: address,
          txHash: approveFeeTxHash,
          metadata: { type: 'fee_approval' },
        });
      }

      // Step 2: Transfer fee to FEE_WALLET (MANDATORY)
      setSupplyState(prev => ({ ...prev, step: 'transferring_fee' }));

      logEarnEvent({
        action: 'fee_tx_sent',
        chainId,
        assetSymbol: market.symbol,
        assetAddress: market.address,
        walletAddress: address,
        feeAmount: feeAmount.toString(),
      });

      const feeTxHash = await writeContractAsync({
        address: market.address,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [FEE_WALLET, feeAmount],
      } as any);

      setPendingTxHash(feeTxHash);
      await new Promise(resolve => setTimeout(resolve, 3000));

      setSupplyState(prev => ({ ...prev, feeTxHash }));

      logEarnEvent({
        action: 'fee_tx_success',
        chainId,
        assetSymbol: market.symbol,
        walletAddress: address,
        feeAmount: feeAmount.toString(),
        txHash: feeTxHash,
      });

      // Step 3: Approve Aave Pool if needed
      const currentPoolAllowance = poolAllowance ?? 0n;
      if (currentPoolAllowance < supplyAmount) {
        setSupplyState(prev => ({ ...prev, step: 'approving_aave' }));

        logEarnEvent({
          action: 'approval_tx_sent',
          chainId,
          assetSymbol: market.symbol,
          assetAddress: market.address,
          walletAddress: address,
          amount: supplyAmount.toString(),
          metadata: { type: 'aave_approval' },
        });

        const approvePoolTxHash = await writeContractAsync({
          address: market.address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [poolAddress, supplyAmount],
        } as any);

        setPendingTxHash(approvePoolTxHash);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        setSupplyState(prev => ({ ...prev, approvalTxHash: approvePoolTxHash }));
        await refetchPoolAllowance();

        logEarnEvent({
          action: 'approval_tx_success',
          chainId,
          assetSymbol: market.symbol,
          walletAddress: address,
          txHash: approvePoolTxHash,
          metadata: { type: 'aave_approval' },
        });
      }

      // Step 4: Supply to Aave
      setSupplyState(prev => ({ ...prev, step: 'supplying' }));

      logEarnEvent({
        action: 'supply_tx_sent',
        chainId,
        assetSymbol: market.symbol,
        assetAddress: market.address,
        walletAddress: address,
        amount: supplyAmount.toString(),
      });

      const supplyTxHash = await writeContractAsync({
        address: poolAddress,
        abi: AAVE_V3_POOL_ABI,
        functionName: 'supply',
        args: [market.address, supplyAmount, address, AAVE_REFERRAL_CODE],
      } as any);

      setPendingTxHash(supplyTxHash);
      await new Promise(resolve => setTimeout(resolve, 3000));

      setSupplyState(prev => ({ 
        step: 'complete', 
        supplyTxHash,
        feeTxHash: prev.feeTxHash,
        approvalTxHash: prev.approvalTxHash,
      }));

      logEarnEvent({
        action: 'supply_tx_success',
        chainId,
        assetSymbol: market.symbol,
        assetAddress: market.address,
        walletAddress: address,
        amount: supplyAmount.toString(),
        txHash: supplyTxHash,
      });

      // Refresh balance
      await refetchBalance();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      
      // Check if user rejected
      if (errorMessage.includes('User rejected') || errorMessage.includes('User denied')) {
        logEarnEvent({
          action: 'user_cancelled',
          chainId,
          assetSymbol: market?.symbol,
          walletAddress: address,
        });
        setSupplyState({ step: 'error', error: 'Transaction cancelled by user' });
      } else {
        logEarnEvent({
          action: 'error',
          chainId,
          assetSymbol: market?.symbol,
          walletAddress: address,
          error: errorMessage,
        });
        setSupplyState({ step: 'error', error: errorMessage });
      }
    } finally {
      setIsLoading(false);
    }
  }, [market, address, chainId, poolAddress, balance, feeAllowance, poolAllowance, writeContractAsync, refetchBalance, refetchFeeAllowance, refetchPoolAllowance]);

  return {
    supplyState,
    balance,
    balanceFormatted,
    isLoading,
    supply,
    resetState,
    refetchBalance,
  };
}
