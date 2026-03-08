/**
 * Aave V3 Withdraw Modal
 * 
 * Reads aToken balance (the user's supplied amount) and calls Pool.withdraw().
 * No approval needed — aTokens are burned directly by the Pool contract.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Loader2, Check, Wallet, ArrowDownLeft } from 'lucide-react';
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { parseUnits, formatUnits, erc20Abi, type Hash } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getAavePoolAddress, EARN_CHAIN_EXPLORERS } from '@/lib/aaveV3';
import { TokenIcon } from '@/components/common/TokenIcon';
import { ChainIcon } from '@/components/common/ChainIcon';
import type { AavePosition } from '@/hooks/useAavePositions';

type WithdrawStep = 'idle' | 'withdrawing' | 'complete' | 'error';

const POOL_WITHDRAW_ABI = [
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// Max uint256 for "withdraw all"
const MAX_UINT256 = 2n ** 256n - 1n;

interface WithdrawModalProps {
  position: AavePosition | null;
  isOpen: boolean;
  onClose: () => void;
}

export function WithdrawModal({ position, isOpen, onClose }: WithdrawModalProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<WithdrawStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [txHash, setTxHash] = useState<Hash | undefined>();

  const isChainMatch = position ? chainId === position.chainId : false;
  const poolAddress = position ? getAavePoolAddress(position.chainId) : null;

  // Read aToken balance (= supplied balance)
  const { data: aTokenBalance, refetch: refetchBalance } = useReadContract({
    address: position?.aTokenAddress ?? undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: position?.chainId,
    query: {
      enabled: !!position?.aTokenAddress && !!address && isChainMatch,
    },
  });

  // Wait for tx
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (txConfirmed && txHash) {
      setStep('complete');
      refetchBalance();
    }
  }, [txConfirmed, txHash, refetchBalance]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep('idle');
      setError(null);
      setAmount('');
      setTxHash(undefined);
    }
  }, [isOpen]);

  const { balanceFormatted, balanceUsd } = useMemo(() => {
    if (!position) return { balanceFormatted: '0', balanceUsd: 0 };
    // Use aToken balance if available, fallback to position data
    const bal = aTokenBalance !== undefined
      ? formatUnits(aTokenBalance, position.decimals)
      : position.supplyBalanceFormatted;
    const usd = aTokenBalance !== undefined
      ? parseFloat(formatUnits(aTokenBalance, position.decimals)) * (position.supplyBalanceUsd / Math.max(parseFloat(position.supplyBalanceFormatted), 1e-18))
      : position.supplyBalanceUsd;
    return { balanceFormatted: bal, balanceUsd: usd };
  }, [position, aTokenBalance]);

  const handleMax = useCallback(() => {
    setAmount(balanceFormatted);
  }, [balanceFormatted]);

  const handleWithdraw = useCallback(async () => {
    if (!position || !address || !poolAddress || !amount || parseFloat(amount) <= 0) return;

    setStep('withdrawing');
    setError(null);

    try {
      // If withdrawing ~full balance, use MAX_UINT256 to avoid dust
      const parsedAmount = parseUnits(amount, position.decimals);
      const isMax = aTokenBalance !== undefined && parsedAmount >= aTokenBalance * 99n / 100n;
      const withdrawAmount = isMax ? MAX_UINT256 : parsedAmount;

      const hash = await writeContractAsync({
        address: poolAddress,
        abi: POOL_WITHDRAW_ABI,
        functionName: 'withdraw',
        args: [position.assetAddress, withdrawAmount, address],
      } as any);

      setTxHash(hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Withdraw failed';
      if (msg.includes('User rejected') || msg.includes('User denied')) {
        setError('Transaction cancelled');
      } else {
        setError(msg);
      }
      setStep('error');
    }
  }, [position, address, poolAddress, amount, aTokenBalance, writeContractAsync]);

  if (!position) return null;

  const canWithdraw =
    amount &&
    parseFloat(amount) > 0 &&
    parseFloat(amount) <= parseFloat(balanceFormatted) + 0.000001 &&
    (step === 'idle' || step === 'error');

  const explorerBase = EARN_CHAIN_EXPLORERS[position.chainId] || '';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

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
                    <TokenIcon
                      address={position.assetAddress}
                      symbol={position.assetSymbol}
                      chainId={position.chainId}
                      logoUrl={position.assetLogo}
                      size="md"
                      className="ring-2 ring-destructive/30"
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-background overflow-hidden">
                      <ChainIcon chainId={position.chainId} size="sm" />
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      Withdraw {position.assetSymbol}
                      <ArrowDownLeft className="w-4 h-4 text-destructive" />
                    </div>
                    <div className="text-xs text-muted-foreground">{position.chainName} · Aave V3</div>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {!isConnected && (
                  <div className="glass rounded-xl p-6 text-center">
                    <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Connect your wallet to withdraw</p>
                  </div>
                )}

                {isConnected && !isChainMatch && (
                  <div className="glass rounded-xl p-4 text-center">
                    <p className="text-muted-foreground">
                      Please switch to {position.chainName} in your wallet.
                    </p>
                  </div>
                )}

                {isConnected && isChainMatch && step !== 'complete' && (
                  <>
                    {/* Supplied balance */}
                    <div className="glass rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Supplied Balance</span>
                        <span className="text-success font-medium">
                          {parseFloat(balanceFormatted).toFixed(6)} {position.assetSymbol}
                        </span>
                      </div>
                      {balanceUsd > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Value</span>
                          <span>${balanceUsd.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Supply APY</span>
                        <span className="text-success">{position.supplyApy.toFixed(2)}%</span>
                      </div>
                    </div>

                    {/* Amount input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-muted-foreground">Amount to Withdraw</label>
                        <button
                          onClick={handleMax}
                          className="text-xs text-primary hover:text-primary/80 transition-colors"
                          disabled={step !== 'idle' && step !== 'error'}
                        >
                          Max: {parseFloat(balanceFormatted).toFixed(4)} {position.assetSymbol}
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
                          <Badge variant="secondary">{position.assetSymbol}</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Warning if withdrawing with active borrows */}
                    {position.variableDebt > 0n && (
                      <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-warning">
                          You have active borrows. Withdrawing collateral will reduce your Health Factor
                          and may risk liquidation.
                        </p>
                      </div>
                    )}

                    {/* Insufficient balance */}
                    {amount && parseFloat(amount) > parseFloat(balanceFormatted) + 0.000001 && (
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-destructive">
                          Amount exceeds your supplied balance.
                        </p>
                      </div>
                    )}

                    {error && (
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <p className="text-sm text-destructive">{error}</p>
                      </div>
                    )}

                    <Button
                      className="w-full h-12 text-base"
                      disabled={!canWithdraw}
                      onClick={handleWithdraw}
                    >
                      {step === 'idle' || step === 'error' ? (
                        <>
                          <ArrowDownLeft className="w-4 h-4 mr-2" />
                          Withdraw
                        </>
                      ) : (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Withdrawing...
                        </>
                      )}
                    </Button>
                  </>
                )}

                {/* Success */}
                {step === 'complete' && (
                  <div className="glass rounded-xl p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                      <Check className="w-6 h-6 text-success" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Withdraw Successful!</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      You withdrew {amount} {position.assetSymbol} to your wallet.
                    </p>
                    {txHash && explorerBase && (
                      <a
                        href={`${explorerBase}${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline block mb-4"
                      >
                        View on Explorer →
                      </a>
                    )}
                    <Button onClick={onClose} className="w-full">Close</Button>
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
