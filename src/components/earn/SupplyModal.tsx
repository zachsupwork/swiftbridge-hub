import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, AlertTriangle, Lock, ArrowRight, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEarnAnalytics } from '@/hooks/useEarnAnalytics';
import { useBalancesContext } from '@/providers/BalancesProvider';
import { buildSwapLink, getDefaultFromToken } from '@/lib/swapDeepLink';
import { supportedChains } from '@/lib/wagmiConfig';
import type { LendingMarket } from '@/hooks/useLendingMarkets';

const chainNameMap = new Map(supportedChains.map(c => [c.id, c.name]));

interface SupplyModalProps {
  market: LendingMarket | null;
  isOpen: boolean;
  onClose: () => void;
  isWalletConnected: boolean;
  onConnectWallet: () => void;
}

export function SupplyModal({ 
  market, 
  isOpen, 
  onClose, 
  isWalletConnected,
  onConnectWallet 
}: SupplyModalProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { trackSupplyClick } = useEarnAnalytics();
  const navigate = useNavigate();
  const { tokenBalances } = useBalancesContext();

  if (!market) return null;

  const handleOpenProtocol = () => {
    if (!isWalletConnected) {
      onConnectWallet();
      return;
    }

    setIsRedirecting(true);
    trackSupplyClick(market.protocol, market.chainName, market.assetSymbol);
    
    // Add UTM parameters for attribution
    const url = new URL(market.protocolUrl);
    url.searchParams.set('utm_source', 'cryptodefibridge');
    url.searchParams.set('utm_medium', 'earn');
    url.searchParams.set('utm_campaign', 'lending');
    
    // Open in new tab
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
    
    setTimeout(() => {
      setIsRedirecting(false);
      onClose();
    }, 500);
  };

  const protocolName = market.protocol === 'aave' ? 'Aave' : 'Morpho';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div 
              className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <img
                    src={market.assetLogo}
                    alt={market.assetSymbol}
                    className="w-8 h-8 rounded-full"
                  />
                  <div>
                    <div className="font-semibold text-foreground">
                      Supply {market.assetSymbol}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span>{market.chainName}</span>
                      <span>•</span>
                      <Badge 
                        variant="outline" 
                        className="text-[10px] px-1 py-0 h-4"
                      >
                        {protocolName}
                      </Badge>
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* APY Display */}
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-sm text-muted-foreground mb-1">Current Supply APY</div>
                  <div className="text-3xl font-bold text-gradient">
                    {market.supplyAPY.toFixed(2)}%
                  </div>
                  {market.isVariable && (
                    <div className="text-xs text-muted-foreground mt-1">Variable Rate</div>
                  )}
                </div>

                {/* Options */}
                <div className="space-y-3">
                  {/* Primary: Open on Protocol */}
                  <Button
                    onClick={handleOpenProtocol}
                    disabled={isRedirecting}
                    className="w-full h-12 text-base gap-2"
                  >
                    {isRedirecting ? (
                      <>Redirecting...</>
                    ) : (
                      <>
                        {isWalletConnected ? (
                          <>
                            Open on {protocolName}
                            <ExternalLink className="w-4 h-4" />
                          </>
                        ) : (
                          <>Connect wallet to continue</>
                        )}
                      </>
                    )}
                  </Button>

                  {/* Secondary: Coming soon */}
                  <Button
                    disabled
                    variant="outline"
                    className="w-full h-12 text-base gap-2 opacity-50"
                  >
                    <Lock className="w-4 h-4" />
                    Supply in-app (Coming soon)
                  </Button>
                </div>

                {/* Cross-chain balance hints */}
                {isWalletConnected && (() => {
                  const otherChainBalances = tokenBalances.filter(
                    (tb) => tb.token.symbol.toUpperCase() === market.assetSymbol.toUpperCase() && tb.chainId !== market.chainId && tb.balance > 0
                  );
                  if (otherChainBalances.length > 0) {
                    return (
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          You have <strong>{market.assetSymbol}</strong> on other chains:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {otherChainBalances.map((tb) => (
                            <Badge key={tb.chainId} variant="outline" className="text-[10px] gap-1">
                              {chainNameMap.get(tb.chainId) || `Chain ${tb.chainId}`} · {tb.balanceFormatted} {tb.token.symbol}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs gap-1 flex-1"
                            onClick={() => {
                              const best = otherChainBalances.reduce((a, b) => a.balanceUSD > b.balanceUSD ? a : b);
                              const link = buildSwapLink({
                                chainId: best.chainId,
                                toTokenAddress: market.assetAddress || best.token.address,
                                toTokenSymbol: market.assetSymbol,
                                fromTokenAddress: best.token.address,
                                ref: 'earn',
                                action: 'supply',
                              });
                              onClose();
                              navigate(link);
                            }}
                          >
                            <Repeat className="w-3 h-3" />
                            Bridge to this chain
                          </Button>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Risk Warning */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    You are interacting with external DeFi protocols. Rates vary and carry smart contract risk. 
                    Always do your own research before depositing funds.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
