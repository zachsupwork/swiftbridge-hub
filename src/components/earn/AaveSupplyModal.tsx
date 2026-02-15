/**
 * Aave V3 Supply Modal
 * 
 * Full supply flow with fee handling, persistent success screen,
 * and swap CTA when balance is low.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ExternalLink,
  Repeat,
  X,
} from 'lucide-react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { formatUnits } from 'viem';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChainIcon } from '@/components/common/ChainIcon';
import { useAaveSupply } from '@/hooks/useAaveSupply';
import { getExplorerTxUrl } from '@/lib/chainConfig';
import { buildSwapLink } from '@/lib/swapDeepLink';
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
  const navigate = useNavigate();

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
    balance,
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

  const handleSetMax = useCallback(() => {
    const bal = parseFloat(balanceFormatted);
    if (bal > 0) setAmount(bal.toString());
  }, [balanceFormatted]);

  const goToSwap = useCallback(() => {
    if (!market) return;
    const link = buildSwapLink({
      chainId: market.chainId,
      toTokenAddress: market.assetAddress,
      toTokenSymbol: market.assetSymbol,
      ref: 'earn',
      action: 'swap',
    });
    onClose();
    navigate(link);
  }, [market, navigate, onClose]);

  if (!market) return null;

  const parsedBalance = parseFloat(balanceFormatted);
  const parsedAmount = parseFloat(amount) || 0;
  const isInsufficientBalance = parsedAmount > parsedBalance;
  const explorerUrl = supplyState.supplyTxHash ? getExplorerTxUrl(market.chainId, supplyState.supplyTxHash) : '';

  const stepLabel = {
    idle: 'Supply',
    approving_fee: 'Approving Fee...',
    transferring_fee: 'Processing Fee...',
    approving_aave: 'Approving Aave...',
    supplying: 'Supplying...',
    complete: 'Complete',
    error: 'Error',
  }[supplyState.step];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={market.assetLogo} alt="" className="w-6 h-6 rounded-full" />
            Supply {market.assetSymbol}
            <Badge variant="outline" className="ml-auto h-5 px-1.5 gap-1 text-[10px]">
              <ChainIcon chainId={market.chainId} size="sm" />
              {market.chainName}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {showSuccess ? (
          /* ─── Success Screen ─── */
          <div className="space-y-4 py-4">
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
              <h3 className="text-lg font-semibold">Supply Successful!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You supplied {amount} {market.assetSymbol} to Aave V3 on {market.chainName}
              </p>
            </div>

            <div className="glass rounded-lg p-3 space-y-2 text-sm">
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
                    className="text-primary hover:underline flex items-center gap-1 text-xs"
                  >
                    {supplyState.supplyTxHash.slice(0, 10)}...
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={onClose}>
                View Positions
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => {
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
          <div className="space-y-4 py-2">
            {/* Wrong chain */}
            {needsChainSwitch && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
                <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-warning">Wrong Network</p>
                  <p className="text-xs text-muted-foreground">Switch to {market.chainName} to supply</p>
                </div>
                <Button size="sm" onClick={handleSwitchChain} className="gap-1 h-7 text-xs">
                  Switch
                </Button>
              </div>
            )}

            {/* Market info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="glass rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Supply APY</div>
                <div className="text-lg font-semibold text-success">{market.supplyAPY.toFixed(2)}%</div>
              </div>
              <div className="glass rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Total Market Size</div>
                <div className="text-lg font-semibold">
                  {market.tvl ? `$${(market.tvl / 1e6).toFixed(1)}M` : '—'}
                </div>
              </div>
            </div>

            {/* Amount input */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Amount to supply</span>
                <button
                  className="text-primary hover:underline"
                  onClick={handleSetMax}
                >
                  Balance: {parsedBalance > 0 ? parsedBalance.toFixed(6) : '0'} {market.assetSymbol}
                </button>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-16 h-12 text-lg"
                  inputMode="decimal"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                  {market.assetSymbol}
                </span>
              </div>
            </div>

            {/* Swap CTA if no balance */}
            {parsedBalance === 0 && !needsChainSwitch && (
              <Button
                variant="outline"
                className="w-full gap-2 text-sm"
                onClick={goToSwap}
              >
                <Repeat className="w-4 h-4" />
                Get {market.assetSymbol} via Swap
              </Button>
            )}

            {/* Error message */}
            {supplyState.step === 'error' && supplyState.error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                {supplyState.error}
              </div>
            )}

            {/* Supply button */}
            <Button
              className="w-full h-11 gap-2"
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
