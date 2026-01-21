/**
 * Chain selector for Earn page - Mainnet chains only
 * NO testnets, NO "All Chains" option when single chain required
 */

import { ChevronDown, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Chain {
  id: number;
  name: string;
  logo: string;
  supported: boolean;
}

interface EarnChainSelectorProps {
  chains: readonly Chain[];
  selectedChainId: number | undefined;
  onChainChange: (chainId: number | undefined) => void;
  className?: string;
  showAllChainsOption?: boolean;
}

export function EarnChainSelector({
  chains,
  selectedChainId,
  onChainChange,
  className,
  showAllChainsOption = true,
}: EarnChainSelectorProps) {
  const selectedChain = selectedChainId 
    ? chains.find(c => c.id === selectedChainId) 
    : null;

  // Filter to only supported chains
  const supportedChains = chains.filter(c => c.supported);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-10 px-3 gap-2 bg-muted/30 border-border/50 hover:bg-muted/50",
            className
          )}
        >
          {selectedChain ? (
            <>
              <img 
                src={selectedChain.logo} 
                alt={selectedChain.name}
                className="w-5 h-5 rounded-full"
              />
              <span className="hidden sm:inline">{selectedChain.name}</span>
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary-foreground">All</span>
              </div>
              <span className="hidden sm:inline">All Chains</span>
            </>
          )}
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {showAllChainsOption && (
          <>
            <DropdownMenuItem
              onClick={() => onChainChange(undefined)}
              className="gap-2 cursor-pointer"
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary-foreground">All</span>
              </div>
              <span>All Chains</span>
              {selectedChainId === undefined && (
                <Check className="w-4 h-4 ml-auto text-primary" />
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        {supportedChains.map((chain) => (
          <DropdownMenuItem
            key={chain.id}
            onClick={() => onChainChange(chain.id)}
            className="gap-2 cursor-pointer"
          >
            <img 
              src={chain.logo} 
              alt={chain.name}
              className="w-5 h-5 rounded-full"
            />
            <span className="flex-1">{chain.name}</span>
            {selectedChainId === chain.id && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        
        <div className="px-2 py-1.5">
          <a 
            href="https://app.aave.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            View on Aave
          </a>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
