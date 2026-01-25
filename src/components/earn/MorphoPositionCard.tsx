/**
 * Morpho Position Card Component
 * 
 * Displays a user's position in a Morpho market with manage actions.
 */

import { memo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Wallet,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getMorphoChainConfig } from '@/lib/morpho/config';
import type { MorphoPositionWithHealth } from '@/hooks/useMorphoPositions';

const GENERIC_TOKEN_LOGO = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';

interface TokenLogoProps {
  src: string | undefined;
  symbol: string;
  size?: 'sm' | 'md';
}

const TokenLogo = memo(function TokenLogo({ src, symbol, size = 'md' }: TokenLogoProps) {
  const [hasError, setHasError] = useState(false);
  const sizeClasses = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';

  return (
    <img
      src={hasError ? GENERIC_TOKEN_LOGO : (src || GENERIC_TOKEN_LOGO)}
      alt={symbol}
      className={cn(sizeClasses, 'rounded-full bg-muted')}
      onError={() => setHasError(true)}
    />
  );
});

interface MorphoPositionCardProps {
  position: MorphoPositionWithHealth;
  onManage?: (position: MorphoPositionWithHealth) => void;
}

export const MorphoPositionCard = memo(function MorphoPositionCard({
  position,
  onManage,
}: MorphoPositionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const chainConfig = getMorphoChainConfig(position.chainId);
  const market = position.market;

  const formatUsd = useCallback((value: number) => {
    if (!Number.isFinite(value) || value === 0) return '$0.00';
    if (value < 0.01) return '<$0.01';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  const formatHealthFactor = useCallback((hf: number | null) => {
    if (hf === null) return '∞';
    if (!Number.isFinite(hf)) return '—';
    if (hf > 10) return '>10';
    return hf.toFixed(2);
  }, []);

  const getHealthColor = useCallback((hf: number | null) => {
    if (hf === null) return 'text-success';
    if (hf > 1.5) return 'text-success';
    if (hf > 1.2) return 'text-warning';
    return 'text-destructive';
  }, []);

  const hasSupply = position.supplyAssetsUsd > 0;
  const hasBorrow = position.borrowAssetsUsd > 0;
  const hasCollateral = position.collateralUsd > 0;

  if (!market) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div 
        className={cn(
          "p-4 cursor-pointer hover:bg-muted/20 transition-colors",
          expanded && "border-b border-border/30"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <TokenLogo 
                src={market.loanAsset.logoUrl} 
                symbol={market.loanAsset.symbol}
              />
              {chainConfig && (
                <img
                  src={chainConfig.logo}
                  alt={chainConfig.label}
                  className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border border-card bg-card"
                />
              )}
            </div>
            <div>
              <div className="font-medium flex items-center gap-1.5">
                {market.loanAsset.symbol}
                {market.collateralAsset && (
                  <span className="text-muted-foreground font-normal">
                    / {market.collateralAsset.symbol}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {chainConfig?.label || 'Unknown Chain'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Position value */}
            <div className="text-right">
              <div className="font-semibold">
                {formatUsd(position.supplyAssetsUsd + position.collateralUsd)}
              </div>
              <div className="text-xs text-muted-foreground">Total Value</div>
            </div>

            {/* Health factor if borrowing */}
            {hasBorrow && (
              <div className="text-right">
                <div className={cn("font-semibold flex items-center gap-1", getHealthColor(position.healthFactor))}>
                  {!position.isHealthy && <AlertTriangle className="w-3.5 h-3.5" />}
                  {formatHealthFactor(position.healthFactor)}
                </div>
                <div className="text-xs text-muted-foreground">Health</div>
              </div>
            )}

            {expanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Quick stats row */}
        <div className="flex gap-3 mt-3">
          {hasSupply && (
            <Badge variant="outline" className="bg-success/10 text-success border-success/30">
              <TrendingUp className="w-3 h-3 mr-1" />
              Supplied {formatUsd(position.supplyAssetsUsd)}
            </Badge>
          )}
          {hasCollateral && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              <Shield className="w-3 h-3 mr-1" />
              Collateral {formatUsd(position.collateralUsd)}
            </Badge>
          )}
          {hasBorrow && (
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
              <TrendingDown className="w-3 h-3 mr-1" />
              Borrowed {formatUsd(position.borrowAssetsUsd)}
            </Badge>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="p-4 bg-muted/10"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {hasSupply && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Supplied</div>
                <div className="font-medium">{formatUsd(position.supplyAssetsUsd)}</div>
                <div className="text-xs text-success">
                  +{market.supplyApy.toFixed(2)}% APY
                </div>
              </div>
            )}
            {hasCollateral && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Collateral</div>
                <div className="font-medium">{formatUsd(position.collateralUsd)}</div>
                <div className="text-xs text-muted-foreground">
                  LLTV: {market.lltv.toFixed(0)}%
                </div>
              </div>
            )}
            {hasBorrow && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Borrowed</div>
                <div className="font-medium">{formatUsd(position.borrowAssetsUsd)}</div>
                <div className="text-xs text-warning">
                  -{market.borrowApy.toFixed(2)}% APY
                </div>
              </div>
            )}
            {hasBorrow && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Health Factor</div>
                <div className={cn("font-medium", getHealthColor(position.healthFactor))}>
                  {formatHealthFactor(position.healthFactor)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {position.isHealthy ? 'Safe' : 'At risk'}
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={() => onManage?.(position)}
            className="w-full gap-2"
          >
            <Wallet className="w-4 h-4" />
            Manage Position
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
});
