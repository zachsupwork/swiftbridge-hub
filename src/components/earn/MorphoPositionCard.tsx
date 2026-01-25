/**
 * Enhanced Position Card with TokenIcon
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
  Plus,
  Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getMorphoChainConfig } from '@/lib/morpho/config';
import { TokenIcon } from '@/components/common/TokenIcon';
import { ChainIcon } from '@/components/common/ChainIcon';
import { RiskBar } from '@/components/common/RiskBar';
import type { MorphoPositionWithHealth } from '@/hooks/useMorphoPositions';
import type { ActionType } from './EnhancedActionModal';

interface MorphoPositionCardProps {
  position: MorphoPositionWithHealth;
  onManage?: (position: MorphoPositionWithHealth, action?: ActionType) => void;
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
              <div className="flex -space-x-2">
                <TokenIcon 
                  address={market.loanAsset.address}
                  symbol={market.loanAsset.symbol}
                  logoUrl={market.loanAsset.logoUrl}
                  size="md"
                  className="ring-2 ring-card"
                />
                {market.collateralAsset && (
                  <TokenIcon 
                    address={market.collateralAsset.address}
                    symbol={market.collateralAsset.symbol}
                    logoUrl={market.collateralAsset.logoUrl}
                    size="md"
                    className="ring-2 ring-card"
                  />
                )}
              </div>
              <ChainIcon 
                chainId={position.chainId}
                size="xs"
                className="absolute -bottom-1 -right-1 ring-2 ring-card"
              />
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
                {chainConfig?.label || 'Unknown Chain'} • LLTV: {market.lltv.toFixed(0)}%
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
                <div className={cn("font-semibold flex items-center gap-1 justify-end", getHealthColor(position.healthFactor))}>
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
        <div className="flex flex-wrap gap-2 mt-3">
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
          className="p-4 bg-muted/10 space-y-4"
        >
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

          {/* Risk bar */}
          {hasBorrow && (
            <RiskBar 
              healthFactor={position.healthFactor}
              lltv={market.lltv}
              showLabel
            />
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {hasSupply && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onManage?.(position, 'supply')}
                  className="gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Supply More
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onManage?.(position, 'withdraw')}
                  className="gap-1"
                >
                  <Minus className="w-3 h-3" />
                  Withdraw
                </Button>
              </>
            )}
            {hasBorrow && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onManage?.(position, 'repay')}
                  className="gap-1"
                >
                  <Shield className="w-3 h-3" />
                  Repay
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onManage?.(position, 'borrow')}
                  className="gap-1"
                  disabled={!position.isHealthy}
                >
                  <Wallet className="w-3 h-3" />
                  Borrow More
                </Button>
              </>
            )}
          </div>

          {/* Main manage button */}
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

export default MorphoPositionCard;
