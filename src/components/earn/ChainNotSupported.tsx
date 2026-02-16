/**
 * Chain Not Supported Panel
 */

import { AlertCircle } from 'lucide-react';
import { EARN_SUPPORTED_CHAINS } from '@/lib/aaveV3';
import { ChainIcon, getChainName } from '@/components/common/ChainIcon';

interface ChainNotSupportedProps {
  currentChainId?: number;
}

export function ChainNotSupported({ currentChainId }: ChainNotSupportedProps) {
  return (
    <div className="glass rounded-2xl p-6 sm:p-8 text-center max-w-lg mx-auto">
      <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
      
      <h3 className="text-xl font-semibold mb-2">Network Not Supported</h3>
      
      <p className="text-muted-foreground mb-6">
        Aave V3 Earn is available on the following networks. Please switch in your wallet.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        {EARN_SUPPORTED_CHAINS.map((cId) => (
          <div
            key={cId}
            className="h-11 gap-2 flex items-center justify-center px-4 rounded-md border border-border text-sm"
          >
            <ChainIcon chainId={cId} size="md" className="w-5 h-5" />
            <span>{getChainName(cId)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
