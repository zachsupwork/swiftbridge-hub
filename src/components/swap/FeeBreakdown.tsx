import { Route, getIntegratorFee, formatFeePercentage } from '@/lib/lifiClient';
import { Info, Clock, DollarSign, Percent, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface FeeBreakdownProps {
  route: Route;
}

export function FeeBreakdown({ route }: FeeBreakdownProps) {
  const integratorFee = getIntegratorFee();
  const fromAmountUSD = parseFloat(route.fromAmountUSD) || 0;
  const integratorFeeUSD = fromAmountUSD * integratorFee;

  // Collect all fee costs from steps
  const feeCosts: { name: string; amountUSD: number }[] = [];
  const gasCosts: { name: string; amountUSD: number }[] = [];

  route.steps.forEach(step => {
    if (step.estimate.feeCosts) {
      step.estimate.feeCosts.forEach(fee => {
        feeCosts.push({
          name: fee.name || 'Protocol Fee',
          amountUSD: parseFloat(fee.amountUSD || '0'),
        });
      });
    }
    if (step.estimate.gasCosts) {
      step.estimate.gasCosts.forEach(gas => {
        gasCosts.push({
          name: `${gas.type} Gas`,
          amountUSD: parseFloat(gas.amountUSD || '0'),
        });
      });
    }
  });

  const totalGasUSD = gasCosts.reduce((sum, g) => sum + g.amountUSD, 0);
  const totalProtocolFeesUSD = feeCosts.reduce((sum, f) => sum + f.amountUSD, 0);
  const totalDuration = route.steps.reduce((sum, s) => sum + (s.estimate.executionDuration || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 space-y-3"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Info className="w-4 h-4 text-primary" />
        Fee Breakdown
      </div>

      <div className="space-y-2 text-sm">
        {/* Route steps */}
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-3">
          {route.steps.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-1">
              <span className="bg-muted px-2 py-1 rounded">{step.toolDetails.name}</span>
              {idx < route.steps.length - 1 && <ArrowRight className="w-3 h-3" />}
            </div>
          ))}
        </div>

        {/* Estimated time */}
        <div className="flex items-center justify-between py-2 border-t border-border">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Estimated Time</span>
          </div>
          <span className="font-medium">{Math.ceil(totalDuration / 60)} min</span>
        </div>

        {/* Gas costs */}
        <div className="flex items-center justify-between py-2 border-t border-border">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>⛽</span>
            <span>Network Gas</span>
          </div>
          <span className="font-medium">${totalGasUSD.toFixed(2)}</span>
        </div>

        {/* Protocol fees */}
        {totalProtocolFeesUSD > 0 && (
          <div className="flex items-center justify-between py-2 border-t border-border">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="w-4 h-4" />
              <span>Protocol Fees</span>
            </div>
            <span className="font-medium">${totalProtocolFeesUSD.toFixed(2)}</span>
          </div>
        )}

        {/* Integrator fee */}
        <div className="flex items-center justify-between py-2 border-t border-border bg-primary/5 -mx-4 px-4 rounded-lg">
          <div className="flex items-center gap-2 text-primary">
            <Percent className="w-4 h-4" />
            <span className="font-medium">Crypto DeFi Bridge Fee ({formatFeePercentage(integratorFee)})</span>
          </div>
          <span className="font-bold text-primary">${integratorFeeUSD.toFixed(4)}</span>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between py-3 border-t-2 border-border font-bold">
          <span>Total Cost</span>
          <span>${(totalGasUSD + totalProtocolFeesUSD + integratorFeeUSD).toFixed(2)}</span>
        </div>
      </div>
    </motion.div>
  );
}
