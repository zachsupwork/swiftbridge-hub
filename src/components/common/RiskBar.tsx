/**
 * RiskBar Component
 * 
 * Visual representation of health/risk level for lending positions.
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Shield, Skull } from 'lucide-react';

interface RiskBarProps {
  healthFactor: number | null;
  lltv?: number;
  currentLtv?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const RiskBar = memo(function RiskBar({ 
  healthFactor, 
  lltv = 86,
  currentLtv,
  showLabel = true,
  size = 'md',
  className,
}: RiskBarProps) {
  // Calculate risk percentage (0-100)
  // Health factor > 2 = very safe (0-30%)
  // Health factor 1.5-2 = safe (30-50%)
  // Health factor 1.2-1.5 = moderate (50-70%)
  // Health factor 1-1.2 = risky (70-90%)
  // Health factor < 1 = liquidatable (90-100%)
  
  let riskPercentage = 0;
  let riskLevel: 'safe' | 'moderate' | 'risky' | 'danger' = 'safe';
  let riskLabel = 'Safe';
  
  if (healthFactor === null) {
    // No borrow = completely safe
    riskPercentage = 0;
    riskLevel = 'safe';
    riskLabel = 'No Debt';
  } else if (healthFactor >= 2) {
    riskPercentage = 20;
    riskLevel = 'safe';
    riskLabel = 'Very Safe';
  } else if (healthFactor >= 1.5) {
    riskPercentage = 30 + ((2 - healthFactor) / 0.5) * 20;
    riskLevel = 'safe';
    riskLabel = 'Safe';
  } else if (healthFactor >= 1.2) {
    riskPercentage = 50 + ((1.5 - healthFactor) / 0.3) * 20;
    riskLevel = 'moderate';
    riskLabel = 'Moderate';
  } else if (healthFactor >= 1) {
    riskPercentage = 70 + ((1.2 - healthFactor) / 0.2) * 20;
    riskLevel = 'risky';
    riskLabel = 'At Risk';
  } else {
    riskPercentage = 95;
    riskLevel = 'danger';
    riskLabel = 'Liquidatable';
  }

  // Use LTV if provided
  if (currentLtv !== undefined && lltv > 0) {
    const ltvRatio = currentLtv / lltv;
    riskPercentage = Math.min(ltvRatio * 100, 100);
    
    if (ltvRatio < 0.5) {
      riskLevel = 'safe';
      riskLabel = 'Safe';
    } else if (ltvRatio < 0.75) {
      riskLevel = 'moderate';
      riskLabel = 'Moderate';
    } else if (ltvRatio < 0.95) {
      riskLevel = 'risky';
      riskLabel = 'At Risk';
    } else {
      riskLevel = 'danger';
      riskLabel = 'Danger';
    }
  }

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  const getGradientColor = () => {
    switch (riskLevel) {
      case 'safe': return 'from-success to-success';
      case 'moderate': return 'from-success via-warning to-warning';
      case 'risky': return 'from-warning to-destructive';
      case 'danger': return 'from-destructive to-destructive';
    }
  };

  const getIcon = () => {
    switch (riskLevel) {
      case 'safe': return <Shield className="w-3.5 h-3.5 text-success" />;
      case 'moderate': return <AlertTriangle className="w-3.5 h-3.5 text-warning" />;
      case 'risky': return <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
      case 'danger': return <Skull className="w-3.5 h-3.5 text-destructive" />;
    }
  };

  return (
    <div className={cn('space-y-1', className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            {getIcon()}
            <span className={cn(
              'font-medium',
              riskLevel === 'safe' && 'text-success',
              riskLevel === 'moderate' && 'text-warning',
              riskLevel === 'risky' && 'text-destructive',
              riskLevel === 'danger' && 'text-destructive',
            )}>
              {riskLabel}
            </span>
          </div>
          {healthFactor !== null && (
            <span className="text-muted-foreground">
              HF: {healthFactor > 10 ? '>10' : healthFactor.toFixed(2)}
            </span>
          )}
        </div>
      )}
      
      <div className={cn('w-full bg-muted rounded-full overflow-hidden', sizeClasses[size])}>
        <div 
          className={cn(
            'h-full rounded-full transition-all duration-500 bg-gradient-to-r',
            getGradientColor(),
          )}
          style={{ width: `${Math.max(riskPercentage, 2)}%` }}
        />
      </div>
      
      {/* LLTV marker */}
      {currentLtv !== undefined && lltv > 0 && (
        <div className="relative h-0">
          <div 
            className="absolute top-0 w-0.5 h-2 bg-destructive/50 -translate-y-full"
            style={{ left: `${lltv}%` }}
          />
        </div>
      )}
    </div>
  );
});

export default RiskBar;
