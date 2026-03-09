/**
 * Reusable platform fee disclosure row for Aave action modals.
 */

import { parseUnits, formatUnits } from 'viem';
import { calcPlatformFee, PLATFORM_FEE_PERCENT } from '@/lib/platformFee';
import { Info } from 'lucide-react';

interface PlatformFeeRowProps {
  amount: string;
  decimals: number;
  symbol: string;
  priceUsd?: number;
}

export function PlatformFeeRow({ amount, decimals, symbol, priceUsd }: PlatformFeeRowProps) {
  const parsed = parseFloat(amount);
  if (!parsed || parsed <= 0) return null;

  let feeFormatted = '0';
  let feeUsd = '';

  try {
    const raw = parseUnits(amount, decimals);
    const fee = calcPlatformFee(raw);
    feeFormatted = parseFloat(formatUnits(fee, decimals)).toFixed(6);
    if (priceUsd) {
      feeUsd = `$${(parseFloat(formatUnits(fee, decimals)) * priceUsd).toFixed(4)}`;
    }
  } catch {
    return null;
  }

  return (
    <div className="flex items-center justify-between text-xs px-1 py-1.5 rounded-md bg-muted/30 border border-border/50">
      <span className="flex items-center gap-1 text-muted-foreground">
        <Info className="w-3 h-3" />
        Platform fee ({PLATFORM_FEE_PERCENT}%)
      </span>
      <span className="text-foreground font-medium">
        {feeFormatted} {symbol}
        {feeUsd && <span className="text-muted-foreground ml-1">({feeUsd})</span>}
      </span>
    </div>
  );
}
