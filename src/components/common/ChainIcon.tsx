/**
 * ChainIcon Component
 * 
 * Deterministic chain logo display using the global logo resolver.
 * No flicker, no late-swap, no text fallback.
 */

import { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import { resolveChainLogo, resolveChainName, GENERIC_CHAIN_ICON } from '@/lib/logoResolver';

interface ChainIconProps {
  chainId: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showTooltip?: boolean;
}

const SIZE_CLASSES = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export const ChainIcon = memo(function ChainIcon({ 
  chainId, 
  size = 'sm',
  className,
  showTooltip = false,
}: ChainIconProps) {
  const [hasError, setHasError] = useState(false);
  
  const logoUrl = resolveChainLogo(chainId);
  const chainName = resolveChainName(chainId);

  return (
    <img
      src={hasError ? GENERIC_CHAIN_ICON : logoUrl}
      alt={chainName}
      title={showTooltip ? chainName : undefined}
      className={cn(SIZE_CLASSES[size], 'rounded-full bg-card', className)}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
});

// Re-export resolver functions for backward compat
export { resolveChainName as getChainName, resolveChainLogo as getChainLogo };

export default ChainIcon;
