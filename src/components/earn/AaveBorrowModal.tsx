/**
 * Aave V3 Borrow Modal
 * 
 * Handles borrow flow with health factor display.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ExternalLink,
  Repeat,
  Shield,
} from 'lucide-react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChainIcon } from '@/components/common/ChainIcon';
import { RiskBar } from '@/components/common/RiskBar';
import { useAaveBorrow, type UserAccountData } from '@/hooks/useAaveBorrow';
import type { LendingMarket } from '@/hooks/useLendingMarkets';
import { getExplorerTxUrl } from '@/lib/chainConfig';
import { buildSwapLink } from '@/lib/swapDeepLink';

interface AaveBorrowModalProps {
  open: boolean;
  onClose: () => void;
  market: LendingMarket | null;
  accountData: UserAccountData | null;
}

export function AaveBorrowModal({ open, onClose, market, accountData }: AaveBorrowModalProps) {
  const { address } = useAccount();
  const walletChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const navigate = useNavigate();

  const {
    borrowStep,
    borrowError,
    borrow,
    resetBorrowState,
    borrowMarkets,
  } = useAaveBorrow();

  const [amount, setAmount] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount('');
      setShowSuccess(false);
      resetBorrowState();
    }
  }, [open]);

  useEffect(() => {
    if (borrowStep === 'complete') {
      setShowSuccess(true);
    }
  }, [borrowStep]);

  const needsChainSwitch = market && walletChainId !== market.chainId;

  const handleSwitchChain = useCallback(async () => {
    if (!market) return;
    try {
      await switchChainAsync({ chainId: market.chainId });
    } catch { /* user rejected */ }
  }, [market, switchChainAsync]);

  const handleBorrow = useCallback(async () => {
    if (!market || !amount || parseFloat(amount) <= 0) return;

    // Find the borrow market matching this lending market
    const borrowMarket = borrowMarkets.find(
      bm => bm.assetAddress.toLowerCase() === market.assetAddress.toLowerCase() && bm.chainId === market.chainId
    );
    if (!borrowMarket) return;

    await borrow(borrowMarket, amount, 'variable');
  }, [market, amount, borrowMarkets, borrow]);

  if (!market) return null;

  const parsedAmount = parseFloat(amount) || 0;
  const maxBorrow = accountData?.availableBorrowsUsd || 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={market.assetLogo} alt="" className="w-6 h-6 rounded-full" />
            Borrow {market.assetSymbol}
            <Badge variant="outline" className="ml-auto h-5 px-1.5 gap-1 text-[10px]">
              <ChainIcon chainId={market.chainId} size="sm" />
              {market.chainName}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {showSuccess ? (
          <div className="space-y-4 py-4">
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
              <h3 className="text-lg font-semibold">Borrow Successful!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You borrowed {amount} {market.assetSymbol} from Aave V3 on {market.chainName}
              </p>
            </div>

            <div className="glass rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{amount} {market.assetSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Borrow APY</span>
                <span className="font-medium text-warning">{market.borrowAPY.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rate</span>
                <span>Variable</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={onClose}>View Positions</Button>
              <Button variant="outline" className="flex-1" onClick={() => {
                setShowSuccess(false);
                setAmount('');
                resetBorrowState();
              }}>Borrow More</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {needsChainSwitch && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
                <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-warning">Wrong Network</p>
                  <p className="text-xs text-muted-foreground">Switch to {market.chainName}</p>
                </div>
                <Button size="sm" onClick={handleSwitchChain} className="gap-1 h-7 text-xs">Switch</Button>
              </div>
            )}

            {/* Account summary */}
            {accountData && (
              <div className="glass rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Your Collateral</span>
                  <span className="font-medium">${accountData.totalCollateralUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Debt</span>
                  <span className="font-medium text-warning">${accountData.totalDebtUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Available to Borrow</span>
                  <span className="font-medium text-success">${accountData.availableBorrowsUsd.toFixed(2)}</span>
                </div>
                <RiskBar healthFactor={accountData.healthFactorFormatted} showLabel size="sm" />
              </div>
            )}

            {!accountData && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="w-4 h-4" />
                  <span>Supply collateral first to enable borrowing</span>
                </div>
              </div>
            )}

            {/* Borrow rate */}
            <div className="glass rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Variable Borrow APY</div>
              <div className="text-lg font-semibold text-warning">{market.borrowAPY.toFixed(2)}%</div>
            </div>

            {/* Amount input */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Amount to borrow</span>
                {accountData && (
                  <span className="text-muted-foreground">
                    Max: ~${accountData.availableBorrowsUsd.toFixed(2)}
                  </span>
                )}
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

            {borrowStep === 'error' && borrowError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                {borrowError}
              </div>
            )}

            <Button
              className="w-full h-11 gap-2"
              disabled={
                !amount ||
                parsedAmount <= 0 ||
                borrowStep === 'borrowing' ||
                !!needsChainSwitch ||
                (!accountData || accountData.totalCollateralUsd === 0)
              }
              onClick={handleBorrow}
            >
              {borrowStep === 'borrowing' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Borrowing...
                </>
              ) : (
                <>
                  <ArrowDownLeft className="w-4 h-4" />
                  Borrow {market.assetSymbol}
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
