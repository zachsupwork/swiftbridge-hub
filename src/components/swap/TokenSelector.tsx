import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, X, Loader2, Coins } from 'lucide-react';
import { Token, getTokens } from '@/lib/lifiClient';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface TokenSelectorProps {
  chainId: number;
  selectedToken: Token | null;
  onSelect: (token: Token) => void;
  label: string;
}

const POPULAR_SYMBOLS = ['ETH', 'WETH', 'USDC', 'USDT', 'DAI', 'WBTC', 'LINK'];
const BATCH_SIZE = 50;

export function TokenSelector({ chainId, selectedToken, onSelect, label }: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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
    setVisibleCount(BATCH_SIZE);
  }, [chainId]);

  useEffect(() => {
    if (isOpen) {
      setVisibleCount(BATCH_SIZE);
      setTimeout(() => searchRef.current?.focus(), 100);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const popularTokens = useMemo(() => {
    return tokens.filter(t => POPULAR_SYMBOLS.includes(t.symbol));
  }, [tokens]);

  const filteredTokens = useMemo(() => {
    if (!search) return tokens;
    const q = search.toLowerCase();
    return tokens.filter(t =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.address.toLowerCase().includes(q)
    );
  }, [tokens, search]);

  const visibleTokens = useMemo(() => {
    return filteredTokens.slice(0, visibleCount);
  }, [filteredTokens, visibleCount]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      setVisibleCount(prev => Math.min(prev + BATCH_SIZE, filteredTokens.length));
    }
  }, [filteredTokens.length]);

  return (
    <div className="relative">
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-2.5 p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-all group"
      >
        {selectedToken ? (
          <>
            <img
              src={selectedToken.logoURI || `https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/${selectedToken.symbol.toLowerCase()}.svg`}
              alt={selectedToken.symbol}
              className="w-7 h-7 rounded-full bg-muted ring-1 ring-border/30"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
              }}
            />
            <div className="flex-1 text-left min-w-0">
              <div className="font-semibold text-sm leading-tight">{selectedToken.symbol}</div>
              <div className="text-[11px] text-muted-foreground truncate">{selectedToken.name}</div>
            </div>
          </>
        ) : (
          <span className="text-muted-foreground text-sm">Select token</span>
        )}
        <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/70 backdrop-blur-md z-[60]"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed z-[70] inset-x-0 bottom-0 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:inset-auto sm:w-full sm:max-w-[420px] bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
              style={{ maxHeight: '85vh' }}
            >
              {/* Header */}
              <div className="flex-shrink-0 p-4 border-b border-border/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <Coins className="w-4 h-4 text-primary" />
                    Select Token
                  </h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Search */}
                <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 border border-border/30 rounded-xl focus-within:ring-2 focus-within:ring-primary/30 transition-all">
                  <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Search name, symbol, or paste address"
                    className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/60"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setVisibleCount(BATCH_SIZE);
                    }}
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="p-0.5 hover:bg-muted rounded">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Popular chips */}
                {!search && popularTokens.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {popularTokens.map(token => (
                      <button
                        key={token.address}
                        onClick={() => {
                          onSelect(token);
                          setIsOpen(false);
                        }}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all",
                          selectedToken?.address === token.address
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/50 bg-muted/30 hover:bg-muted/60 text-foreground"
                        )}
                      >
                        <img
                          src={token.logoURI || `https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/${token.symbol.toLowerCase()}.svg`}
                          alt={token.symbol}
                          className="w-4 h-4 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
                          }}
                        />
                        {token.symbol}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Token list */}
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="overflow-y-auto flex-1 py-1"
              >
                {loading ? (
                  <div className="space-y-1 p-2">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3.5 w-16" />
                          <Skeleton className="h-2.5 w-24" />
                        </div>
                        <Skeleton className="h-3.5 w-12" />
                      </div>
                    ))}
                  </div>
                ) : visibleTokens.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No tokens found</p>
                    <p className="text-xs mt-1">Try a different search term</p>
                  </div>
                ) : (
                  <div className="px-1">
                    {visibleTokens.map((token) => (
                      <button
                        key={token.address}
                        onClick={() => {
                          onSelect(token);
                          setIsOpen(false);
                          setSearch('');
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                          selectedToken?.address === token.address
                            ? "bg-primary/10 ring-1 ring-primary/20"
                            : "hover:bg-muted/40"
                        )}
                      >
                        <img
                          src={token.logoURI || `https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/${token.symbol.toLowerCase()}.svg`}
                          alt={token.symbol}
                          className="w-8 h-8 rounded-full bg-muted ring-1 ring-border/20"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
                          }}
                        />
                        <div className="flex-1 text-left min-w-0">
                          <div className="font-semibold text-sm">{token.symbol}</div>
                          <div className="text-xs text-muted-foreground truncate">{token.name}</div>
                        </div>
                        {token.priceUSD && (
                          <div className="text-xs text-muted-foreground font-medium">
                            ${parseFloat(token.priceUSD).toFixed(2)}
                          </div>
                        )}
                      </button>
                    ))}
                    {visibleCount < filteredTokens.length && (
                      <div className="py-3 text-center">
                        <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer count */}
              <div className="flex-shrink-0 px-4 py-2 border-t border-border/30 text-xs text-muted-foreground text-center">
                {filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''} available
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
