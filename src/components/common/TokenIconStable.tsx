/**
 * TokenIconStable Component
 * 
 * Deterministic token logo with color-coded letter fallback.
 * Uses global logo resolver — no flicker.
 */

import { memo, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { resolveTokenLogo, GENERIC_TOKEN_ICON } from '@/lib/logoResolver';

interface TokenIconStableProps {
  symbol: string;
  logoURI?: string;
  address?: string;
  chainId?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: 'w-4 h-4 text-[8px]',
  md: 'w-7 h-7 text-[10px]',
  lg: 'w-8 h-8 text-[11px]',
};

const COLORS: Record<string, string> = {
  ETH: 'bg-blue-500/20 text-blue-400',
  WETH: 'bg-blue-500/20 text-blue-400',
  USDC: 'bg-blue-400/20 text-blue-300',
  USDT: 'bg-emerald-500/20 text-emerald-400',
  DAI: 'bg-amber-500/20 text-amber-400',
  WBTC: 'bg-orange-500/20 text-orange-400',
  BTC: 'bg-orange-500/20 text-orange-400',
  LINK: 'bg-blue-600/20 text-blue-500',
  UNI: 'bg-pink-500/20 text-pink-400',
  AAVE: 'bg-purple-500/20 text-purple-400',
};

function getInitials(symbol: string): string {
  return symbol.slice(0, 3).toUpperCase();
}

function getColor(symbol: string): string {
  return COLORS[symbol.toUpperCase()] || 'bg-muted text-muted-foreground';
}

export const TokenIconStable = memo(function TokenIconStable({
  symbol,
  logoURI,
  address,
  chainId,
  size = 'md',
  className,
}: TokenIconStableProps) {
  // Resolve deterministically
  const resolvedUrl = useMemo(() => 
    resolveTokenLogo({ address, symbol, chainId, logoURI }),
    [address, symbol, chainId, logoURI]
  );

  const [failed, setFailed] = useState(false);
  const handleError = useCallback(() => setFailed(true), []);
  const sizeClass = SIZE_MAP[size];

  const isGeneric = resolvedUrl === GENERIC_TOKEN_ICON;

  if (isGeneric || failed) {
    return (
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-bold flex-shrink-0 select-none',
          sizeClass,
          getColor(symbol),
          className
        )}
        aria-hidden="true"
      >
        {getInitials(symbol)}
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn('rounded-full flex-shrink-0 bg-muted ring-1 ring-border/20', sizeClass, className)}
      onError={handleError}
    />
  );
});
