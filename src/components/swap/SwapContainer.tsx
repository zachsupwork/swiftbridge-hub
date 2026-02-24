import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bitcoin, ArrowLeftRight, ArrowRight } from 'lucide-react';
import { SwapCard } from './SwapCard';
import { BtcDepositFlow } from './btc/BtcDepositFlow';
import { EvmToBtcFlow } from './btc/EvmToBtcFlow';
import { cn } from '@/lib/utils';

type SwapMode = 'evm' | 'btc-to-evm' | 'evm-to-btc';

export function SwapContainer() {
  const [mode, setMode] = useState<SwapMode>('evm');

  if (mode === 'btc-to-evm') {
    return <BtcDepositFlow onBack={() => setMode('evm')} />;
  }

  if (mode === 'evm-to-btc') {
    return <EvmToBtcFlow onBack={() => setMode('evm')} />;
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-3">
      {/* Mode toggle */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <button
          onClick={() => setMode('evm')}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all border",
            "bg-primary/10 border-primary/30 text-primary"
          )}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          EVM Swap
        </button>
        <button
          onClick={() => setMode('btc-to-evm')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all border bg-muted/30 border-border/30 text-muted-foreground hover:bg-muted/50"
        >
          <Bitcoin className="w-3.5 h-3.5" />
          BTC → EVM
        </button>
        <button
          onClick={() => setMode('evm-to-btc')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all border bg-muted/30 border-border/30 text-muted-foreground hover:bg-muted/50"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          EVM → BTC
        </button>
      </div>

      <SwapCard />
    </div>
  );
}
