/**
 * TokenIcon Component
 * 
 * Deterministic token logo display using the global logo resolver.
 * Multi-step fallback chain via onError — no flicker on initial render.
 */

import { memo, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { buildTokenLogoFallbacks, GENERIC_TOKEN_ICON } from '@/lib/logoResolver';

interface TokenIconProps {
  address?: string;
  symbol?: string;
  chainId?: number;
  logoUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
  xl: 'w-12 h-12',
};

export const TokenIcon = memo(function TokenIcon({ 
  address, 
  symbol, 
  chainId,
  logoUrl,
  size = 'md',
  className,
}: TokenIconProps) {
  const [fallbackIdx, setFallbackIdx] = useState(0);
  
  const fallbacks = useMemo(() => 
    buildTokenLogoFallbacks({ address, symbol, chainId, logoURI: logoUrl }),
    [address, symbol, chainId, logoUrl]
  );

  const currentSrc = fallbackIdx < fallbacks.length ? fallbacks[fallbackIdx] : GENERIC_TOKEN_ICON;

  return (
    <img
      src={currentSrc}
      alt={symbol || 'Token'}
      className={cn(SIZE_CLASSES[size], 'rounded-full bg-muted object-cover', className)}
      onError={() => setFallbackIdx(prev => Math.min(prev + 1, fallbacks.length - 1))}
      loading="lazy"
    />
  );
});

export default TokenIcon;
