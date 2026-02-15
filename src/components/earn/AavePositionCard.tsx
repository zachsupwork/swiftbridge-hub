/**
 * Aave V3 Position Card
 * 
 * Displays user supply/borrow position with management actions.
 */

import {
  ArrowUpRight,
  ArrowDownLeft,
  Repeat,
  ShieldCheck,
  ExternalLink,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChainIcon } from '@/components/common/ChainIcon';
import type { AavePosition } from '@/hooks/useAavePositions';

interface AavePositionCardProps {
  position: AavePosition;
  onSupply?: (position: AavePosition) => void;
  onWithdraw?: (position: AavePosition) => void;
  onRepay?: (position: AavePosition) => void;
  onSwap?: (chainId: number, symbol: string, address?: string) => void;
}

function formatAmount(value: string, decimals?: number): string {
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0.00';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

export function AavePositionCard({
  position,
  onSupply,
  onWithdraw,
  onRepay,
  onSwap,
}: AavePositionCardProps) {
  const hasSupply = position.supplyBalance > 0n;
  const hasDebt = position.variableDebt > 0n;

  return (
    <div className="glass rounded-xl p-4 border border-primary/10 hover:border-primary/20 transition-colors">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <img
            src={position.assetLogo}
            alt={position.assetSymbol}
            className="w-10 h-10 rounded-full"
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg'; }}
          />
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border border-background overflow-hidden">
            <ChainIcon chainId={position.chainId} size="sm" />
          </div>
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm flex items-center gap-2">
            {position.assetSymbol}
            <Badge variant="outline" className="h-4 px-1 text-[9px]">Aave V3</Badge>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ChainIcon chainId={position.chainId} size="sm" />
            {position.chainName}
          </div>
        </div>
        {position.isCollateralEnabled && (
          <Badge variant="outline" className="h-5 text-[10px] gap-1 border-success/30 text-success">
            <ShieldCheck className="w-3 h-3" />
            Collateral
          </Badge>
        )}
      </div>

      {/* Position details */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {hasSupply && (
          <div className="glass rounded-lg p-2.5">
            <div className="text-xs text-muted-foreground mb-0.5">Supplied</div>
            <div className="font-medium text-sm text-success">
              {formatAmount(position.supplyBalanceFormatted)} {position.assetSymbol}
            </div>
            {position.supplyBalanceUsd > 0 && (
              <div className="text-xs text-muted-foreground">{formatUsd(position.supplyBalanceUsd)}</div>
            )}
            <div className="text-xs text-success/80 mt-0.5">
              {position.supplyApy.toFixed(2)}% APY
            </div>
          </div>
        )}
        {hasDebt && (
          <div className="glass rounded-lg p-2.5">
            <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-warning" />
              Borrowed
            </div>
            <div className="font-medium text-sm text-warning">
              {formatAmount(position.variableDebtFormatted)} {position.assetSymbol}
            </div>
            {position.variableDebtUsd > 0 && (
              <div className="text-xs text-muted-foreground">{formatUsd(position.variableDebtUsd)}</div>
            )}
            <div className="text-xs text-warning/80 mt-0.5">
              {position.borrowApy.toFixed(2)}% APY
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {hasSupply && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs gap-1"
              onClick={() => onSupply?.(position)}
            >
              <ArrowUpRight className="w-3 h-3" />
              Supply More
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 h-8 text-xs gap-1"
              onClick={() => onWithdraw?.(position)}
            >
              <ArrowDownLeft className="w-3 h-3" />
              Withdraw
            </Button>
          </>
        )}
        {hasDebt && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs gap-1 border-warning/30 text-warning hover:bg-warning/10"
            onClick={() => onRepay?.(position)}
          >
            Repay
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs gap-1"
          onClick={() => onSwap?.(position.chainId, position.assetSymbol, position.assetAddress)}
        >
          <Repeat className="w-3 h-3" />
          Swap
        </Button>
      </div>

      {/* Market link */}
      {position.market?.protocolUrl && (
        <div className="mt-2 pt-2 border-t border-border/30">
          <a
            href={position.market.protocolUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            View on Aave <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
