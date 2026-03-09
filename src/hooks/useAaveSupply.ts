/**
 * Aave V3 Supply Hook
 * 
 * Supply flow with 0.05% platform fee:
 * 1. Transfer fee to treasury (separate tx)
 * 2. Approve token for Aave Pool (exact amount, NOT infinite)
 * 3. Supply to Aave V3 Pool
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
import { logEarnEvent } from '@/lib/earnLogger';
import { calcPlatformFee, FEE_TREASURY, isTreasuryConfigured } from '@/lib/platformFee';
import type { AaveMarket } from '@/lib/aaveMarkets';

export type SupplyStep = 
  | 'idle' 
  | 'fee'
  | 'approving' 
  | 'supplying' 
  | 'complete' 
  | 'error';

export interface SupplyState {
  step: SupplyStep;
  approvalTxHash?: Hash;
  supplyTxHash?: Hash;
  feeTxHash?: Hash;
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

  // Read token balance
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

  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: pendingTxHash,
  });

  useEffect(() => {
    if (txConfirmed && pendingTxHash) {
      refetchBalance();
      refetchPoolAllowance();
    }
  }, [txConfirmed, pendingTxHash, refetchBalance, refetchPoolAllowance]);

  const balanceFormatted = balance !== undefined && market 
    ? formatUnits(balance, market.decimals) 
    : '0';

  const resetState = useCallback(() => {
    setSupplyState({ step: 'idle' });
    setPendingTxHash(undefined);
  }, []);

  const supply = useCallback(async (amount: string) => {
    if (!market || !address || !poolAddress) {
      setSupplyState({ step: 'error', error: 'Wallet not connected or pool not found' });
      return;
    }

    if (!isEarnChainSupported(chainId)) {
      setSupplyState({ step: 'error', error: 'Aave not supported on this network' });
      return;
    }

    if (chainId !== market.chainId) {
      setSupplyState({ step: 'error', error: 'Please switch to the correct network' });
      return;
    }

    setIsLoading(true);

    try {
      const totalAmount = parseUnits(amount, market.decimals);
      
      if (totalAmount <= 0n) {
        throw new Error('Amount must be greater than 0');
      }

      const feeAmount = isTreasuryConfigured() ? calcPlatformFee(totalAmount) : 0n;
      const supplyAmount = totalAmount - feeAmount;

      // User needs totalAmount (supply + fee) in wallet
      if (balance !== undefined && totalAmount > balance) {
        throw new Error('Insufficient balance');
      }

      console.log('[Supply] Starting:', {
        chainId,
        underlying: market.address,
        pool: poolAddress,
        total: totalAmount.toString(),
        fee: feeAmount.toString(),
        supply: supplyAmount.toString(),
      });

      // Step 1: Transfer fee to treasury
      if (feeAmount > 0n) {
        setSupplyState({ step: 'fee' });

        logEarnEvent({
          action: 'fee_tx_sent',
          chainId,
          assetSymbol: market.symbol,
          assetAddress: market.address,
          walletAddress: address,
          amount: feeAmount.toString(),
          metadata: { treasury: FEE_TREASURY },
        });

        const feeTxHash = await writeContractAsync({
          address: market.address,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [FEE_TREASURY, feeAmount],
        } as any);

        setPendingTxHash(feeTxHash);
        await new Promise(resolve => setTimeout(resolve, 3000));
        setSupplyState(prev => ({ ...prev, feeTxHash }));

        logEarnEvent({
          action: 'fee_tx_success',
          chainId,
          assetSymbol: market.symbol,
          walletAddress: address,
          txHash: feeTxHash,
        });
      }

      // Step 2: Approve Aave Pool (exact supply amount, NOT infinite)
      const currentPoolAllowance = poolAllowance ?? 0n;
      if (currentPoolAllowance < supplyAmount) {
        setSupplyState(prev => ({ ...prev, step: 'approving' }));

        logEarnEvent({
          action: 'approval_tx_sent',
          chainId,
          assetSymbol: market.symbol,
          assetAddress: market.address,
          walletAddress: address,
          amount: supplyAmount.toString(),
          metadata: { type: 'aave_pool_approval', spender: poolAddress },
        });

        const approvePoolTxHash = await writeContractAsync({
          address: market.address,
          abi: erc20Abi,
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
          metadata: { type: 'aave_pool_approval' },
        });
      }

      // Step 3: Supply to Aave Pool
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
        ...prev,
        step: 'complete', 
        supplyTxHash,
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

      await refetchBalance();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      
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
  }, [market, address, chainId, poolAddress, balance, poolAllowance, writeContractAsync, refetchBalance, refetchPoolAllowance]);

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
