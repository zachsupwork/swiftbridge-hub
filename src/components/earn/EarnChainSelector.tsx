/**
 * Chain selector for Earn page - Aave-style dropdown
 */

import { ChevronDown, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Chain {
  id: number;
  name: string;
  logo: string;
  supported: boolean;
}

interface EarnChainSelectorProps {
  chains: Chain[];
  selectedChainId: number | 'all';
  onChainChange: (chainId: number | 'all') => void;
  className?: string;
}

export function EarnChainSelector({
  chains,
  selectedChainId,
  onChainChange,
  className,
}: EarnChainSelectorProps) {
  const selectedChain = selectedChainId === 'all' 
    ? null 
    : chains.find(c => c.id === selectedChainId);

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
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => onChainChange('all')}
          className="gap-2 cursor-pointer"
        >
          <div className="w-5 h-5 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary-foreground">All</span>
          </div>
          <span>All Chains</span>
          {selectedChainId === 'all' && (
            <Check className="w-4 h-4 ml-auto text-primary" />
          )}
        </DropdownMenuItem>
        
        {chains.map((chain) => (
          <DropdownMenuItem
            key={chain.id}
            onClick={() => chain.supported && onChainChange(chain.id)}
            className={cn(
              "gap-2 cursor-pointer",
              !chain.supported && "opacity-50 cursor-not-allowed"
            )}
            disabled={!chain.supported}
          >
            <img 
              src={chain.logo} 
              alt={chain.name}
              className="w-5 h-5 rounded-full"
            />
            <span className="flex-1">{chain.name}</span>
            {!chain.supported ? (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                No markets
              </span>
            ) : selectedChainId === chain.id && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
