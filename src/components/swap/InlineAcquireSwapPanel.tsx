/**
 * InlineAcquireSwapPanel
 * 
 * Compact embedded panel for acquiring a specific token.
 * Shows quote inline, and either opens the swap intent drawer
 * for execution or navigates to /swap prefilled.
 * Renders in-place inside modals/drawers.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Loader2, CheckCircle2, AlertTriangle, X, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TokenIcon } from '@/components/common/TokenIcon';
import { ChainIcon } from '@/components/common/ChainIcon';
import { useBalancesContext } from '@/providers/BalancesProvider';
import { getRoutes, type Route } from '@/lib/lifiClient';
import { getChainName } from '@/lib/wagmiConfig';
import { openSwapIntent } from '@/lib/swapIntent';
import { cn } from '@/lib/utils';
import type { PortfolioTokenBalance } from '@/hooks/useBalances';

export interface InlineAcquireSwapPanelProps {
  targetChainId: number;
  targetTokenAddress: string;
  targetSymbol: string;
  defaultFromChainId?: number;
  onSwapComplete?: () => void;
  onClose?: () => void;
  /** If true, close the parent modal before opening swap intent */
  closeParentOnSwap?: () => void;
}

type PanelState = 'input' | 'quoting' | 'quoted' | 'error';

const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'USDC.E', 'BUSD']);

export function InlineAcquireSwapPanel({
  targetChainId,
  targetTokenAddress,
  targetSymbol,
  defaultFromChainId,
  onSwapComplete,
  onClose,
  closeParentOnSwap,
}: InlineAcquireSwapPanelProps) {
  const { address, isConnected } = useAccount();
  const { tokenBalances } = useBalancesContext();

  const [state, setState] = useState<PanelState>('input');
  const [amount, setAmount] = useState('');
  const [route, setRoute] = useState<Route | null>(null);
  const [error, setError] = useState('');

  // Auto-select best FROM token: prefer stables, then highest USD balance
  const bestFromToken = useMemo(() => {
    if (!tokenBalances.length) return null;
    const eligible = tokenBalances.filter(tb =>
      tb.balanceUSD > 0.5 &&
      !(tb.chainId === targetChainId && tb.token.address.toLowerCase() === targetTokenAddress.toLowerCase())
    );
    if (!eligible.length) return null;
    const stables = eligible.filter(tb => STABLE_SYMBOLS.has(tb.token.symbol.toUpperCase()));
    if (stables.length) return stables.sort((a, b) => b.balanceUSD - a.balanceUSD)[0];
    return eligible.sort((a, b) => b.balanceUSD - a.balanceUSD)[0];
  }, [tokenBalances, targetChainId, targetTokenAddress]);

  const [selectedFrom, setSelectedFrom] = useState<PortfolioTokenBalance | null>(null);

  useEffect(() => {
    if (bestFromToken && !selectedFrom) {
      setSelectedFrom(bestFromToken);
    }
  }, [bestFromToken]);

  const fromToken = selectedFrom || bestFromToken;

  const handleQuote = useCallback(async () => {
    if (!fromToken || !amount || !address) return;
    const parsedAmt = parseFloat(amount);
    if (parsedAmt <= 0 || parsedAmt > fromToken.balance) return;

    setState('quoting');
    setError('');
    try {
      const fromAmount = parseUnits(amount, fromToken.token.decimals).toString();
      const result = await getRoutes({
        fromChainId: fromToken.chainId,
        toChainId: targetChainId,
        fromTokenAddress: fromToken.token.address,
        toTokenAddress: targetTokenAddress,
        fromAmount,
        fromAddress: address,
        toAddress: address,
        slippage: 0.005,
      });
      if (result.routes.length === 0) {
        setError('No routes found. Try a different amount.');
        setState('error');
        return;
      }
      setRoute(result.routes[0]);
      setState('quoted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get quote');
      setState('error');
    }
  }, [fromToken, amount, address, targetChainId, targetTokenAddress]);

  const handleExecuteViaSwapPage = useCallback(() => {
    // Open swap intent drawer prefilled — this reuses the full swap execution system
    if (closeParentOnSwap) closeParentOnSwap();
    openSwapIntent({
      intentType: 'acquire_token',
      targetChainId,
      targetTokenAddress,
      targetSymbol,
      sourceChainId: fromToken?.chainId,
      sourceTokenAddress: fromToken?.token.address,
      sourceSymbol: fromToken?.token.symbol,
      suggestedAmount: amount || undefined,
      returnTo: { view: 'earn' },
    });
  }, [targetChainId, targetTokenAddress, targetSymbol, fromToken, amount, closeParentOnSwap]);

  const targetChainName = getChainName(targetChainId);

  // No eligible tokens
  if (!fromToken && state === 'input') {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Get {targetSymbol}</span>
          {onClose && <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <p className="text-[11px] text-muted-foreground">No swappable tokens found. Deposit tokens first.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium">
            Get {targetSymbol}
          </span>
          <Badge variant="outline" className="h-4 px-1 gap-0.5 text-[9px]">
            <ChainIcon chainId={targetChainId} size="sm" className="w-3 h-3" />
            {targetChainName}
          </Badge>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* FROM token */}
      {fromToken && (
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">From:</span>
          <div className="flex items-center gap-1">
            <TokenIcon address={fromToken.token.address} symbol={fromToken.token.symbol} chainId={fromToken.chainId} size="sm" className="w-3.5 h-3.5" />
            <span className="font-medium">{fromToken.token.symbol}</span>
            <ChainIcon chainId={fromToken.chainId} size="sm" className="w-3 h-3" />
          </div>
          <span className="text-muted-foreground ml-auto">
            {fromToken.balance.toFixed(4)}
          </span>
        </div>
      )}

      {/* Amount + Quote */}
      {(state === 'input' || state === 'error') && fromToken && (
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setState('input'); setError(''); }}
              className="h-8 text-sm pr-12"
              inputMode="decimal"
            />
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-primary hover:underline font-medium"
              onClick={() => setAmount(fromToken.balance.toString())}
            >
              MAX
            </button>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs px-3"
            onClick={handleQuote}
            disabled={!amount || parseFloat(amount) <= 0}
          >
            Quote
          </Button>
        </div>
      )}

      {/* Quoting */}
      {state === 'quoting' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-0.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Finding best route...
        </div>
      )}

      {/* Quote result */}
      {state === 'quoted' && route && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs bg-muted/30 rounded-md px-2 py-1.5">
            <div>
              <span className="text-muted-foreground">You get: </span>
              <span className="font-medium">
                ~{parseFloat(formatUnits(BigInt(route.toAmount), route.toToken.decimals)).toFixed(4)} {route.toToken.symbol}
              </span>
            </div>
            <span className="text-muted-foreground text-[10px]">
              ~${parseFloat(route.toAmountUSD).toFixed(2)}
            </span>
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-1"
              onClick={() => { setState('input'); setRoute(null); }}
            >
              Edit
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs flex-1 gap-1"
              onClick={handleExecuteViaSwapPage}
            >
              <ArrowRightLeft className="w-3 h-3" />
              Swap
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {state === 'error' && error && (
        <div className="flex items-center gap-1.5 text-[11px] text-destructive">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* Quick swap button (skip quoting) */}
      {state === 'input' && fromToken && (
        <button
          onClick={handleExecuteViaSwapPage}
          className="text-[10px] text-primary hover:underline w-full text-center"
        >
          Open full swap →
        </button>
      )}
    </div>
  );
}
