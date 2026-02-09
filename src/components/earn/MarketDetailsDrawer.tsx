/**
 * Market Details Drawer
 * 
 * Shows full market information including loan/collateral tokens,
 * APY, utilization, LLTV, oracle info, and educational content.
 */

import { 
  Info, 
  ExternalLink,
  TrendingUp,
  Wallet,
  HelpCircle,
  Shield,
  Percent,
  Activity,
  DollarSign,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
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
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { getMorphoChainConfig } from '@/lib/morpho/config';
import type { MorphoMarket } from '@/lib/morpho/types';
import { TokenIconStable } from '@/components/common/TokenIconStable';
import { CHAIN_EXPLORERS } from '@/lib/wagmiConfig';

interface MarketDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  market: MorphoMarket | null;
  onSupply?: () => void;
  onBorrow?: () => void;
}

export function MarketDetailsDrawer({
  isOpen,
  onClose,
  market,
  onSupply,
  onBorrow,
}: MarketDetailsDrawerProps) {
  if (!market) return null;

  const chainConfig = getMorphoChainConfig(market.chainId);
  const explorer = CHAIN_EXPLORERS[market.chainId] || 'https://etherscan.io';

  // Format helpers
  const formatAPY = (apy: number) => {
    if (!Number.isFinite(apy) || apy === 0) return '—';
    const normalized = apy <= 1.5 ? apy * 100 : apy;
    return `${normalized.toFixed(2)}%`;
  };

  const formatUsd = (value: number) => {
    if (!Number.isFinite(value) || value === 0) return '$0';
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <Sheet open={isOpen} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                <TokenIconStable symbol={market.loanAsset.symbol} size="lg" />
                <div>
                  <div className="font-bold text-lg">
                    {market.loanAsset.symbol}
                    {market.collateralAsset && (
                      <span className="text-muted-foreground font-normal"> / {market.collateralAsset.symbol}</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{chainConfig?.label}</div>
                </div>
              </SheetTitle>
              <SheetDescription>
                Morpho Blue isolated lending market
              </SheetDescription>
            </SheetHeader>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-success/10 border border-success/20">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Supply APY
                </div>
                <div className="text-2xl font-bold text-success">{formatAPY(market.supplyApy)}</div>
              </div>
              <div className="p-4 rounded-xl bg-warning/10 border border-warning/20">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Wallet className="w-3.5 h-3.5" />
                  Borrow APR
                </div>
                <div className="text-2xl font-bold text-warning">{formatAPY(market.borrowApy)}</div>
              </div>
            </div>

            {/* Tokens */}
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Market Tokens
              </h3>
              
              <div className="p-4 rounded-lg bg-muted/30 space-y-4">
                {/* Loan Token */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TokenIconStable symbol={market.loanAsset.symbol} size="md" />
                    <div>
                      <div className="font-medium">{market.loanAsset.symbol}</div>
                      <div className="text-xs text-muted-foreground">{market.loanAsset.name}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    Loan Asset
                  </Badge>
                </div>

                <div className="text-xs text-muted-foreground">
                  Lenders supply this token to earn interest. Borrowers borrow this token.
                </div>

                <Separator />

                {/* Collateral Token */}
                {market.collateralAsset ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <TokenIconStable symbol={market.collateralAsset.symbol} size="md" />
                        <div>
                          <div className="font-medium">{market.collateralAsset.symbol}</div>
                          <div className="text-xs text-muted-foreground">{market.collateralAsset.name}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-secondary/10 text-secondary-foreground border-secondary/30">
                        Collateral
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Borrowers deposit this token as collateral to secure their loans.
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No collateral (unsecured market)
                  </div>
                )}
              </div>
            </div>

            {/* Market Metrics */}
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Market Metrics
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-1">Total Supplied</div>
                  <div className="font-semibold">{formatUsd(market.totalSupplyUsd)}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-1">Total Borrowed</div>
                  <div className="font-semibold">{formatUsd(market.totalBorrowUsd)}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-1">Available Liquidity</div>
                  <div className="font-semibold">{formatUsd(market.availableLiquidityUsd)}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    Utilization
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="w-3 h-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-[200px]">
                            Percentage of supplied assets currently borrowed.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className={cn(
                    "font-semibold",
                    market.utilization > 90 ? "text-destructive" :
                    market.utilization > 70 ? "text-warning" :
                    "text-success"
                  )}>
                    {market.utilization.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Parameters */}
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Percent className="w-4 h-4 text-primary" />
                Risk Parameters
              </h3>
              
              <div className="p-4 rounded-lg bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span>LLTV (Liquidation LTV)</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-[200px]">
                            Maximum loan-to-value ratio. Borrowers are liquidated if their borrow exceeds this percentage of their collateral value.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <span className="font-semibold">{market.lltv.toFixed(0)}%</span>
                </div>
              </div>
            </div>

            {/* Contract Links */}
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                Contract Addresses
              </h3>
              
              <div className="p-4 rounded-lg bg-muted/30 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Oracle</span>
                  <a 
                    href={`${explorer}/address/${market.oracle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline font-mono text-xs"
                  >
                    {truncateAddress(market.oracle)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">IRM</span>
                  <a 
                    href={`${explorer}/address/${market.irm}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline font-mono text-xs"
                  >
                    {truncateAddress(market.irm)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Loan Token</span>
                  <a 
                    href={`${explorer}/address/${market.loanAsset.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline font-mono text-xs"
                  >
                    {truncateAddress(market.loanAsset.address)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                {market.collateralAsset && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Collateral Token</span>
                    <a 
                      href={`${explorer}/address/${market.collateralAsset.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline font-mono text-xs"
                    >
                      {truncateAddress(market.collateralAsset.address)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* How This Market Works */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Info className="w-4 h-4 text-primary" />
                    How this market works
                  </div>
                  <span className="text-xs text-muted-foreground">Toggle</span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-4 rounded-lg bg-muted/30 border border-border/50 text-sm space-y-3">
                <p>
                  <strong>For Lenders:</strong> Supply {market.loanAsset.symbol} to earn {formatAPY(market.supplyApy)} APY. 
                  Your funds are lent to borrowers who pay interest.
                </p>
                <p>
                  <strong>For Borrowers:</strong> Deposit {market.collateralAsset?.symbol || 'collateral'} as collateral, 
                  then borrow {market.loanAsset.symbol} at {formatAPY(market.borrowApy)} APR.
                </p>
                <p className="text-muted-foreground">
                  This is an isolated lending market. Your supply only goes to THIS market, 
                  not spread across multiple markets. Borrowers must maintain a health factor above 1.0 
                  or risk liquidation.
                </p>
              </CollapsibleContent>
            </Collapsible>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button 
                onClick={() => {
                  onClose();
                  onSupply?.();
                }}
                className="flex-1 gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                Supply
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  onClose();
                  onBorrow?.();
                }}
                className="flex-1 gap-2"
                disabled={!market.collateralAsset}
              >
                <Wallet className="w-4 h-4" />
                Borrow
              </Button>
            </div>

            {/* Disclaimer */}
            <p className="text-xs text-muted-foreground text-center">
              Data from Morpho API. Rates are variable. Smart contract risk applies.
            </p>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
