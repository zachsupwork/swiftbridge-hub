import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Info, Settings } from 'lucide-react';
import { getIntegratorFee, formatFeePercentage, Route } from '@/lib/lifiClient';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Get integrator info from environment
const INTEGRATOR = import.meta.env.VITE_LIFI_INTEGRATOR || 'cryptodefibridge';

interface IntegratorDebugPanelProps {
  route: Route | null;
  fromChainId: number;
  toChainId: number;
  className?: string;
}

export function IntegratorFeeTooltip() {
  const fee = getIntegratorFee();
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Info className="w-3.5 h-3.5" />
          <span>Fees</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="text-sm">
          Crypto DeFi Bridge fee ({formatFeePercentage(fee)}) is applied on every LI.FI route.
          This helps support the platform.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function IntegratorDebugPanel({ route, fromChainId, toChainId, className }: IntegratorDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fee = getIntegratorFee();
  
  // Only show in development
  const isDev = import.meta.env.DEV;
  
  if (!isDev) return null;

  // Extract tool names from route steps
  const toolNames = route?.steps.map(step => step.tool).filter(Boolean) || [];
  const uniqueTools = [...new Set(toolNames)];

  return (
    <div className={cn("border border-border rounded-lg overflow-hidden", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">Developer Debug</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 pt-0 space-y-2 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/50 rounded p-2">
                  <span className="text-muted-foreground block">Integrator</span>
                  <span className="text-foreground">{INTEGRATOR}</span>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <span className="text-muted-foreground block">Fee</span>
                  <span className="text-foreground">{formatFeePercentage(fee)} ({fee})</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/50 rounded p-2">
                  <span className="text-muted-foreground block">From Chain</span>
                  <span className="text-foreground">{fromChainId}</span>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <span className="text-muted-foreground block">To Chain</span>
                  <span className="text-foreground">{toChainId}</span>
                </div>
              </div>

              {route && (
                <>
                  <div className="bg-muted/50 rounded p-2">
                    <span className="text-muted-foreground block">Route ID</span>
                    <span className="text-foreground break-all">{route.id}</span>
                  </div>
                  
                  <div className="bg-muted/50 rounded p-2">
                    <span className="text-muted-foreground block">Tools/Bridges</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {uniqueTools.length > 0 ? (
                        uniqueTools.map((tool, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-primary/20 text-primary rounded text-[10px]">
                            {tool}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">No route selected</span>
                      )}
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded p-2">
                    <span className="text-muted-foreground block">Steps</span>
                    <span className="text-foreground">{route.steps.length}</span>
                  </div>

                  {route.tags.length > 0 && (
                    <div className="bg-muted/50 rounded p-2">
                      <span className="text-muted-foreground block">Tags</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {route.tags.map((tag, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-secondary/20 text-secondary rounded text-[10px]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
