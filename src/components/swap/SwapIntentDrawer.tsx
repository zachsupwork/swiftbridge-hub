/**
 * SwapIntentDrawer — Modal drawer that opens when any feature triggers a swap intent.
 * Pre-fills the TO token from the intent, auto-selects best FROM token from user balances.
 * "Bridge & Swap" navigates to the home swap page with all fields prefilled.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Repeat, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TokenIcon } from '@/components/common/TokenIcon';
import { ChainIcon } from '@/components/common/ChainIcon';
import { useSwapIntent } from '@/hooks/useSwapIntent';
import { useBalancesContext } from '@/providers/BalancesProvider';
import { resolveChainName } from '@/lib/logoResolver';
import { cn } from '@/lib/utils';

export function SwapIntentDrawer() {
  const navigate = useNavigate();
  const { intent, isOpen, closeSwapIntent, clearSwapIntent } = useSwapIntent();
  const { tokenBalances } = useBalancesContext();

  // Auto-select best FROM token
  const bestFrom = useMemo(() => {
    if (!intent || !tokenBalances.length) return null;

    // Priority 1: Same token on different chain
    const sameTokenOtherChain = tokenBalances
      .filter(tb =>
        tb.token.symbol.toUpperCase() === intent.targetSymbol.toUpperCase() &&
        tb.chainId !== intent.targetChainId &&
        tb.balanceUSD > 0.5
      )
      .sort((a, b) => b.balanceUSD - a.balanceUSD)[0];

    if (sameTokenOtherChain) return sameTokenOtherChain;

    // Priority 2: Stablecoins first
    const stableSymbols = new Set(['USDC', 'USDT', 'DAI', 'USDC.E']);
    const stableBalance = tokenBalances
      .filter(tb => stableSymbols.has(tb.token.symbol.toUpperCase()) && tb.balanceUSD > 1)
      .sort((a, b) => b.balanceUSD - a.balanceUSD)[0];

    if (stableBalance) return stableBalance;

    // Priority 3: Largest balance
    const largest = tokenBalances
      .filter(tb => tb.balanceUSD > 1)
      .sort((a, b) => b.balanceUSD - a.balanceUSD)[0];

    return largest || null;
  }, [intent, tokenBalances]);

  const handleProceedToSwap = () => {
    if (!intent) return;
    // Build query params to prefill the swap card on the home page
    const params = new URLSearchParams();
    params.set('toChainId', String(intent.targetChainId));
    params.set('toToken', intent.targetTokenAddress);
    params.set('toSymbol', intent.targetSymbol);
    if (bestFrom) {
      params.set('fromChainId', String(bestFrom.chainId));
      params.set('fromToken', bestFrom.token.address);
      params.set('fromSymbol', bestFrom.token.symbol);
    }
    params.set('ref', intent.returnTo?.view || 'earn');
    params.set('action', 'swap');
    clearSwapIntent();
    navigate(`/?${params.toString()}`);
  };

  if (!isOpen || !intent) return null;

  const targetChainName = resolveChainName(intent.targetChainId);
  const hasBalance = tokenBalances.some(tb => tb.balanceUSD > 1);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSwapIntent}
            className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed z-50 inset-0 flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">Get via Swap</h3>
                </div>
                <button onClick={closeSwapIntent} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Target token */}
              <div className="p-4 space-y-4">
                <div className="text-xs text-muted-foreground font-medium">You need</div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="relative">
                    <TokenIcon
                      address={intent.targetTokenAddress}
                      symbol={intent.targetSymbol}
                      chainId={intent.targetChainId}
                      size="md"
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-card overflow-hidden">
                      <ChainIcon chainId={intent.targetChainId} size="sm" />
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{intent.targetSymbol}</div>
                    <div className="text-xs text-muted-foreground">on {targetChainName}</div>
                  </div>
                  {intent.suggestedAmount && (
                    <Badge variant="outline" className="ml-auto text-xs">{intent.suggestedAmount}</Badge>
                  )}
                </div>

                {/* Best FROM token */}
                {bestFrom ? (
                  <>
                    <div className="flex items-center justify-center">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ArrowRight className="w-3 h-3" />
                        <span>Swap from</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                      <div className="relative">
                        <TokenIcon
                          address={bestFrom.token.address}
                          symbol={bestFrom.token.symbol}
                          chainId={bestFrom.chainId}
                          logoUrl={bestFrom.token.logoURI}
                          size="md"
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-card overflow-hidden">
                          <ChainIcon chainId={bestFrom.chainId} size="sm" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{bestFrom.token.symbol}</div>
                        <div className="text-xs text-muted-foreground">
                          {resolveChainName(bestFrom.chainId)} • {bestFrom.balanceFormatted}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          ${bestFrom.balanceUSD.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </>
                ) : !hasBalance ? (
                  <div className="text-center p-4 rounded-xl bg-muted/20 border border-border/30">
                    <Wallet className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No swappable balance found</p>
                    <p className="text-xs text-muted-foreground mt-1">Deposit tokens to your wallet first</p>
                  </div>
                ) : null}

                {/* Action buttons */}
                <div className="space-y-2">
                  <Button
                    className="w-full gap-2"
                    onClick={handleProceedToSwap}
                    disabled={!hasBalance}
                  >
                    <Repeat className="w-4 h-4" />
                    {bestFrom && bestFrom.chainId !== intent.targetChainId
                      ? 'Bridge & Swap'
                      : 'Swap'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-xs"
                    onClick={closeSwapIntent}
                  >
                    Cancel
                  </Button>
                </div>

                {intent.returnTo && (
                  <p className="text-[10px] text-center text-muted-foreground">
                    After swap, you'll return to {intent.returnTo.view === 'earn' ? 'Earn' : 'Portfolio'}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
