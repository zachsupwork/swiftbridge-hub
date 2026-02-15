/**
 * Morpho Vault Action Modal
 * 
 * In-app deposit/withdraw for Morpho Vaults (ERC-4626).
 * Features:
 * - Auto chain switch (no popup)
 * - Swap CTA when balance is 0
 * - Persistent success screen
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ExternalLink,
  Repeat,
} from 'lucide-react';
import {
  useAccount,
  useChainId,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useSwitchChain,
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
import { CHAIN_EXPLORERS } from '@/lib/wagmiConfig';
import { buildSwapLink } from '@/lib/swapDeepLink';
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
  const { switchChainAsync } = useSwitchChain();
  const navigate = useNavigate();

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

  const hasNoBalance = tab === 'deposit' && (!assetBalance || assetBalance === 0n);

  // Write hooks
  const { writeContractAsync: writeApproval } = useWriteContract();
  const { writeContractAsync: writeVaultAction } = useWriteContract();

  const { isLoading: approvalConfirming } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
    query: { enabled: !!approvalTxHash },
  });

  const { isLoading: actionConfirming, isSuccess: actionSuccess } = useWaitForTransactionReceipt({
    hash: actionTxHash,
    query: { enabled: !!actionTxHash },
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

  // Auto switch chain
  const handleSwitchChain = useCallback(async () => {
    if (!vault) return;
    try {
      await switchChainAsync({ chainId: vault.chainId });
      toast({ title: 'Network Switched', description: `Switched to the correct network` });
    } catch (err) {
      toast({ title: 'Switch Failed', description: 'Please switch network manually.', variant: 'destructive' });
    }
  }, [vault, switchChainAsync]);

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
      if (msg.includes('User rejected') || msg.includes('user rejected')) {
        setErrorMsg('Transaction rejected by user');
      } else {
        setErrorMsg(msg.slice(0, 200));
      }
      setStep('error');
    }
  }, [vault, address, vaultAddress, assetAddress, parsedAmount, needsApproval, tab, writeApproval, writeVaultAction]);

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
                <span className="flex-1">Switch to the correct network to deposit</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSwitchChain}
                  className="gap-1 text-xs shrink-0"
                >
                  Switch Network
                </Button>
              </div>
            )}

            {/* Swap CTA when no balance */}
            {hasNoBalance && isCorrectChain && step === 'idle' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <Repeat className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1 text-sm">
                  <p className="font-medium">No {vault.asset.symbol} balance</p>
                  <p className="text-xs text-muted-foreground">Get tokens via cross-chain swap</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    navigate(buildSwapLink({
                      chainId: vault.chainId,
                      toTokenAddress: vault.asset.address,
                      toTokenSymbol: vault.asset.symbol,
                      ref: 'earn',
                      action: 'swap',
                    }));
                  }}
                  className="gap-1 text-xs shrink-0"
                >
                  <Repeat className="w-3 h-3" />
                  Get {vault.asset.symbol}
                </Button>
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
            {!isCorrectChain && isConnected && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                <span className="flex-1">Switch to the correct network to withdraw</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSwitchChain}
                  className="gap-1 text-xs shrink-0"
                >
                  Switch Network
                </Button>
              </div>
            )}

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
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-4 rounded-xl bg-success/10 border border-success/30 space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="font-semibold text-success">
                  {tab === 'deposit' ? 'Deposit' : 'Withdrawal'} Successful
                </p>
                <p className="text-xs text-muted-foreground">
                  {amount} {vault?.asset.symbol} {tab === 'deposit' ? 'deposited to' : 'withdrawn from'} {vault?.name}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-muted/30">
                <span className="text-muted-foreground">Amount</span>
                <div className="font-medium">{amount} {vault?.asset.symbol}</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/30">
                <span className="text-muted-foreground">Vault</span>
                <div className="font-medium truncate">{vault?.name}</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/30">
                <span className="text-muted-foreground">APY</span>
                <div className="font-medium text-success">{vault?.apy ? `${vault.apy.toFixed(2)}%` : '—'}</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/30">
                <span className="text-muted-foreground">Curator</span>
                <div className="font-medium">{vault?.curator || '—'}</div>
              </div>
            </div>
            {actionTxHash && (
              <a
                href={`${CHAIN_EXPLORERS[vault?.chainId || 1] || 'https://etherscan.io/tx/'}${actionTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View transaction on explorer
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  onClose();
                  const params = new URLSearchParams(window.location.search);
                  params.set('tab', 'positions');
                  window.history.replaceState(null, '', `/earn?${params.toString()}`);
                  window.location.reload();
                }}
              >
                View Positions
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  setStep('idle');
                  setAmount('');
                  setActionTxHash(undefined);
                  setApprovalTxHash(undefined);
                }}
              >
                {tab === 'deposit' ? 'Deposit More' : 'Withdraw More'}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Loading state */}
        {(step === 'approval' || step === 'approval_pending' || step === 'action' || step === 'action_pending') && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <div className="text-sm">
              {step === 'approval' && 'Confirm approval in your wallet...'}
              {step === 'approval_pending' && 'Waiting for approval...'}
              {step === 'action' && `Confirm ${tab} in your wallet...`}
              {step === 'action_pending' && `Waiting for ${tab} to confirm...`}
            </div>
          </div>
        )}

        {/* Main action button */}
        {step !== 'success' && (
          <Button
            onClick={!isCorrectChain && isConnected ? handleSwitchChain : handleAction}
            disabled={isCorrectChain ? isActionDisabled : false}
            className="w-full h-12 gap-2"
          >
            {(step === 'approval_pending' || step === 'action_pending') ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : !isConnected ? (
              'Connect Wallet'
            ) : !isCorrectChain ? (
              'Switch Network'
            ) : parsedAmount === 0n ? (
              'Enter Amount'
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                {tab === 'deposit' ? 'Deposit' : 'Withdraw'} {vault.asset.symbol}
              </>
            )}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}