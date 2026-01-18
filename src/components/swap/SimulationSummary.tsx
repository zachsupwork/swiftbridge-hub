import { motion } from 'framer-motion';
import { Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimulationSummaryProps {
  to: string;
  valueEth: string;
  gasLimit: string;
  isNativeToken: boolean;
  fromTokenSymbol: string;
  dataLength: number;
  className?: string;
}

export function SimulationSummary({
  to,
  valueEth,
  gasLimit,
  isNativeToken,
  fromTokenSymbol,
  dataLength,
  className,
}: SimulationSummaryProps) {
  const valueNum = parseFloat(valueEth);
  const isValueSuspicious = !isNativeToken && valueNum > 0.01;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn('bg-muted/50 rounded-xl p-4 space-y-3', className)}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Info className="w-4 h-4 text-primary" />
        Transaction Simulation
      </div>

      <div className="space-y-2 text-sm">
        {/* To address */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Contract</span>
          <span className="font-mono text-xs">
            {to.slice(0, 6)}...{to.slice(-4)}
          </span>
        </div>

        {/* Value */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Value (ETH)</span>
          <span
            className={cn(
              'font-medium',
              isValueSuspicious ? 'text-destructive' : 'text-foreground'
            )}
          >
            {valueEth}
            {isValueSuspicious && (
              <AlertTriangle className="w-3 h-3 inline ml-1" />
            )}
          </span>
        </div>

        {/* Gas limit */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Gas Limit</span>
          <span>{gasLimit}</span>
        </div>

        {/* Token type */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Token Type</span>
          <span className="flex items-center gap-1">
            {isNativeToken ? (
              <>
                <span className="text-primary">Native</span>
                <span className="text-muted-foreground">({fromTokenSymbol})</span>
              </>
            ) : (
              <>
                <span className="text-accent-foreground">ERC-20</span>
                <span className="text-muted-foreground">({fromTokenSymbol})</span>
              </>
            )}
          </span>
        </div>

        {/* Data length */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Data Size</span>
          <span>{Math.floor(dataLength / 2)} bytes</span>
        </div>

        {/* Validation status */}
        <div className="flex justify-between items-center pt-2 border-t border-border">
          <span className="text-muted-foreground">Status</span>
          {isValueSuspicious ? (
            <span className="flex items-center gap-1 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Suspicious value
            </span>
          ) : (
            <span className="flex items-center gap-1 text-green-500">
              <CheckCircle className="w-4 h-4" />
              Ready to send
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
