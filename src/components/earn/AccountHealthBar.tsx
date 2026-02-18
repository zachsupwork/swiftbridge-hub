/**
 * Account Health Summary Bar — Aave-style
 * 
 * Compact summary of health factor, LTV, collateral, debt, available borrows.
 * Shows when the wallet has any collateral or borrow position.
 */

import { motion } from 'framer-motion';
import { Heart, AlertTriangle, DollarSign, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RiskBar } from '@/components/common/RiskBar';
import type { AaveChainAccountData } from '@/hooks/useAavePositions';

function fmtUsd(val: number): string {
  if (!Number.isFinite(val) || val === 0) return '$0.00';
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

function HealthColor(hf: number | null): string {
  if (hf === null || hf > 1e10) return 'text-success';
  if (hf > 2) return 'text-success';
  if (hf > 1.2) return 'text-warning';
  return 'text-destructive';
}

interface AccountHealthBarProps {
  chainAccountData: AaveChainAccountData[];
  totalCollateralUsd: number;
  totalDebtUsd: number;
  lowestHealthFactor: number | null;
}

export function AccountHealthBar({
  chainAccountData,
  totalCollateralUsd,
  totalDebtUsd,
  lowestHealthFactor,
}: AccountHealthBarProps) {
  if (totalCollateralUsd === 0 && totalDebtUsd === 0) return null;

  const totalAvailable = chainAccountData.reduce((a, d) => a + d.availableBorrowsUsd, 0);
  const aggLtv = chainAccountData.reduce((a, d) => a + d.ltv, 0) / Math.max(chainAccountData.length, 1);
  const aggLiqThresh = chainAccountData.reduce((a, d) => a + (d as any).liquidationThreshold || 0, 0) / Math.max(chainAccountData.length, 1);

  const hfDisplay =
    lowestHealthFactor === null || lowestHealthFactor > 1e10
      ? '∞'
      : lowestHealthFactor.toFixed(2);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl border border-border/30 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Heart className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Account Health</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
        {/* Health Factor */}
        <div className="glass rounded-lg p-2.5">
          <div className="text-[11px] text-muted-foreground mb-0.5 flex items-center gap-1">
            <Heart className="w-3 h-3" />
            Health Factor
          </div>
          <div className={cn('text-lg font-bold', HealthColor(lowestHealthFactor))}>
            {hfDisplay}
          </div>
          {lowestHealthFactor !== null && lowestHealthFactor < 1e10 && lowestHealthFactor < 1.5 && (
            <div className="text-[10px] text-warning flex items-center gap-0.5 mt-0.5">
              <AlertTriangle className="w-2.5 h-2.5" />
              {lowestHealthFactor < 1 ? 'Liquidation risk!' : 'Low — add collateral'}
            </div>
          )}
        </div>

        {/* Total Collateral */}
        <div className="glass rounded-lg p-2.5">
          <div className="text-[11px] text-muted-foreground mb-0.5 flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            Collateral
          </div>
          <div className="text-base font-semibold text-primary">{fmtUsd(totalCollateralUsd)}</div>
        </div>

        {/* Total Debt */}
        <div className="glass rounded-lg p-2.5">
          <div className="text-[11px] text-muted-foreground mb-0.5">Total Debt</div>
          <div className={cn('text-base font-semibold', totalDebtUsd > 0 ? 'text-warning' : 'text-muted-foreground')}>
            {fmtUsd(totalDebtUsd)}
          </div>
        </div>

        {/* Available to Borrow */}
        <div className="glass rounded-lg p-2.5">
          <div className="text-[11px] text-muted-foreground mb-0.5">Available to Borrow</div>
          <div className="text-base font-semibold text-success">{fmtUsd(totalAvailable)}</div>
        </div>

        {/* LTV */}
        <div className="glass rounded-lg p-2.5">
          <div className="text-[11px] text-muted-foreground mb-0.5 flex items-center gap-1">
            <Percent className="w-3 h-3" />
            Current LTV
          </div>
          <div className="text-base font-semibold">
            {aggLtv > 0 ? `${(aggLtv * 100).toFixed(1)}%` : '—'}
          </div>
        </div>
      </div>

      {/* Health factor bar (only when there's debt) */}
      {totalDebtUsd > 0 && lowestHealthFactor !== null && lowestHealthFactor < 1e10 && (
        <RiskBar healthFactor={lowestHealthFactor} showLabel size="sm" />
      )}
    </motion.div>
  );
}
