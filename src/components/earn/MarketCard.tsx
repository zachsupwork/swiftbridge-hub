import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LendingMarket } from '@/hooks/useLendingMarkets';

interface MarketCardProps {
  market: LendingMarket;
  onSupplyClick: (market: LendingMarket) => void;
  index?: number;
}

export function MarketCard({ market, onSupplyClick, index = 0 }: MarketCardProps) {
  const formatAPY = (apy: number) => {
    if (apy < 0.01) return '<0.01%';
    if (apy > 100) return '>100%';
    return `${apy.toFixed(2)}%`;
  };

  const formatTVL = (tvl: number | null) => {
    if (tvl === null) return '-';
    if (tvl >= 1_000_000_000) return `$${(tvl / 1_000_000_000).toFixed(2)}B`;
    if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(2)}M`;
    if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(2)}K`;
    return `$${tvl.toFixed(2)}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="glass rounded-xl p-4 hover:bg-muted/30 transition-all"
    >
      {/* Mobile-first layout */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Asset info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            <img
              src={market.assetLogo}
              alt={market.assetSymbol}
              className="w-10 h-10 rounded-full bg-muted"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
              }}
            />
            <img
              src={market.chainLogo}
              alt={market.chainName}
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-card bg-card"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">{market.assetSymbol}</span>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px] px-1.5 py-0 h-5",
                  market.protocol === 'aave' 
                    ? "border-[hsl(263_70%_58%)] text-[hsl(263_70%_58%)]" 
                    : "border-[hsl(199_89%_48%)] text-[hsl(199_89%_48%)]"
                )}
              >
                {market.protocol === 'aave' ? 'Aave' : 'Morpho'}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {market.chainName}
            </div>
          </div>
        </div>

        {/* APY and TVL */}
        <div className="flex items-center justify-between gap-4 sm:gap-6">
          <div className="text-left sm:text-right">
            <div className="text-lg font-bold text-foreground">
              {formatAPY(market.supplyAPY)}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              Supply APY
              {market.isVariable && (
                <span className="text-[10px] text-muted-foreground/70">(Variable)</span>
              )}
            </div>
          </div>

          {market.tvl !== null && (
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-foreground">
                {formatTVL(market.tvl)}
              </div>
              <div className="text-xs text-muted-foreground">TVL</div>
            </div>
          )}

          <Button
            onClick={() => onSupplyClick(market)}
            size="sm"
            className="gap-1.5 whitespace-nowrap"
          >
            Supply
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* TVL on mobile */}
      {market.tvl !== null && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 sm:hidden">
          <span className="text-xs text-muted-foreground">Total Value Locked</span>
          <span className="text-sm font-medium">{formatTVL(market.tvl)}</span>
        </div>
      )}
    </motion.div>
  );
}
