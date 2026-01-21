import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LendingFiltersProps {
  protocolFilter: 'all' | 'aave' | 'morpho';
  onProtocolChange: (protocol: 'all' | 'aave' | 'morpho') => void;
  chainFilter: number | 'all';
  onChainChange: (chain: number | 'all') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  chains: Array<{ id: number; name: string; logo: string }>;
}

export function LendingFilters({
  protocolFilter,
  onProtocolChange,
  chainFilter,
  onChainChange,
  searchQuery,
  onSearchChange,
  chains,
}: LendingFiltersProps) {
  const protocolOptions: Array<{ value: 'all' | 'aave' | 'morpho'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'aave', label: 'Aave' },
    { value: 'morpho', label: 'Morpho' },
  ];

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by asset name or symbol..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-11 bg-muted/30 border-border/50"
        />
      </div>

      {/* Filter row - scrollable on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Protocol filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mb-1">
            {protocolOptions.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={protocolFilter === option.value ? 'default' : 'outline'}
                onClick={() => onProtocolChange(option.value)}
                className={cn(
                  "h-8 px-3 text-xs whitespace-nowrap",
                  protocolFilter === option.value && "bg-primary text-primary-foreground"
                )}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Chain filter - horizontal scroll */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mb-1 sm:ml-auto">
          <Button
            size="sm"
            variant={chainFilter === 'all' ? 'default' : 'outline'}
            onClick={() => onChainChange('all')}
            className={cn(
              "h-8 px-3 text-xs whitespace-nowrap",
              chainFilter === 'all' && "bg-primary text-primary-foreground"
            )}
          >
            All Chains
          </Button>
          {chains.map((chain) => (
            <Button
              key={chain.id}
              size="sm"
              variant={chainFilter === chain.id ? 'default' : 'outline'}
              onClick={() => onChainChange(chain.id)}
              className={cn(
                "h-8 px-3 text-xs whitespace-nowrap gap-1.5",
                chainFilter === chain.id && "bg-primary text-primary-foreground"
              )}
            >
              <img
                src={chain.logo}
                alt={chain.name}
                className="w-4 h-4 rounded-full"
              />
              {chain.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
