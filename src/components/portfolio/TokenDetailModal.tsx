/**
 * Token Detail Modal
 * 
 * Per-chain focused view: shows the clicked token's chain by default.
 * "Other chains" section is collapsed. Actions use swap intent (inline).
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRightLeft, ArrowRight, TrendingUp, ExternalLink, Copy, Vault, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TokenIcon } from '@/components/common/TokenIcon';
import { ChainIcon } from '@/components/common/ChainIcon';
import { useBalancesContext } from '@/providers/BalancesProvider';
import { openSwapIntent } from '@/lib/swapIntent';
import { resolveChainName } from '@/lib/logoResolver';
import { getExplorerAddressUrl, supportedChains } from '@/lib/wagmiConfig';
import type { PortfolioTokenBalance } from '@/hooks/useBalances';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface TokenDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The token clicked in portfolio — per-chain focused */
  token: PortfolioTokenBalance | null;
}

const chainNameMap = new Map(supportedChains.map(c => [c.id, c.name]));

export function TokenDetailModal({ isOpen, onClose, token }: TokenDetailModalProps) {
  const navigate = useNavigate();
  const { tokenBalances } = useBalancesContext();
  const [showOtherChains, setShowOtherChains] = useState(false);

  // Other chain balances for same symbol (excluding the clicked token's chain+address)
  const otherChainBalances = useMemo(() => {
    if (!token) return [];
    const sym = token.token.symbol.toUpperCase();
    return tokenBalances
      .filter(tb =>
        tb.token.symbol.toUpperCase() === sym &&
        tb.balance > 0 &&
        !(tb.chainId === token.chainId && tb.token.address.toLowerCase() === token.token.address.toLowerCase())
      )
      .sort((a, b) => b.balanceUSD - a.balanceUSD);
  }, [token, tokenBalances]);

  if (!token) return null;

  const chainName = chainNameMap.get(token.chainId) || `Chain ${token.chainId}`;
  const isNative = token.token.address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
                   token.token.address.toLowerCase() === '0x0000000000000000000000000000000000000000';

  const handleSwap = (tb: PortfolioTokenBalance) => {
    onClose();
    openSwapIntent({
      intentType: 'acquire_token',
      targetChainId: tb.chainId,
      targetTokenAddress: tb.token.address,
      targetSymbol: tb.token.symbol,
      returnTo: { view: 'portfolio' },
    });
  };

  const handleBridge = (tb: PortfolioTokenBalance) => {
    onClose();
    openSwapIntent({
      intentType: 'acquire_token',
      targetChainId: tb.chainId,
      targetTokenAddress: tb.token.address,
      targetSymbol: tb.token.symbol,
      returnTo: { view: 'portfolio' },
    });
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

  const renderTokenCard = (tb: PortfolioTokenBalance, isPrimary: boolean) => {
    const cName = chainNameMap.get(tb.chainId) || `Chain ${tb.chainId}`;
    const native = tb.token.address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
                   tb.token.address.toLowerCase() === '0x0000000000000000000000000000000000000000';
    return (
      <div key={`${tb.chainId}-${tb.token.address}`} className={cn("p-3 rounded-xl space-y-2", isPrimary ? "bg-primary/5 border border-primary/20" : "bg-muted/20 border border-border/30")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChainIcon chainId={tb.chainId} size="sm" className="w-4 h-4" />
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">{cName}</Badge>
            {isPrimary && <Badge className="text-[10px] h-5 px-1.5 bg-primary/20 text-primary border-0">Current</Badge>}
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold">{tb.balanceFormatted} {tb.token.symbol}</div>
            <div className="text-[10px] text-muted-foreground">
              ${tb.balanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {!native && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="font-mono truncate">{tb.token.address.slice(0, 10)}…{tb.token.address.slice(-6)}</span>
            <button onClick={() => copyAddress(tb.token.address)} className="hover:text-foreground transition-colors">
              <Copy className="w-3 h-3" />
            </button>
            <a href={getExplorerAddressUrl(tb.chainId, tb.token.address)} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => handleSwap(tb)}>
            <ArrowRightLeft className="w-3 h-3" /> Swap
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => handleBridge(tb)}>
            <ArrowRight className="w-3 h-3" /> Bridge
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => handleEarn(tb)}>
            <TrendingUp className="w-3 h-3" /> Supply / Borrow
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => handleVaults(tb)}>
            <Vault className="w-3 h-3" /> Vaults
          </Button>
        </div>
      </div>
    );
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
                  <TokenIcon
                    address={token.token.address}
                    symbol={token.token.symbol}
                    chainId={token.chainId}
                    logoUrl={token.token.logoURI}
                    size="lg"
                  />
                  <div>
                    <h2 className="font-bold text-lg leading-tight">{token.token.symbol}</h2>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ChainIcon chainId={token.chainId} size="sm" className="w-3.5 h-3.5" />
                      <span>{chainName}</span>
                      <span>•</span>
                      <span className="truncate max-w-[140px]">{token.token.name}</span>
                    </div>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Primary balance (this chain) */}
              <div className="px-5 pt-4 pb-2">
                <div className="text-xs text-muted-foreground mb-0.5">{chainName} balance</div>
                <div className="text-2xl font-bold text-gradient">
                  ${token.balanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-muted-foreground">{token.balanceFormatted} {token.token.symbol}</div>
              </div>

              {/* Primary token card */}
              <div className="px-5 pb-2">
                {renderTokenCard(token, true)}
              </div>

              {/* Other chains (collapsed) */}
              {otherChainBalances.length > 0 && (
                <div className="px-5 pb-2">
                  <button
                    onClick={() => setShowOtherChains(!showOtherChains)}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-2"
                  >
                    {showOtherChains ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <span>{token.token.symbol} on {otherChainBalances.length} other chain{otherChainBalances.length > 1 ? 's' : ''}</span>
                    <span className="ml-auto">
                      ${otherChainBalances.reduce((s, t) => s + t.balanceUSD, 0).toFixed(2)}
                    </span>
                  </button>
                  <AnimatePresence>
                    {showOtherChains && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden space-y-2 max-h-[200px] overflow-y-auto"
                      >
                        {otherChainBalances.map(tb => renderTokenCard(tb, false))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

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
