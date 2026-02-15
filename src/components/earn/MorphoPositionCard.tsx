/**
 * Enhanced Position Card with detailed market info, contract addresses, and management actions.
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
  ExternalLink,
  Copy,
  Check,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getMorphoChainConfig } from '@/lib/morpho/config';
import { getExplorerAddressUrl } from '@/lib/wagmiConfig';
import { RiskBar } from '@/components/common/RiskBar';
import { ChainIcon } from '@/components/common/ChainIcon';
import type { MorphoPositionWithHealth } from '@/hooks/useMorphoPositions';
import type { ActionType } from './EnhancedActionModal';
import { toast } from '@/hooks/use-toast';

interface MorphoPositionCardProps {
  position: MorphoPositionWithHealth;
  onManage?: (position: MorphoPositionWithHealth, action?: ActionType) => void;
}

export const MorphoPositionCard = memo(function MorphoPositionCard({
  position,
  onManage,
}: MorphoPositionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
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

  const copyAddress = useCallback((addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    toast({ title: 'Copied', description: 'Address copied to clipboard' });
    setTimeout(() => setCopiedAddr(null), 1500);
  }, []);

  const truncAddr = (addr: string) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '—';

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
      className="glass rounded-xl overflow-hidden border border-primary/20"
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
            <div>
              <div className="font-medium flex items-center gap-1.5">
                {market.loanAsset.symbol}
                {market.collateralAsset && (
                  <span className="text-muted-foreground font-normal">
                    / {market.collateralAsset.symbol}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ChainIcon chainId={position.chainId} size="sm" />
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

          {/* Market details */}
          <div className="p-3 rounded-lg bg-muted/20 border border-border/30 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
              <Info className="w-3.5 h-3.5" />
              Market Details
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Supply</span>
                <span className="font-medium">{formatUsd(market.totalSupplyUsd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Borrow</span>
                <span className="font-medium">{formatUsd(market.totalBorrowUsd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Utilization</span>
                <span className="font-medium">{market.utilization.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Liquidity</span>
                <span className="font-medium">{formatUsd(market.availableLiquidityUsd)}</span>
              </div>
            </div>

            {/* Contract addresses */}
            <div className="pt-2 border-t border-border/20 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Morpho Blue</span>
                <div className="flex items-center gap-1">
                  <a
                    href={getExplorerAddressUrl(position.chainId, market.morphoBlue)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-primary hover:underline"
                  >
                    {truncAddr(market.morphoBlue)}
                  </a>
                  <button onClick={(e) => { e.stopPropagation(); copyAddress(market.morphoBlue); }} className="p-0.5 text-muted-foreground hover:text-foreground">
                    {copiedAddr === market.morphoBlue ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              {market.oracle && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Oracle</span>
                  <div className="flex items-center gap-1">
                    <a
                      href={getExplorerAddressUrl(position.chainId, market.oracle)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-primary hover:underline"
                    >
                      {truncAddr(market.oracle)}
                    </a>
                    <button onClick={(e) => { e.stopPropagation(); copyAddress(market.oracle); }} className="p-0.5 text-muted-foreground hover:text-foreground">
                      {copiedAddr === market.oracle ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              )}
              {market.irm && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">IRM</span>
                  <div className="flex items-center gap-1">
                    <a
                      href={getExplorerAddressUrl(position.chainId, market.irm)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-primary hover:underline"
                    >
                      {truncAddr(market.irm)}
                    </a>
                    <button onClick={(e) => { e.stopPropagation(); copyAddress(market.irm); }} className="p-0.5 text-muted-foreground hover:text-foreground">
                      {copiedAddr === market.irm ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Market ID</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[10px]">{truncAddr(market.uniqueKey)}</span>
                  <button onClick={(e) => { e.stopPropagation(); copyAddress(market.uniqueKey); }} className="p-0.5 text-muted-foreground hover:text-foreground">
                    {copiedAddr === market.uniqueKey ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
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
            {!hasSupply && !hasBorrow && hasCollateral && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onManage?.(position, 'supply')}
                  className="gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Supply
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onManage?.(position, 'borrow')}
                  className="gap-1"
                >
                  <Wallet className="w-3 h-3" />
                  Borrow
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
