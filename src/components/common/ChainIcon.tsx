/**
 * ChainIcon Component
 * 
 * Displays chain logos with reliable fallbacks.
 */

import { memo, useState } from 'react';
import { cn } from '@/lib/utils';

// Chain logos by chain ID
const CHAIN_LOGOS: Record<number, string> = {
  1: 'https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg',
  10: 'https://icons.llamao.fi/icons/chains/rsz_optimism.jpg',
  56: 'https://icons.llamao.fi/icons/chains/rsz_binance.jpg',
  100: 'https://icons.llamao.fi/icons/chains/rsz_gnosis.jpg',
  137: 'https://icons.llamao.fi/icons/chains/rsz_polygon.jpg',
  250: 'https://icons.llamao.fi/icons/chains/rsz_fantom.jpg',
  324: 'https://icons.llamao.fi/icons/chains/rsz_zksync.jpg',
  8453: 'https://icons.llamao.fi/icons/chains/rsz_base.jpg',
  42161: 'https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg',
  43114: 'https://icons.llamao.fi/icons/chains/rsz_avalanche.jpg',
  59144: 'https://icons.llamao.fi/icons/chains/rsz_linea.jpg',
  534352: 'https://icons.llamao.fi/icons/chains/rsz_scroll.jpg',
};

// Chain names
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  56: 'BNB Chain',
  100: 'Gnosis',
  137: 'Polygon',
  250: 'Fantom',
  324: 'zkSync Era',
  8453: 'Base',
  42161: 'Arbitrum',
  43114: 'Avalanche',
  59144: 'Linea',
  534352: 'Scroll',
};

// Generic chain icon placeholder
const GENERIC_CHAIN_ICON = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236b7280"%3E%3Ccircle cx="12" cy="12" r="10" stroke="%234b5563" stroke-width="2" fill="none"/%3E%3Ctext x="12" y="16" font-size="10" text-anchor="middle" fill="%236b7280"%3E%3F%3C/text%3E%3C/svg%3E';

interface ChainIconProps {
  chainId: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showTooltip?: boolean;
}

export const ChainIcon = memo(function ChainIcon({ 
  chainId, 
  size = 'sm',
  className,
  showTooltip = false,
}: ChainIconProps) {
  const [hasError, setHasError] = useState(false);
  
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const logoUrl = CHAIN_LOGOS[chainId] || GENERIC_CHAIN_ICON;
  const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;

  return (
    <img
      src={hasError ? GENERIC_CHAIN_ICON : logoUrl}
      alt={chainName}
      title={showTooltip ? chainName : undefined}
      className={cn(sizeClasses[size], 'rounded-full bg-card', className)}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
});

export function getChainName(chainId: number): string {
  return CHAIN_NAMES[chainId] || `Chain ${chainId}`;
}

export function getChainLogo(chainId: number): string {
  return CHAIN_LOGOS[chainId] || GENERIC_CHAIN_ICON;
}

export default ChainIcon;
