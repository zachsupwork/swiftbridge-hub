/**
 * Aave V3 Borrow Modal
 * 
 * Handles borrow flow with health factor display.
 * Balance checks use strict address+chainId (never symbol).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowDownLeft,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';


import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChainIcon } from '@/components/common/ChainIcon';
import { TokenIcon } from '@/components/common/TokenIcon';
import { RiskBar } from '@/components/common/RiskBar';
import { useAaveBorrow, type UserAccountData } from '@/hooks/useAaveBorrow';
import { useBalancesContext } from '@/providers/BalancesProvider';
import { InlineAcquireSwapPanel } from '@/components/swap/InlineAcquireSwapPanel';
import { ContractsVerificationSection } from '@/components/earn/ContractsVerificationSection';
import { PlatformFeeRow } from '@/components/earn/PlatformFeeRow';
import type { LendingMarket } from '@/hooks/useLendingMarkets';
import { getExplorerTxUrl } from '@/lib/chainConfig';

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
  const { getBalance } = useBalancesContext();

  const {
    borrowStep,
    borrowError,
    borrow,
    resetBorrowState,
    fetchReserveTokenAddresses,
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

    // Build a minimal BorrowMarket from the LendingMarket data.
    // For variableDebtTokenAddress, we try fetchReserveTokenAddresses; if it fails
    // we fall back to the address already stored on the market (may be zero).
    let variableDebtTokenAddress = market.variableDebtTokenAddress;
    try {
      const addrs = await fetchReserveTokenAddresses(market.chainId, market.assetAddress);
      if (addrs) variableDebtTokenAddress = addrs.variableDebtTokenAddress;
    } catch { /* use fallback */ }

    const borrowMarket = {
      id: market.id,
      chainId: market.chainId,
      chainName: market.chainName,
      chainLogo: market.chainLogo,
      assetSymbol: market.assetSymbol,
      assetName: market.assetName,
      assetAddress: market.assetAddress,
      assetLogo: market.assetLogo,
      decimals: market.decimals,
      variableBorrowAPY: market.borrowAPY,
      stableBorrowAPY: 0,
      stableBorrowEnabled: false,
      borrowingEnabled: market.borrowingEnabled,
      availableLiquidity: market.availableLiquidityUsd,
      availableLiquidityUsd: market.availableLiquidityUsd,
      ltv: market.ltv,
      liquidationThreshold: market.liquidationThreshold,
      liquidationBonus: market.liquidationBonus,
      priceInUsd: market.priceUsd,
      variableDebtTokenAddress,
      stableDebtTokenAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    };

    await borrow(borrowMarket, amount, 'variable');
  }, [market, amount, borrow, fetchReserveTokenAddresses]);


  if (!market) return null;

  // ADDRESS-ONLY balance lookup
  const sharedBal = getBalance(market.chainId, market.assetAddress);
  const walletBalance = sharedBal ? sharedBal.balance : 0;

  const parsedAmount = parseFloat(amount) || 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TokenIcon address={market.assetAddress} symbol={market.assetSymbol} chainId={market.chainId} logoUrl={market.assetLogo} size="sm" className="w-6 h-6" />
            Borrow {market.assetSymbol}
            <Badge variant="outline" className="ml-auto h-5 px-1.5 gap-1 text-[10px]">
              <ChainIcon chainId={market.chainId} size="sm" />
              {market.chainName}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {showSuccess ? (
          <div className="space-y-3 py-3">
            <div className="text-center">
              <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-2" />
              <h3 className="text-base font-semibold">Borrow Successful!</h3>
              <p className="text-xs text-muted-foreground mt-1">
                You borrowed {amount} {market.assetSymbol} from Aave V3 on {market.chainName}
              </p>
            </div>

            <div className="glass rounded-lg p-2.5 space-y-1.5 text-xs">
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
              <Button size="sm" className="flex-1 h-9" onClick={onClose}>View Positions</Button>
              <Button size="sm" variant="outline" className="flex-1 h-9" onClick={() => {
                setShowSuccess(false);
                setAmount('');
                resetBorrowState();
              }}>Borrow More</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            {needsChainSwitch && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/30">
                <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-warning">Wrong Network</p>
                  <p className="text-[11px] text-muted-foreground">Switch to {market.chainName}</p>
                </div>
                <Button size="sm" onClick={handleSwitchChain} className="gap-1 h-7 text-xs">Switch</Button>
              </div>
            )}

            {/* Account summary */}
            {accountData && (
              <div className="glass rounded-lg p-2.5 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Your Collateral</span>
                  <span className="font-medium">${accountData.totalCollateralUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Current Debt</span>
                  <span className="font-medium text-warning">${accountData.totalDebtUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Available to Borrow</span>
                  <span className="font-medium text-success">${accountData.availableBorrowsUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Wallet Balance</span>
                  <span className="font-medium">
                    {walletBalance > 0 ? `${walletBalance.toFixed(6)} ${market.assetSymbol}` : `0 ${market.assetSymbol}`}
                  </span>
                </div>
                <RiskBar healthFactor={accountData.healthFactorFormatted} showLabel size="sm" />
              </div>
            )}

            {!accountData && (
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-2 text-xs text-foreground">
                    <Shield className="w-4 h-4 text-primary" />
                    <span>Supply collateral first to enable borrowing</span>
                  </div>
                </div>
                <InlineAcquireSwapPanel
                  targetChainId={market.chainId}
                  targetTokenAddress={market.assetAddress}
                  targetSymbol={market.assetSymbol}
                  closeParentOnSwap={onClose}
                />
              </div>
            )}

            {/* Borrow rate */}
            <div className="glass rounded-lg p-2.5">
              <div className="text-[10px] text-muted-foreground">Variable Borrow APY</div>
              <div className="text-base font-semibold text-warning">{market.borrowAPY.toFixed(2)}%</div>
            </div>

            {/* Amount input */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Amount to borrow</span>
                {accountData && (
                  <span className="text-muted-foreground text-[11px]">
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
                  className="pr-16 h-10 text-base"
                  inputMode="decimal"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                  {market.assetSymbol}
                </span>
              </div>
            </div>

            {/* Platform fee disclosure */}
            {parsedAmount > 0 && (
              <PlatformFeeRow
                amount={amount}
                decimals={market.decimals}
                symbol={market.assetSymbol}
                priceUsd={market.priceUsd}
              />
            )}

            {borrowStep === 'error' && borrowError && (
              <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                {borrowError}
              </div>
            )}

            <Button
              className="w-full h-10 gap-2 text-sm"
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
