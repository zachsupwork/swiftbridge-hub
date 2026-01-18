import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Chain, getChains } from '@/lib/lifiClient';
import { cn } from '@/lib/utils';

interface ChainSelectorProps {
  selectedChainId: number;
  onSelect: (chain: Chain) => void;
  label: string;
  excludeChainId?: number;
}

export function ChainSelector({ selectedChainId, onSelect, label, excludeChainId }: ChainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [chains, setChains] = useState<Chain[]>([]);

  useEffect(() => {
    getChains().then(setChains);
  }, []);

  const selectedChain = chains.find(c => c.id === selectedChainId);
  const filteredChains = chains.filter(c => c.id !== excludeChainId);

  return (
    <div className="relative">
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-3 rounded-xl glass hover:bg-muted/30 transition-colors"
      >
        {selectedChain ? (
          <>
            <img
              src={selectedChain.logoURI}
              alt={selectedChain.name}
              className="w-6 h-6 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <span className="flex-1 text-left font-medium">{selectedChain.name}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Select chain</span>
        )}
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 z-50 glass rounded-xl border border-border shadow-xl overflow-hidden"
            >
              <div className="max-h-64 overflow-y-auto p-2">
                {filteredChains.map((chain) => (
                  <button
                    key={chain.id}
                    onClick={() => {
                      onSelect(chain);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors",
                      selectedChainId === chain.id && "bg-primary/10"
                    )}
                  >
                    <img
                      src={chain.logoURI}
                      alt={chain.name}
                      className="w-6 h-6 rounded-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span className="font-medium">{chain.name}</span>
                    {chain.id === 11155111 && (
                      <span className="ml-auto text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full">
                        Testnet
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
