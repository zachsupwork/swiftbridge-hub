import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, X, Loader2 } from 'lucide-react';
import { Token, getTokens } from '@/lib/lifiClient';
import { cn } from '@/lib/utils';

interface TokenSelectorProps {
  chainId: number;
  selectedToken: Token | null;
  onSelect: (token: Token) => void;
  label: string;
}

export function TokenSelector({ chainId, selectedToken, onSelect, label }: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && tokens.length === 0) {
      setLoading(true);
      getTokens(chainId)
        .then(setTokens)
        .finally(() => setLoading(false));
    }
  }, [isOpen, chainId, tokens.length]);

  useEffect(() => {
    setTokens([]);
  }, [chainId]);

  const filteredTokens = useMemo(() => {
    if (!search) return tokens.slice(0, 100);
    const searchLower = search.toLowerCase();
    return tokens
      .filter(t => 
        t.symbol.toLowerCase().includes(searchLower) ||
        t.name.toLowerCase().includes(searchLower) ||
        t.address.toLowerCase().includes(searchLower)
      )
      .slice(0, 100);
  }, [tokens, search]);

  return (
    <div className="relative">
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-3 p-3 rounded-xl glass hover:bg-muted/30 transition-colors"
      >
        {selectedToken ? (
          <>
            <img
              src={selectedToken.logoURI || `https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/${selectedToken.symbol.toLowerCase()}.svg`}
              alt={selectedToken.symbol}
              className="w-8 h-8 rounded-full bg-muted"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
              }}
            />
            <div className="flex-1 text-left">
              <div className="font-medium">{selectedToken.symbol}</div>
              <div className="text-xs text-muted-foreground truncate">{selectedToken.name}</div>
            </div>
          </>
        ) : (
          <span className="text-muted-foreground">Select token</span>
        )}
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:absolute md:inset-auto md:top-full md:left-0 md:right-0 md:translate-y-2 z-50 glass rounded-2xl border border-border shadow-2xl max-h-[70vh] md:max-h-96 overflow-hidden"
            >
              <div className="p-3 border-b border-border">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by name or paste address"
                    className="flex-1 bg-transparent text-sm focus:outline-none"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                  {search && (
                    <button onClick={() => setSearch('')}>
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-y-auto max-h-64 p-2">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : filteredTokens.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No tokens found
                  </div>
                ) : (
                  filteredTokens.map((token) => (
                    <button
                      key={token.address}
                      onClick={() => {
                        onSelect(token);
                        setIsOpen(false);
                        setSearch('');
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors",
                        selectedToken?.address === token.address && "bg-primary/10"
                      )}
                    >
                      <img
                        src={token.logoURI || `https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/${token.symbol.toLowerCase()}.svg`}
                        alt={token.symbol}
                        className="w-8 h-8 rounded-full bg-muted"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
                        }}
                      />
                      <div className="flex-1 text-left">
                        <div className="font-medium">{token.symbol}</div>
                        <div className="text-xs text-muted-foreground truncate">{token.name}</div>
                      </div>
                      {token.priceUSD && (
                        <div className="text-sm text-muted-foreground">
                          ${parseFloat(token.priceUSD).toFixed(2)}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
