/**
 * Morpho Vault Action Modal
 * 
 * In-app deposit/withdraw for Morpho Vaults (ERC-4626).
 * Users can deposit underlying assets or withdraw their shares.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Loader2,
  Check,
  AlertTriangle,
  ArrowRight,
  Info,
  TrendingUp,
  Vault,
} from 'lucide-react';
import {
  useAccount,
  useChainId,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChainIcon } from '@/components/common/ChainIcon';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type { MorphoVault, VaultPosition } from '@/lib/morpho/vaultsClient';

// ERC-4626 ABI (minimal for deposit/withdraw/redeem)
const ERC4626_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'redeem',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ name: 'assets', type: 'uint256' }],
  },
  {
    name: 'maxDeposit',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'receiver', type: 'address' }],
    outputs: [{ name: 'maxAssets', type: 'uint256' }],
  },
  {
    name: 'maxRedeem',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: 'maxShares', type: 'uint256' }],
  },
  {
    name: 'previewDeposit',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'assets', type: 'uint256' }],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'previewRedeem',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: 'assets', type: 'uint256' }],
  },
  {
    name: 'convertToAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: 'assets', type: 'uint256' }],
  },
] as const;

type ActionStep = 'idle' | 'approval' | 'approval_pending' | 'action' | 'action_pending' | 'success' | 'error';

interface MorphoVaultActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  vault: MorphoVault | null;
  userPosition?: VaultPosition | null;
  onSuccess?: () => void;
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0.00';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

export function MorphoVaultActionModal({
  isOpen,
  onClose,
  vault,
  userPosition,
  onSuccess,
}: MorphoVaultActionModalProps) {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();

  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<ActionStep>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [approvalTxHash, setApprovalTxHash] = useState<Hash | undefined>();
  const [actionTxHash, setActionTxHash] = useState<Hash | undefined>();

  // Reset state when modal opens/closes or vault changes
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setStep('idle');
      setErrorMsg('');
      setApprovalTxHash(undefined);
      setActionTxHash(undefined);
    }
  }, [isOpen, vault?.address]);

  const decimals = vault?.asset.decimals ?? 18;
  const vaultAddress = vault?.address as `0x${string}` | undefined;
  const assetAddress = vault?.asset.address as `0x${string}` | undefined;

  const isCorrectChain = vault ? walletChainId === vault.chainId : false;

  // Read user's balance of the underlying asset
  const { data: assetBalance } = useReadContract({
    address: assetAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!assetAddress && isOpen && tab === 'deposit' },
  });

  // Read user's allowance to the vault
  const { data: allowance } = useReadContract({
    address: assetAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && vaultAddress ? [address, vaultAddress] : undefined,
    query: { enabled: !!address && !!vaultAddress && !!assetAddress && isOpen && tab === 'deposit' },
  });

  const parsedAmount = useMemo(() => {
    if (!amount || !Number(amount)) return 0n;
    try {
      return parseUnits(amount, decimals);
    } catch {
      return 0n;
    }
  }, [amount, decimals]);

  const needsApproval = tab === 'deposit' && parsedAmount > 0n && (allowance ?? 0n) < parsedAmount;

  const formattedBalance = useMemo(() => {
    if (tab === 'deposit' && assetBalance !== undefined) {
      return formatUnits(assetBalance, decimals);
    }
    if (tab === 'withdraw' && userPosition) {
      return formatUnits(userPosition.assets, decimals);
    }
    return '0';
  }, [tab, assetBalance, userPosition, decimals]);

  // Write hooks
  const { writeContractAsync: writeApproval } = useWriteContract();
  const { writeContractAsync: writeVaultAction } = useWriteContract();

  const { isLoading: approvalConfirming } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
    query: {
      enabled: !!approvalTxHash,
    },
  });

  const { isLoading: actionConfirming, isSuccess: actionSuccess } = useWaitForTransactionReceipt({
    hash: actionTxHash,
    query: {
      enabled: !!actionTxHash,
    },
  });

  // Handle success
  useEffect(() => {
    if (actionSuccess && step === 'action_pending') {
      setStep('success');
      toast({
        title: tab === 'deposit' ? 'Deposit Successful' : 'Withdrawal Successful',
        description: `${amount} ${vault?.asset.symbol} ${tab === 'deposit' ? 'deposited to' : 'withdrawn from'} ${vault?.name}`,
      });
      onSuccess?.();
    }
  }, [actionSuccess, step]);

  const handleAction = useCallback(async () => {
    if (!vault || !address || !vaultAddress || !assetAddress || parsedAmount === 0n) return;

    try {
      // Step 1: Approve if needed
      if (needsApproval && tab === 'deposit') {
        setStep('approval');
        const hash = await writeApproval({
          address: assetAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [vaultAddress, parsedAmount],
          chainId: vault.chainId,
        } as any);
        setApprovalTxHash(hash);
        setStep('approval_pending');

        // Wait briefly then proceed
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Step 2: Execute vault action
      setStep('action');
      let hash: Hash;

      if (tab === 'deposit') {
        hash = await writeVaultAction({
          address: vaultAddress,
          abi: ERC4626_ABI,
          functionName: 'deposit',
          args: [parsedAmount, address],
          chainId: vault.chainId,
        } as any);
      } else {
        hash = await writeVaultAction({
          address: vaultAddress,
          abi: ERC4626_ABI,
          functionName: 'withdraw',
          args: [parsedAmount, address, address],
          chainId: vault.chainId,
        } as any);
      }

      setActionTxHash(hash);
      setStep('action_pending');
    } catch (err: unknown) {
      console.error(`[Vault] ${tab} failed:`, err);
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      // Clean up user rejection messages
      if (msg.includes('User rejected') || msg.includes('user rejected')) {
        setErrorMsg('Transaction rejected by user');
      } else {
        setErrorMsg(msg.slice(0, 200));
      }
      setStep('error');
    }
  }, [vault, address, vaultAddress, assetAddress, parsedAmount, needsApproval, tab, userPosition, writeApproval, writeVaultAction]);

  const handleSetMax = useCallback(() => {
    setAmount(formattedBalance);
  }, [formattedBalance]);

  if (!vault) return null;

  const isActionDisabled = !isConnected || !isCorrectChain || parsedAmount === 0n || step === 'approval_pending' || step === 'action_pending';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Vault className="w-5 h-5 text-primary" />
            {vault.name}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <ChainIcon chainId={vault.chainId} size="sm" />
            {vault.asset.symbol}
            {vault.curator && <span>• Curator: {vault.curator}</span>}
          </DialogDescription>
        </DialogHeader>

        {/* Vault stats */}
        <div className="grid grid-cols-3 gap-3 py-2">
          <div className="text-center">
            <div className="text-xs text-muted-foreground">APY</div>
            <div className="font-semibold text-success text-sm">
              {vault.apy > 0 ? `${vault.apy.toFixed(2)}%` : '—'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">TVL</div>
            <div className="font-semibold text-sm">{formatUsd(vault.totalAssetsUsd)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Fee</div>
            <div className="font-semibold text-sm">{vault.fee > 0 ? `${vault.fee.toFixed(0)}%` : 'None'}</div>
          </div>
        </div>

        {/* User position */}
        {userPosition && userPosition.assetsUsd > 0 && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-sm text-muted-foreground">Your Deposit</span>
            <span className="font-semibold text-primary">{formatUsd(userPosition.assetsUsd)}</span>
          </div>
        )}

        {/* Deposit / Withdraw tabs */}
        <Tabs value={tab} onValueChange={(v) => { setTab(v as 'deposit' | 'withdraw'); setAmount(''); setStep('idle'); setErrorMsg(''); }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="deposit">Deposit</TabsTrigger>
            <TabsTrigger value="withdraw" disabled={!userPosition || userPosition.assetsUsd <= 0}>
              Withdraw
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deposit" className="space-y-4 mt-4">
            {!isCorrectChain && isConnected && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                <span>Switch to the correct network to deposit</span>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount ({vault.asset.symbol})</span>
                <button onClick={handleSetMax} className="text-primary hover:underline text-xs">
                  Balance: {parseFloat(formattedBalance).toFixed(4)}
                </button>
              </div>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setStep('idle'); setErrorMsg(''); }}
                className="text-lg h-12"
                min="0"
                step="any"
              />
            </div>

            {needsApproval && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="w-3 h-3" />
                Approval required before deposit
              </div>
            )}
          </TabsContent>

          <TabsContent value="withdraw" className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount ({vault.asset.symbol})</span>
                <button onClick={handleSetMax} className="text-primary hover:underline text-xs">
                  Deposited: {parseFloat(formattedBalance).toFixed(4)}
                </button>
              </div>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setStep('idle'); setErrorMsg(''); }}
                className="text-lg h-12"
                min="0"
                step="any"
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Error message */}
        {step === 'error' && errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{errorMsg}</span>
          </div>
        )}

        {/* Success message */}
        {step === 'success' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/30 text-sm text-success">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{tab === 'deposit' ? 'Deposit' : 'Withdrawal'} confirmed!</span>
          </div>
        )}

        {/* Action button */}
        <Button
          onClick={handleAction}
          disabled={isActionDisabled}
          className="w-full h-12 gap-2"
          size="lg"
        >
          {step === 'approval' || step === 'approval_pending' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Approving...
            </>
          ) : step === 'action' || step === 'action_pending' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {tab === 'deposit' ? 'Depositing...' : 'Withdrawing...'}
            </>
          ) : step === 'success' ? (
            <>
              <Check className="w-4 h-4" />
              Done
            </>
          ) : (
            <>
              {tab === 'deposit' ? 'Deposit' : 'Withdraw'}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>

        {/* Info footer */}
        <p className="text-xs text-muted-foreground text-center">
          {tab === 'deposit'
            ? `Deposit ${vault.asset.symbol} into this vault to earn yield via curated market allocations.`
            : `Withdraw your ${vault.asset.symbol} from the vault back to your wallet.`}
        </p>
      </DialogContent>
    </Dialog>
  );
}
