/**
 * Aave V3 Supply Modal
 * 
 * Full supply flow with fee handling, persistent success screen,
 * and swap CTA when balance is low.
 * 
 * CRITICAL: Balance checks use ONLY address+chainId matching (never symbol).
 * Insufficient balance check uses bigint comparison to prevent float errors.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChainIcon } from '@/components/common/ChainIcon';
import { TokenIcon } from '@/components/common/TokenIcon';
import { useAaveSupply } from '@/hooks/useAaveSupply';
import { getExplorerTxUrl } from '@/lib/chainConfig';
import { InlineAcquireSwapPanel } from '@/components/swap/InlineAcquireSwapPanel';
import { ContractsVerificationSection } from '@/components/earn/ContractsVerificationSection';
import { PlatformFeeRow } from '@/components/earn/PlatformFeeRow';
import { useBalancesContext } from '@/providers/BalancesProvider';
import { useBalancesContext } from '@/providers/BalancesProvider';
import type { LendingMarket } from '@/hooks/useLendingMarkets';
import type { AaveMarket } from '@/lib/aaveMarkets';

interface AaveSupplyModalProps {
  open: boolean;
  onClose: () => void;
  market: LendingMarket | null;
}

export function AaveSupplyModal({ open, onClose, market }: AaveSupplyModalProps) {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { getBalance } = useBalancesContext();

  const [amount, setAmount] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Convert LendingMarket to AaveMarket for the hook
  const aaveMarket: AaveMarket | null = market ? {
    chainId: market.chainId,
    symbol: market.assetSymbol,
    name: market.assetName,
    address: market.assetAddress,
    decimals: market.decimals,
    logo: market.assetLogo,
  } : null;

  const {
    supplyState,
    balance: onChainBalance,
    balanceFormatted,
    isLoading,
    supply,
    resetState,
    refetchBalance,
  } = useAaveSupply(aaveMarket);

  // Reset on open
  useEffect(() => {
    if (open) {
      setAmount('');
      setShowSuccess(false);
      resetState();
      refetchBalance();
    }
  }, [open]);

  // Show persistent success screen
  useEffect(() => {
    if (supplyState.step === 'complete') {
      setShowSuccess(true);
    }
  }, [supplyState.step]);

  const needsChainSwitch = market && walletChainId !== market.chainId;
  const isChainMatch = market ? walletChainId === market.chainId : false;

  const handleSwitchChain = useCallback(async () => {
    if (!market) return;
    try {
      await switchChainAsync({ chainId: market.chainId });
    } catch { /* user rejected */ }
  }, [market, switchChainAsync]);

  const handleSupply = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    await supply(amount);
  }, [amount, supply]);

  // ─── CANONICAL BALANCE: address + chainId ONLY ───
  // When on same chain, prefer on-chain read (most accurate).
  // Otherwise use BalancesProvider address-based lookup.
  const canonicalBalance = useMemo(() => {
    if (!market) return { raw: 0n, formatted: '0', display: 0 };
    
    // On-chain read is only valid when wallet is on the same chain
    if (isChainMatch && onChainBalance !== undefined && onChainBalance > 0n) {
      return {
        raw: onChainBalance,
        formatted: formatUnits(onChainBalance, market.decimals),
        display: parseFloat(formatUnits(onChainBalance, market.decimals)),
      };
    }

    // BalancesProvider: strict address+chainId lookup
    const sb = getBalance(market.chainId, market.assetAddress);
    if (sb && sb.balance > 0) {
      try {
        const raw = parseUnits(sb.balanceFormatted, market.decimals);
        return { raw, formatted: sb.balanceFormatted, display: sb.balance };
      } catch {
        return { raw: 0n, formatted: sb.balanceFormatted, display: sb.balance };
      }
    }

    return { raw: 0n, formatted: '0', display: 0 };
  }, [market, isChainMatch, onChainBalance, getBalance]);

  // ─── INSUFFICIENT CHECK: bigint comparison ───
  const isInsufficientBalance = useMemo(() => {
    if (!market || !amount) return false;
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return false;
    try {
      const inputRaw = parseUnits(amount, market.decimals);
      return inputRaw > canonicalBalance.raw;
    } catch {
      return true;
    }
  }, [amount, market, canonicalBalance.raw]);

  const handleSetMax = useCallback(() => {
    if (canonicalBalance.display > 0) {
      setAmount(canonicalBalance.formatted);
    }
  }, [canonicalBalance]);


  if (!market) return null;

  const parsedAmount = parseFloat(amount) || 0;
  const explorerUrl = supplyState.supplyTxHash ? getExplorerTxUrl(market.chainId, supplyState.supplyTxHash) : '';

  const stepLabel = {
    idle: 'Supply',
    approving: 'Approving Aave Pool...',
    supplying: 'Supplying...',
    complete: 'Complete',
    error: 'Error',
  }[supplyState.step];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TokenIcon address={market.assetAddress} symbol={market.assetSymbol} chainId={market.chainId} logoUrl={market.assetLogo} size="sm" className="w-6 h-6" />
            Supply {market.assetSymbol}
            <Badge variant="outline" className="ml-auto h-5 px-1.5 gap-1 text-[10px]">
              <ChainIcon chainId={market.chainId} size="sm" />
              {market.chainName}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {showSuccess ? (
          /* ─── Success Screen ─── */
          <div className="space-y-3 py-3">
            <div className="text-center">
              <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-2" />
              <h3 className="text-base font-semibold">Supply Successful!</h3>
              <p className="text-xs text-muted-foreground mt-1">
                You supplied {amount} {market.assetSymbol} to Aave V3 on {market.chainName}
              </p>
            </div>

            <div className="glass rounded-lg p-2.5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{amount} {market.assetSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Supply APY</span>
                <span className="font-medium text-success">{market.supplyAPY.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network</span>
                <span className="flex items-center gap-1">
                  <ChainIcon chainId={market.chainId} size="sm" />
                  {market.chainName}
                </span>
              </div>
              {supplyState.supplyTxHash && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Transaction</span>
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                  >
                    {supplyState.supplyTxHash.slice(0, 10)}...
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-9" onClick={onClose}>
                View Positions
              </Button>
              <Button size="sm" variant="outline" className="flex-1 h-9" onClick={() => {
                setShowSuccess(false);
                setAmount('');
                resetState();
                refetchBalance();
              }}>
                Supply More
              </Button>
            </div>
          </div>
        ) : (
          /* ─── Supply Form ─── */
          <div className="space-y-3 py-1">
            {/* Wrong chain */}
            {needsChainSwitch && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/30">
                <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-warning">Wrong Network</p>
                  <p className="text-[11px] text-muted-foreground">Switch to {market.chainName} to supply</p>
                </div>
                <Button size="sm" onClick={handleSwitchChain} className="gap-1 h-7 text-xs">
                  Switch
                </Button>
              </div>
            )}

            {/* Market info */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="glass rounded-lg p-2.5">
                <div className="text-[10px] text-muted-foreground">Supply APY</div>
                <div className="text-base font-semibold text-success">{market.supplyAPY.toFixed(2)}%</div>
              </div>
              <div className="glass rounded-lg p-2.5">
                <div className="text-[10px] text-muted-foreground">Total Market Size</div>
                <div className="text-base font-semibold">
                  {market.tvl ? `$${(market.tvl / 1e6).toFixed(1)}M` : '—'}
                </div>
              </div>
            </div>

            {/* Amount input */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Amount to supply</span>
                <button
                  className="text-primary hover:underline text-[11px]"
                  onClick={handleSetMax}
                >
                  Balance: {canonicalBalance.display > 0 ? canonicalBalance.display.toFixed(6) : '0'} {market.assetSymbol}
                </button>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-16 h-10 text-base"
                  inputMode="decimal"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                  {market.assetSymbol}
                </span>
              </div>
            </div>

            {/* Inline swap when insufficient or zero balance */}
            {(canonicalBalance.display === 0 || isInsufficientBalance) && !needsChainSwitch && parsedAmount > 0 && (
              <InlineAcquireSwapPanel
                targetChainId={market.chainId}
                targetTokenAddress={market.assetAddress}
                targetSymbol={market.assetSymbol}
                closeParentOnSwap={onClose}
              />
            )}
            {canonicalBalance.display === 0 && !needsChainSwitch && parsedAmount === 0 && (
              <InlineAcquireSwapPanel
                targetChainId={market.chainId}
                targetTokenAddress={market.assetAddress}
                targetSymbol={market.assetSymbol}
                closeParentOnSwap={onClose}
              />
            )}

            {/* Error message */}
            {supplyState.step === 'error' && supplyState.error && (
              <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                {supplyState.error}
              </div>
            )}

            {/* Supply button */}
            <Button
              className="w-full h-10 gap-2 text-sm"
              disabled={
                !amount ||
                parsedAmount <= 0 ||
                isInsufficientBalance ||
                isLoading ||
                !!needsChainSwitch
              }
              onClick={handleSupply}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {stepLabel}
                </>
              ) : isInsufficientBalance ? (
                'Insufficient Balance'
              ) : (
                <>
                  <ArrowUpRight className="w-4 h-4" />
                  Supply {market.assetSymbol}
                </>
              )}
            </Button>

            {/* Contracts section */}
            <ContractsVerificationSection
              chainId={market.chainId}
              chainName={market.chainName}
              underlyingAddress={market.assetAddress}
              aTokenAddress={market.aTokenAddress}
              variableDebtTokenAddress={market.variableDebtTokenAddress}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
