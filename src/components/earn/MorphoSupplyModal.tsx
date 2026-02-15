/**
 * Morpho Supply Modal
 * 
 * Detailed modal for supplying the LOAN TOKEN to a Morpho Blue market.
 * Explains clearly that supply goes to ONE market, not split across tokens.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  X, 
  AlertTriangle, 
  Loader2, 
  Check, 
  TrendingUp,
  Info,
  ExternalLink,
  HelpCircle,
  ArrowRight,
  Zap,
  Repeat,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  MORPHO_BLUE_ABI, 
  MORPHO_BLUE_ADDRESS,
  marketToParams,
  type ActionStep,
  getStepDescription,
} from '@/lib/morpho/blueActions';
import { getMorphoChainConfig } from '@/lib/morpho/config';
import type { MorphoMarket } from '@/lib/morpho/types';
import { toast } from '@/hooks/use-toast';
import { CHAIN_EXPLORERS, supportedChains } from '@/lib/wagmiConfig';
import { buildSwapLink, getDefaultFromToken } from '@/lib/swapDeepLink';
import { useBalancesContext } from '@/providers/BalancesProvider';
import { SyncBalancesButton } from '@/components/common/SyncBalancesButton';

const chainNameMap = new Map(supportedChains.map(c => [c.id, c.name]));

interface MorphoSupplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: MorphoMarket | null;
  existingSupply?: bigint;
  onSuccess?: () => void;
}

export function MorphoSupplyModal({
  isOpen,
  onClose,
  market,
  existingSupply = 0n,
  onSuccess,
}: MorphoSupplyModalProps) {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const navigate = useNavigate();
  const { tokenBalances: portfolioBalances, isLoading: balSyncing, lastUpdated: balLastUpdated, refreshBalances } = useBalancesContext();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<ActionStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [approvalTxHash, setApprovalTxHash] = useState<Hash | undefined>();
  const [actionTxHash, setActionTxHash] = useState<Hash | undefined>();
  const [showExplanation, setShowExplanation] = useState(false);

  const token = market?.loanAsset;
  const decimals = token?.decimals || 18;
  const tokenAddress = token?.address as `0x${string}` | undefined;
  const chainConfig = market ? getMorphoChainConfig(market.chainId) : null;

  // Read token balance
  const { data: tokenBalance, refetch: refetchBalance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: market?.chainId,
    query: { enabled: !!address && !!tokenAddress && isOpen },
  });

  // Read token allowance
  const { data: morphoAllowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, MORPHO_BLUE_ADDRESS] : undefined,
    chainId: market?.chainId,
    query: { enabled: !!address && !!tokenAddress && isOpen },
  });

  // Wait for transactions
  const { isSuccess: isApprovalConfirmed } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
    chainId: market?.chainId,
  });

  const { isSuccess: isActionConfirmed } = useWaitForTransactionReceipt({
    hash: actionTxHash,
    chainId: market?.chainId,
  });

  // Parse amount
  const parsedAmount = useMemo(() => {
    try {
      return parseUnits(amount || '0', decimals);
    } catch {
      return 0n;
    }
  }, [amount, decimals]);

  // Check if needs approval
  const needsApproval = useMemo(() => {
    if (!morphoAllowance || parsedAmount === 0n) return false;
    return morphoAllowance < parsedAmount;
  }, [morphoAllowance, parsedAmount]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setStep('idle');
      setError(null);
      setApprovalTxHash(undefined);
      setActionTxHash(undefined);
    }
  }, [isOpen]);

  const isWrongChain = market && walletChainId !== market.chainId;

  // Use onchain balance if available, else fallback to unified portfolio balance
  const portfolioBalance = useMemo(() => {
    if (!token || !market) return undefined;
    return portfolioBalances.find(
      (tb) => tb.chainId === market.chainId &&
        tb.token.symbol.toUpperCase() === token.symbol.toUpperCase() &&
        tb.balance > 0
    );
  }, [portfolioBalances, token, market]);

  const effectiveBalance = tokenBalance ?? (portfolioBalance ? BigInt(Math.floor(portfolioBalance.balance * (10 ** decimals))) : undefined);
  const balanceFormatted = effectiveBalance ? formatUnits(effectiveBalance, decimals) : '0';
  const balanceSource = tokenBalance !== undefined ? 'onchain' : (portfolioBalance ? 'portfolio' : 'none');
  const hasNoBalance = !effectiveBalance || effectiveBalance === 0n;
  const isValidAmount = parsedAmount > 0n && parsedAmount <= (effectiveBalance || 0n);
  const isInsufficientBalance = parsedAmount > 0n && parsedAmount > (effectiveBalance || 0n);

  // Set max amount — use effective balance
  const handleSetMax = useCallback(() => {
    if (effectiveBalance && effectiveBalance > 0n) {
      setAmount(formatUnits(effectiveBalance, decimals));
    }
  }, [effectiveBalance, decimals]);

  // Execute supply
  const executeSupply = useCallback(async () => {
    if (!market || !address || !tokenAddress || parsedAmount === 0n) return;

    try {
      setError(null);
      const marketParams = marketToParams(market);

      // Step 1: Approval if needed
      if (needsApproval) {
        setStep('approval');
        const approvalTx = await writeContractAsync({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [MORPHO_BLUE_ADDRESS, parsedAmount],
          chainId: market.chainId,
        } as any);
        setApprovalTxHash(approvalTx);
        setStep('approval_pending');
        await new Promise(resolve => setTimeout(resolve, 3000));
        await refetchAllowance();
      }

      // Step 2: Supply
      setStep('action');
      const txHash = await writeContractAsync({
        address: MORPHO_BLUE_ADDRESS,
        abi: MORPHO_BLUE_ABI,
        functionName: 'supply',
        args: [marketParams, parsedAmount, 0n, address, '0x'],
        chainId: market.chainId,
      } as any);

      setActionTxHash(txHash);
      setStep('action_pending');

    } catch (err: unknown) {
      console.error('Supply failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Transaction failed';
      setError(errorMessage);
      setStep('error');
    }
  }, [market, address, tokenAddress, parsedAmount, needsApproval, writeContractAsync, refetchAllowance]);

  // Handle confirmations
  useEffect(() => {
    if (isApprovalConfirmed && step === 'approval_pending') {
      refetchAllowance();
    }
  }, [isApprovalConfirmed, step, refetchAllowance]);

  useEffect(() => {
    if (isActionConfirmed && step === 'action_pending') {
      setStep('success');
      refetchBalance();
      toast({
        title: 'Supply Successful',
        description: `You supplied ${amount} ${token?.symbol} to this market.`,
      });
      onSuccess?.();
    }
  }, [isActionConfirmed, step, amount, token?.symbol, refetchBalance, onSuccess]);

  const isLoading = step !== 'idle' && step !== 'success' && step !== 'error';
  const canExecute = parsedAmount > 0n && !isLoading && !isWrongChain && isConnected && parsedAmount <= (effectiveBalance || 0n);

  // Format helpers
  const formatAPY = (apy: number) => {
    if (!Number.isFinite(apy) || apy === 0) return '—';
    const normalized = apy <= 1.5 ? apy * 100 : apy;
    return `${normalized.toFixed(2)}%`;
  };

  const formatUsd = (value: number) => {
    if (!Number.isFinite(value) || value === 0) return '$0';
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  if (!market || !token) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 overflow-hidden">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6 space-y-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-success" />
                Supply {token.symbol}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-bold">{token.symbol}</Badge>
                <span>{chainConfig?.label}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-success font-medium">{formatAPY(market.supplyApy)} APY</span>
              </DialogDescription>
            </DialogHeader>

            {/* Wrong chain warning */}
            {isWrongChain && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-warning">Wrong Network</p>
                  <p className="text-muted-foreground text-xs">Please switch to {chainConfig?.label} in your wallet to continue.</p>
                </div>
              </div>
            )}

            {/* Educational Explanation */}
            <Collapsible open={showExplanation} onOpenChange={setShowExplanation}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Info className="w-4 h-4 text-primary" />
                    What happens when you supply?
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {showExplanation ? 'Hide' : 'Show'}
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-success">1</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">You supply the loan asset ({token.symbol})</p>
                      <p className="text-xs text-muted-foreground">
                        Your {token.symbol} goes into THIS specific market, not spread across multiple tokens.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-success">2</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Borrowers borrow your {token.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        They must deposit {market.collateralAsset?.symbol || 'collateral'} first. You earn interest from their borrow fees.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-success">3</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Withdraw anytime (if liquidity available)</p>
                      <p className="text-xs text-muted-foreground">
                        Your supply + earned interest. Liquidity depends on utilization.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 p-2 rounded bg-warning/10 border border-warning/20">
                    <p className="text-xs text-warning flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Note:</strong> Supplying the loan token does NOT give you borrow power. 
                        To borrow, you must deposit collateral in this market.
                      </span>
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Market Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="text-xs text-muted-foreground mb-1">Supply APY</div>
                <div className="text-lg font-semibold text-success">{formatAPY(market.supplyApy)}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="text-xs text-muted-foreground mb-1">Utilization</div>
                <div className="text-lg font-semibold">{market.utilization.toFixed(1)}%</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="text-xs text-muted-foreground mb-1">Total Supplied</div>
                <div className="text-sm font-medium">{formatUsd(market.totalSupplyUsd)}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="text-xs text-muted-foreground mb-1">Available Liquidity</div>
                <div className="text-sm font-medium">{formatUsd(market.availableLiquidityUsd)}</div>
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  Amount to Supply
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs max-w-[200px]">
                          Enter the amount of {token.symbol} you want to supply to earn interest.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSetMax}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Balance: {balSyncing && !effectiveBalance ? '— (syncing)' : `${parseFloat(balanceFormatted).toFixed(4)} ${token.symbol}`}
                    {balanceSource === 'portfolio' && <span className="text-muted-foreground">(cached)</span>}
                  </button>
                  <SyncBalancesButton
                    isLoading={balSyncing}
                    lastUpdated={balLastUpdated}
                    onRefresh={() => { refreshBalances(); refetchBalance(); }}
                    variant="inline"
                  />
                </div>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={isLoading}
                  className="text-lg font-mono pr-20"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className="text-sm font-bold">{token.symbol}</span>
                </div>
              </div>
              {isInsufficientBalance && (
                <p className="text-xs text-destructive">
                  {hasNoBalance ? `No ${token.symbol} balance` : 'Insufficient balance'}
                </p>
              )}
              {hasNoBalance && (
                <>
                  <button
                    onClick={() => {
                      const link = buildSwapLink({
                        chainId: market.chainId,
                        toTokenAddress: token.address,
                        toTokenSymbol: token.symbol,
                        fromTokenAddress: getDefaultFromToken(market.chainId),
                        marketId: market.uniqueKey,
                        ref: 'earn',
                        action: 'supply',
                      });
                      onClose();
                      navigate(link);
                    }}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Repeat className="w-3 h-3" />
                    Swap to get {token.symbol}
                  </button>
                  {/* Cross-chain balance hint */}
                  {(() => {
                    const otherChains = portfolioBalances.filter(
                      (tb) => tb.token.symbol.toUpperCase() === token.symbol.toUpperCase() && tb.chainId !== market.chainId && tb.balance > 0
                    );
                    if (otherChains.length === 0) return null;
                    return (
                      <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 space-y-1.5">
                        <p className="text-xs text-muted-foreground">
                          You have <strong>{token.symbol}</strong> on:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {otherChains.map((tb) => (
                            <Badge key={tb.chainId} variant="outline" className="text-[10px]">
                              {chainNameMap.get(tb.chainId) || `Chain ${tb.chainId}`} · {tb.balanceFormatted}
                            </Badge>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs gap-1 h-7"
                          onClick={() => {
                            const best = otherChains.reduce((a, b) => a.balanceUSD > b.balanceUSD ? a : b);
                            const link = buildSwapLink({
                              chainId: best.chainId,
                              toTokenAddress: token.address,
                              toTokenSymbol: token.symbol,
                              fromTokenAddress: best.token.address,
                              ref: 'earn',
                              action: 'supply',
                            });
                            onClose();
                            navigate(link);
                          }}
                        >
                          <Repeat className="w-3 h-3" />
                          Bridge from chain with balance
                        </Button>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            {/* Transaction Preview */}
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Zap className="w-4 h-4 text-primary" />
                Transaction Preview
              </div>
              
              {!isValidAmount ? (
                <div className="flex items-center gap-3 p-2 rounded bg-muted/30">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-muted text-muted-foreground">
                    —
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isInsufficientBalance 
                      ? `Insufficient ${token.symbol} balance` 
                      : 'Enter an amount to preview'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Step 1: Approval */}
                  <div className={cn(
                    "flex items-center gap-3 p-2 rounded",
                    needsApproval ? "bg-warning/10" : "bg-success/10"
                  )}>
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold",
                      needsApproval ? "bg-warning/20 text-warning" : "bg-success/20 text-success"
                    )}>
                      {needsApproval ? '1' : <Check className="w-3 h-3" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{needsApproval ? 'Approve token spending' : 'Allowance sufficient'}</p>
                      <p className="text-xs text-muted-foreground">
                        {needsApproval ? `Allow Morpho to use your ${token.symbol}` : 'No approval needed'}
                      </p>
                    </div>
                  </div>

                  {/* Step 2: Supply */}
                  <div className="flex items-center gap-3 p-2 rounded bg-primary/10">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-primary/20 text-primary">
                      {needsApproval ? '2' : '1'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">Supply {amount} {token.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        Your position will increase by this amount
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-border/30">
                <p className="text-xs text-muted-foreground">
                  No platform fee on Earn actions. Fees only apply to swap/bridge.
                </p>
              </div>
            </div>

            {/* Transaction Status */}
            {step !== 'idle' && (
              <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                <div className="flex items-center gap-2">
                  {step === 'success' ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : step === 'error' ? (
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  )}
                  <span className="text-sm font-medium">
                    {getStepDescription(step, 'supply')}
                  </span>
                </div>
                
                {actionTxHash && (
                  <a
                    href={`${CHAIN_EXPLORERS[market.chainId] || 'https://etherscan.io/tx/'}${actionTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View transaction
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Action Button */}
            <Button
              onClick={executeSupply}
              disabled={!canExecute}
              className="w-full gap-2"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {getStepDescription(step, 'supply')}
                </>
              ) : step === 'success' ? (
                <>
                  <Check className="w-4 h-4" />
                  Supply Complete
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4" />
                  Supply {token.symbol}
                </>
              )}
            </Button>

            {/* Post-supply CTA */}
            {step === 'success' && market.collateralAsset && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm text-center">
                  Want to borrow? You need to deposit <strong>{market.collateralAsset.symbol}</strong> as collateral first.
                </p>
                <Button variant="outline" className="w-full mt-2" onClick={onClose}>
                  Go to Borrow
                </Button>
              </div>
            )}

            {/* Disclaimer */}
            <p className="text-xs text-muted-foreground text-center">
              Non-custodial. Smart contract risk. APY is variable.
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
