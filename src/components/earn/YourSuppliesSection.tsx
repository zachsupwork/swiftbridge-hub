/**
 * Your Supplies Section — Aave-style
 *
 * Shows the user's active supply positions at the top of the Earn page.
 * Actions: Supply More, Withdraw, Collateral Swap (opens Aave UI).
 */

import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Repeat,
  ShieldCheck,
  Shield,
  TrendingUp,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChainIcon } from '@/components/common/ChainIcon';
import { TokenIcon } from '@/components/common/TokenIcon';
import type { AavePosition } from '@/hooks/useAavePositions';
import type { LendingMarket } from '@/hooks/useLendingMarkets';

function fmtAmount(val: string): string {
  const n = parseFloat(val);
  if (!Number.isFinite(n) || n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtUsd(val: number): string {
  if (!Number.isFinite(val) || val === 0) return '$0.00';
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

/** Build Aave App URL for Collateral Swap */
function aaveCollateralSwapUrl(chainId: number, assetAddress: string): string {
  const chainMap: Record<number, string> = {
    1: 'ethereum',
    42161: 'arbitrum',
    10: 'optimism',
    137: 'polygon',
    8453: 'base',
    43114: 'avalanche',
  };
  const chainSlug = chainMap[chainId] || 'ethereum';
  return `https://app.aave.com/?marketName=proto_${chainSlug}_v3`;
}

interface YourSuppliesSectionProps {
  positions: AavePosition[];
  onSupply: (market: LendingMarket) => void;
  onWithdraw: (position: AavePosition) => void;
  onSwap: (chainId: number, symbol: string, address: string) => void;
}

export function YourSuppliesSection({
  positions,
  onSupply,
  onWithdraw,
  onSwap,
}: YourSuppliesSectionProps) {
  const supplied = positions
    .filter(p => p.supplyBalance > 0n)
    .sort((a, b) => b.supplyBalanceUsd - a.supplyBalanceUsd);

  if (supplied.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      {/* Section header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-success" />
        <h2 className="text-sm font-semibold text-foreground">Your Supplies</h2>
        <Badge variant="outline" className="h-4 px-1.5 text-[10px] bg-success/10 border-success/30 text-success">
          {supplied.length}
        </Badge>
        <span className="text-[10px] text-muted-foreground ml-1">Aave V3</span>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block glass rounded-xl overflow-hidden border border-success/10">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/40 bg-success/5">
              <th className="text-left p-3 text-xs font-medium text-muted-foreground">Asset</th>
              <th className="text-right p-3 text-xs font-medium text-muted-foreground">Balance</th>
              <th className="text-right p-3 text-xs font-medium text-muted-foreground">APY</th>
              <th className="text-center p-3 text-xs font-medium text-muted-foreground">Collateral</th>
              <th className="text-right p-3 w-64"></th>
            </tr>
          </thead>
          <tbody>
            {supplied.map((pos, i) => (
              <motion.tr
                key={`${pos.chainId}-${pos.assetAddress}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="border-b border-border/20 hover:bg-success/5 transition-colors"
              >
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <TokenIcon
                        address={pos.assetAddress}
                        symbol={pos.assetSymbol}
                        chainId={pos.chainId}
                        logoUrl={pos.assetLogo}
                        size="sm"
                        className="w-7 h-7"
                      />
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-background overflow-hidden">
                        <ChainIcon chainId={pos.chainId} size="sm" />
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-sm">{pos.assetSymbol}</div>
                      <div className="text-[11px] text-muted-foreground">{pos.chainName}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-right">
                  <div className="text-sm font-medium">
                    {fmtAmount(pos.supplyBalanceFormatted)} {pos.assetSymbol}
                  </div>
                  {pos.supplyBalanceUsd > 0 && (
                    <div className="text-xs text-muted-foreground">{fmtUsd(pos.supplyBalanceUsd)}</div>
                  )}
                </td>
                <td className="p-3 text-right">
                  <span className="text-sm font-medium text-success">{pos.supplyApy.toFixed(2)}%</span>
                </td>
                <td className="p-3 text-center">
                  {pos.isCollateralEnabled ? (
                    <ShieldCheck className="w-4 h-4 text-success mx-auto" />
                  ) : (
                    <Shield className="w-4 h-4 text-muted-foreground mx-auto" />
                  )}
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1"
                      onClick={() => pos.market && onSupply(pos.market)}>
                      <ArrowUpRight className="w-3 h-3" /> Supply
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs gap-1"
                      onClick={() => onWithdraw(pos)}>
                      <ArrowDownLeft className="w-3 h-3" /> Withdraw
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2.5 text-xs gap-1 text-primary"
                      title="Collateral Swap — swap this collateral for another asset without withdrawing"
                      onClick={() => window.open(aaveCollateralSwapUrl(pos.chainId, pos.assetAddress), '_blank')}
                    >
                      <Repeat className="w-3 h-3" />
                      Collateral Swap
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </Button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {supplied.map((pos) => (
          <div
            key={`${pos.chainId}-${pos.assetAddress}`}
            className="glass rounded-xl p-3.5 border border-success/15"
          >
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="relative">
                <TokenIcon
                  address={pos.assetAddress}
                  symbol={pos.assetSymbol}
                  chainId={pos.chainId}
                  logoUrl={pos.assetLogo}
                  size="sm"
                  className="w-8 h-8"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-background overflow-hidden">
                  <ChainIcon chainId={pos.chainId} size="sm" />
                </div>
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">{pos.assetSymbol}</div>
                <div className="text-[11px] text-muted-foreground">{pos.chainName}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-success">{pos.supplyApy.toFixed(2)}%</div>
                <div className="text-[10px] text-muted-foreground">APY</div>
              </div>
            </div>
            <div className="flex items-center justify-between mb-2.5 text-xs">
              <div>
                <div className="text-muted-foreground">Balance</div>
                <div className="font-medium">{fmtAmount(pos.supplyBalanceFormatted)} {pos.assetSymbol}</div>
                {pos.supplyBalanceUsd > 0 && (
                  <div className="text-muted-foreground">{fmtUsd(pos.supplyBalanceUsd)}</div>
                )}
              </div>
              {pos.isCollateralEnabled && (
                <Badge variant="outline" className="h-5 text-[10px] gap-1 border-success/30 text-success">
                  <ShieldCheck className="w-3 h-3" /> Collateral
                </Badge>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1"
                onClick={() => pos.market && onSupply(pos.market)}>
                <ArrowUpRight className="w-3 h-3" /> Supply
              </Button>
              <Button size="sm" variant="ghost" className="flex-1 h-8 text-xs gap-1"
                onClick={() => onWithdraw(pos)}>
                <ArrowDownLeft className="w-3 h-3" /> Withdraw
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs gap-1 text-primary"
                onClick={() => window.open(aaveCollateralSwapUrl(pos.chainId, pos.assetAddress), '_blank')}
              >
                <Repeat className="w-3 h-3" />
                Collateral Swap
              </Button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
