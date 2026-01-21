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
      
      <h3 className="text-xl font-semibold mb-2">Network Not Supported</h3>
      
      <p className="text-muted-foreground mb-6">
        Aave v3 Earn is only available on Ethereum Mainnet and Sepolia Testnet.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        {EARN_SUPPORTED_CHAINS.map((cId) => (
          <Button
            key={cId}
            variant="outline"
            className="h-11 gap-2"
            onClick={() => switchChain?.({ chainId: cId })}
            disabled={isPending || cId === currentChainId}
          >
            <img 
              src={EARN_CHAIN_LOGOS[cId]} 
              alt="" 
              className="w-5 h-5 rounded-full"
            />
            <span>{EARN_CHAIN_NAMES[cId]}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
