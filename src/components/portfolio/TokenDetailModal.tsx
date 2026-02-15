/**
 * Token Detail Modal
 * 
 * Shows per-chain balances for a token with actions: Swap, Bridge, Earn.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRightLeft, ArrowRight, TrendingUp, ExternalLink, Copy, Vault } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TokenIconStable } from '@/components/common/TokenIconStable';
import { useBalancesContext } from '@/providers/BalancesProvider';
import { buildSwapLink } from '@/lib/swapDeepLink';
import { getExplorerAddressUrl, supportedChains } from '@/lib/wagmiConfig';
import type { PortfolioTokenBalance } from '@/hooks/useBalances';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface TokenDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The token clicked in portfolio — used to find all same-symbol balances */
  token: PortfolioTokenBalance | null;
}

const chainNameMap = new Map(supportedChains.map(c => [c.id, c.name]));

export function TokenDetailModal({ isOpen, onClose, token }: TokenDetailModalProps) {
  const navigate = useNavigate();
  const { tokenBalances } = useBalancesContext();

  // All balances for this symbol across chains
  const allChainBalances = useMemo(() => {
    if (!token) return [];
    const sym = token.token.symbol.toUpperCase();
    return tokenBalances
      .filter(tb => tb.token.symbol.toUpperCase() === sym && tb.balance > 0)
      .sort((a, b) => b.balanceUSD - a.balanceUSD);
  }, [token, tokenBalances]);

  const totalUSD = useMemo(() => allChainBalances.reduce((s, t) => s + t.balanceUSD, 0), [allChainBalances]);

  if (!token) return null;

  const handleSwap = (tb: PortfolioTokenBalance) => {
    // Use token as FROM (user holds it, wants to swap it)
    const link = buildSwapLink({
      chainId: tb.chainId,
      fromTokenAddress: tb.token.address,
      fromTokenSymbol: tb.token.symbol,
      ref: 'portfolio',
      action: 'swap',
    });
    onClose();
    navigate(link);
  };

  const handleBridge = (tb: PortfolioTokenBalance) => {
    // Prefill swap FROM this token on this chain TO a different chain
    const link = buildSwapLink({
      chainId: tb.chainId,
      fromTokenAddress: tb.token.address,
      fromTokenSymbol: tb.token.symbol,
      ref: 'portfolio',
      action: 'bridge',
    });
    onClose();
    navigate(link);
  };

  const handleEarn = (tb: PortfolioTokenBalance) => {
    onClose();
    navigate(`/earn?token=${tb.token.symbol}&chainId=${tb.chainId}&tab=markets`);
  };

  const handleVaults = (tb: PortfolioTokenBalance) => {
    onClose();
    navigate(`/earn?token=${tb.token.symbol}&chainId=${tb.chainId}&tab=vaults`);
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast({ title: 'Copied', description: 'Address copied to clipboard' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed z-50 inset-0 flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <TokenIconStable
                    symbol={token.token.symbol}
                    logoURI={token.token.logoURI}
                    size="lg"
                  />
                  <div>
                    <h2 className="font-bold text-lg leading-tight">{token.token.symbol}</h2>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{token.token.name}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Total value */}
              <div className="px-5 pt-4 pb-2">
                <div className="text-xs text-muted-foreground mb-0.5">Total across all chains</div>
                <div className="text-2xl font-bold text-gradient">
                  ${totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Per-chain balances */}
              <div className="px-5 pb-2">
                <div className="text-xs text-muted-foreground mb-2 font-medium">Balances by chain</div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {allChainBalances.map(tb => {
                    const chainName = chainNameMap.get(tb.chainId) || `Chain ${tb.chainId}`;
                    const isNative = tb.token.address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
                                     tb.token.address.toLowerCase() === '0x0000000000000000000000000000000000000000';
                    return (
                      <div key={`${tb.chainId}-${tb.token.address}`} className="p-3 rounded-xl bg-muted/20 border border-border/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5">{chainName}</Badge>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold">{tb.balanceFormatted} {tb.token.symbol}</div>
                            <div className="text-[10px] text-muted-foreground">
                              ${tb.balanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>

                        {/* Contract address */}
                        {!isNative && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="font-mono truncate">{tb.token.address.slice(0, 10)}…{tb.token.address.slice(-6)}</span>
                            <button onClick={() => copyAddress(tb.token.address)} className="hover:text-foreground transition-colors">
                              <Copy className="w-3 h-3" />
                            </button>
                            <a
                              href={getExplorerAddressUrl(tb.chainId, tb.token.address)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-foreground transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 gap-1"
                            onClick={() => handleSwap(tb)}
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            Swap
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 gap-1"
                            onClick={() => handleBridge(tb)}
                          >
                            <ArrowRight className="w-3 h-3" />
                            Bridge
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 gap-1"
                            onClick={() => handleEarn(tb)}
                          >
                            <TrendingUp className="w-3 h-3" />
                            Supply / Borrow
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 gap-1"
                            onClick={() => handleVaults(tb)}
                          >
                            <Vault className="w-3 h-3" />
                            Vaults
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 pt-3 border-t border-border/50">
                <Button onClick={onClose} variant="outline" className="w-full">
                  Close
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
