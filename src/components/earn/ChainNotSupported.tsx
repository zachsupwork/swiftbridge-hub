/**
 * Chain Not Supported Panel
 * 
 * Displayed when the connected wallet is on a chain
 * that doesn't support Earn/Lending features.
 */

import { AlertCircle } from 'lucide-react';
import { useSwitchChain } from 'wagmi';
import { Button } from '@/components/ui/button';
import { EARN_CHAIN_NAMES, EARN_CHAIN_LOGOS, EARN_SUPPORTED_CHAINS } from '@/lib/aaveV3';

interface ChainNotSupportedProps {
  currentChainId?: number;
}

export function ChainNotSupported({ currentChainId }: ChainNotSupportedProps) {
  const { switchChain, isPending } = useSwitchChain();

  return (
    <div className="glass rounded-2xl p-6 sm:p-8 text-center max-w-lg mx-auto">
      <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
      
      <h3 className="text-xl font-semibold mb-2">Chain Not Supported</h3>
      
      <p className="text-muted-foreground mb-6">
        Earn is not supported on this network yet. 
        Switch to one of the supported chains below.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {EARN_SUPPORTED_CHAINS.map((chainId) => (
          <Button
            key={chainId}
            variant="outline"
            size="sm"
            className="h-10 gap-2"
            onClick={() => switchChain?.({ chainId })}
            disabled={isPending || chainId === currentChainId}
          >
            <img 
              src={EARN_CHAIN_LOGOS[chainId]} 
              alt="" 
              className="w-4 h-4 rounded-full"
            />
            <span className="text-xs">{EARN_CHAIN_NAMES[chainId]}</span>
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        More chains coming soon
      </p>
    </div>
  );
}
