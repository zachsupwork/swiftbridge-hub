/**
 * Aave V3 Supply Hook
 * 
 * Handles the supply flow with optional platform fee:
 * 1. Check/request token approval for Aave Pool
 * 2. If fee enabled: transfer fee to fee wallet
 * 3. Supply remaining amount to Aave V3 Pool
 */

import { useState, useCallback, useEffect } from 'react';
import { 
  useAccount, 
  useChainId, 
  useReadContract, 
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { parseUnits, formatUnits, type Hash, erc20Abi } from 'viem';
import { 
  getAavePoolAddress, 
  AAVE_V3_POOL_ABI, 
  AAVE_REFERRAL_CODE,
  isEarnChainSupported,
} from '@/lib/aaveV3';
import { FEE_WALLET, FEE_BPS, isPlatformFeeConfigured } from '@/lib/env';
import { logEarnEvent } from '@/lib/earnLogger';
import type { AaveMarket } from '@/lib/aaveMarkets';

export type SupplyStep = 'idle' | 'approving' | 'transferring_fee' | 'supplying' | 'complete' | 'error';

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
  allowance: bigint | undefined;
  isLoading: boolean;
  supply: (amount: string, enableFee: boolean) => Promise<void>;
  resetState: () => void;
  refetchBalance: () => void;
  refetchAllowance: () => void;
}

export function useAaveSupply(market: AaveMarket | null): UseAaveSupplyReturn {
  const { address } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();

  const [supplyState, setSupplyState] = useState<SupplyState>({ step: 'idle' });
  const [isLoading, setIsLoading] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<Hash | undefined>();

  const poolAddress = market ? getAavePoolAddress(market.chainId) : null;

  // Read token balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: market?.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!market && !!address,
    },
  });

  // Read allowance for Aave Pool
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: market?.address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && poolAddress ? [address, poolAddress] : undefined,
    query: {
      enabled: !!market && !!address && !!poolAddress,
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
      refetchAllowance();
    }
  }, [txConfirmed, pendingTxHash, refetchBalance, refetchAllowance]);

  const balanceFormatted = balance !== undefined && market 
    ? formatUnits(balance, market.decimals) 
    : '0';

  // Reset state
  const resetState = useCallback(() => {
    setSupplyState({ step: 'idle' });
    setPendingTxHash(undefined);
  }, []);

  // Main supply function
  const supply = useCallback(async (amount: string, enableFee: boolean) => {
    if (!market || !address || !poolAddress) {
      setSupplyState({ step: 'error', error: 'Wallet not connected or pool not found' });
      return;
    }

    // Validate chain support
    if (!isEarnChainSupported(chainId)) {
      setSupplyState({ step: 'error', error: 'Chain not supported for Earn' });
      return;
    }

    if (chainId !== market.chainId) {
      setSupplyState({ step: 'error', error: `Please switch to the correct chain` });
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

      // Calculate fee if enabled
      let feeAmount = 0n;
      let supplyAmount = totalAmount;

      if (enableFee && isPlatformFeeConfigured()) {
        feeAmount = (totalAmount * BigInt(FEE_BPS)) / 10000n;
        supplyAmount = totalAmount - feeAmount;

        if (supplyAmount <= 0n) {
          throw new Error('Amount too small after fee');
        }
      }

      // Step 1: Check and request approval if needed
      const currentAllowance = allowance ?? 0n;

      if (currentAllowance < supplyAmount) {
        setSupplyState({ step: 'approving' });

        logEarnEvent({
          action: 'approval_tx_sent',
          chainId,
          assetSymbol: market.symbol,
          assetAddress: market.address,
          walletAddress: address,
          amount: supplyAmount.toString(),
        });

        const approvalHash = await writeContractAsync({
          address: market.address,
          abi: erc20Abi,
          functionName: 'approve',
          args: [poolAddress, supplyAmount],
        } as any);

        setPendingTxHash(approvalHash);

        // Wait a bit for the tx to be mined
        await new Promise(resolve => setTimeout(resolve, 3000));

        setSupplyState(prev => ({ ...prev, approvalTxHash: approvalHash }));

        logEarnEvent({
          action: 'approval_tx_success',
          chainId,
          assetSymbol: market.symbol,
          walletAddress: address,
          txHash: approvalHash,
        });

        // Refetch allowance
        await refetchAllowance();
      }

      // Step 2: Transfer fee if enabled
      if (enableFee && feeAmount > 0n && isPlatformFeeConfigured()) {
        setSupplyState(prev => ({ ...prev, step: 'transferring_fee' }));

        logEarnEvent({
          action: 'fee_tx_sent',
          chainId,
          assetSymbol: market.symbol,
          assetAddress: market.address,
          walletAddress: address,
          feeAmount: feeAmount.toString(),
        });

        try {
          const feeTxHash = await writeContractAsync({
            address: market.address,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [FEE_WALLET as `0x${string}`, feeAmount],
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
        } catch (feeError) {
          const errorMessage = feeError instanceof Error ? feeError.message : 'Fee transfer failed';
          
          logEarnEvent({
            action: 'fee_tx_failed',
            chainId,
            assetSymbol: market.symbol,
            walletAddress: address,
            error: errorMessage,
          });

          setSupplyState({ 
            step: 'error', 
            error: `Fee transfer failed. Use "Supply on Aave" to proceed without fee.` 
          });
          setIsLoading(false);
          return;
        }
      }

      // Step 3: Supply to Aave
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
  }, [market, address, chainId, poolAddress, balance, allowance, writeContractAsync, refetchBalance, refetchAllowance]);

  return {
    supplyState,
    balance,
    balanceFormatted,
    allowance,
    isLoading,
    supply,
    resetState,
    refetchBalance,
    refetchAllowance,
  };
}
