/**
 * StatRow Component
 * 
 * Consistent stat display with label, value, and optional subtext.
 */

import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatRowProps {
  label: string;
  value: ReactNode;
  subtext?: ReactNode;
  icon?: ReactNode;
  valueClassName?: string;
  className?: string;
  direction?: 'row' | 'column';
}

export const StatRow = memo(function StatRow({
  label,
  value,
  subtext,
  icon,
  valueClassName,
  className,
  direction = 'row',
}: StatRowProps) {
  if (direction === 'column') {
    return (
      <div className={cn('space-y-1', className)}>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div className={cn('font-semibold', valueClassName)}>{value}</div>
        {subtext && (
          <div className="text-xs text-muted-foreground">{subtext}</div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-right">
        <div className={cn('font-medium', valueClassName)}>{value}</div>
        {subtext && (
          <div className="text-xs text-muted-foreground">{subtext}</div>
        )}
      </div>
    </div>
  );
});

export default StatRow;
