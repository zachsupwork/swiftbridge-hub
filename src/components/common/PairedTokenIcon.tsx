import { memo } from 'react';
import { cn } from '@/lib/utils';
import { TokenIconStable } from './TokenIconStable';

interface PairedTokenIconProps {
  loanSymbol: string;
  loanLogoURI?: string;
  collateralSymbol?: string;
  collateralLogoURI?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const PAIR_SIZE_MAP = {
  sm: { wrapper: 'w-6 h-4', front: 'sm' as const, back: 'sm' as const },
  md: { wrapper: 'w-10 h-7', front: 'md' as const, back: 'sm' as const },
  lg: { wrapper: 'w-12 h-8', front: 'lg' as const, back: 'md' as const },
};

export const PairedTokenIcon = memo(function PairedTokenIcon({
  loanSymbol,
  loanLogoURI,
  collateralSymbol,
  collateralLogoURI,
  size = 'md',
  className,
}: PairedTokenIconProps) {
  const sizeConfig = PAIR_SIZE_MAP[size];

  if (!collateralSymbol) {
    return (
      <TokenIconStable
        symbol={loanSymbol}
        logoURI={loanLogoURI}
        size={sizeConfig.front}
        className={className}
      />
    );
  }

  return (
    <div className={cn('relative flex-shrink-0', sizeConfig.wrapper, className)}>
      {/* Collateral behind-right */}
      <div className="absolute right-0 top-0">
        <TokenIconStable
          symbol={collateralSymbol}
          logoURI={collateralLogoURI}
          size={sizeConfig.back}
        />
      </div>
      {/* Loan front-left */}
      <div className="absolute left-0 bottom-0 z-10">
        <TokenIconStable
          symbol={loanSymbol}
          logoURI={loanLogoURI}
          size={sizeConfig.front}
        />
      </div>
    </div>
  );
});
