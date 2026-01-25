/**
 * How It Works Diagram
 * 
 * Educational diagram explaining Morpho lending mechanics.
 */

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, 
  ChevronUp, 
  Shield, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Wallet,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HowItWorksDiagramProps {
  className?: string;
  defaultExpanded?: boolean;
}

export const HowItWorksDiagram = memo(function HowItWorksDiagram({
  className,
  defaultExpanded = false,
}: HowItWorksDiagramProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const steps = [
    {
      icon: <Shield className="w-5 h-5" />,
      title: 'Supply Collateral',
      description: 'Deposit assets as collateral to unlock borrowing power.',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/30',
    },
    {
      icon: <Wallet className="w-5 h-5" />,
      title: 'Borrow',
      description: 'Borrow up to your LLTV limit. Higher LTV = higher risk.',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/30',
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      title: 'Monitor Health',
      description: 'Keep health factor > 1. Below 1 = liquidation risk.',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/30',
    },
    {
      icon: <TrendingDown className="w-5 h-5" />,
      title: 'Repay Debt',
      description: 'Repay borrowed amount + interest to reduce risk.',
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/30',
    },
  ];

  const riskFactors = [
    { action: 'Supply collateral', effect: '↑ Borrowing power', risk: '—' },
    { action: 'Borrow', effect: '↑ Debt', risk: '↑ Risk' },
    { action: 'Repay', effect: '↓ Debt', risk: '↓ Risk' },
    { action: 'Withdraw collateral', effect: '↓ Borrowing power', risk: '↑ Risk (if debt exists)' },
  ];

  return (
    <div className={cn('glass rounded-xl overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-primary" />
          <span className="font-semibold">How Morpho Lending Works</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 pt-0 space-y-6">
              {/* Flow diagram */}
              <div className="relative">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {steps.map((step, index) => (
                    <motion.div
                      key={step.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={cn(
                        'relative p-4 rounded-lg border',
                        step.bgColor,
                        step.borderColor,
                      )}
                    >
                      <div className={cn('mb-2', step.color)}>
                        {step.icon}
                      </div>
                      <h4 className="font-medium text-sm mb-1">{step.title}</h4>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                      
                      {/* Arrow for desktop */}
                      {index < steps.length - 1 && (
                        <div className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-10">
                          <ArrowRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Risk table */}
              <div>
                <h4 className="font-medium mb-3 text-sm">Risk Impact Summary</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Action</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Effect</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riskFactors.map((row, index) => (
                        <tr key={index} className="border-b border-border/30">
                          <td className="py-2 px-3">{row.action}</td>
                          <td className="py-2 px-3 text-primary">{row.effect}</td>
                          <td className={cn(
                            'py-2 px-3',
                            row.risk.includes('↑') && 'text-warning',
                            row.risk.includes('↓') && 'text-success',
                          )}>
                            {row.risk}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Key terms */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/20">
                <div>
                  <div className="font-medium text-sm">LLTV</div>
                  <div className="text-xs text-muted-foreground">
                    Liquidation Loan-to-Value. Max LTV before liquidation.
                  </div>
                </div>
                <div>
                  <div className="font-medium text-sm">Health Factor</div>
                  <div className="text-xs text-muted-foreground">
                    Collateral value ÷ Debt. Below 1 = liquidatable.
                  </div>
                </div>
                <div>
                  <div className="font-medium text-sm">APY</div>
                  <div className="text-xs text-muted-foreground">
                    Variable rates based on market utilization.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default HowItWorksDiagram;
