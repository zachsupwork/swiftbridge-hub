import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X, Search, AlertCircle, Wallet, Globe } from 'lucide-react';
import { Chain, getChains } from '@/lib/lifiClient';
import { useMultiWallet, getWalletTypeForChain, WalletType } from '@/lib/wallets';
import { SUPPORTED_CHAIN_IDS } from '@/lib/wagmiConfig';
import { cn } from '@/lib/utils';

const CHAIN_ICON_FALLBACKS: Record<number, string> = {
  1: '/icons/chains/ethereum.svg',
  10: '/icons/chains/optimism.svg',
  56: '/icons/chains/bnb.svg',
  100: '/icons/chains/gnosis.svg',
  137: '/icons/chains/polygon.svg',
  250: '/icons/chains/fantom.svg',
  324: '/icons/chains/zksync.svg',
  8453: '/icons/chains/base.svg',
  42161: '/icons/chains/arbitrum.svg',
  43114: '/icons/chains/avalanche.svg',
  59144: '/icons/chains/linea.svg',
  534352: '/icons/chains/scroll.svg',
  5000: '/icons/chains/mantle.svg',
};

const POPULAR_CHAIN_IDS = [1, 42161, 10, 137, 8453];

interface ChainSelectorProps {
  selectedChainId: number;
  onSelect: (chain: Chain) => void;
  label: string;
  excludeChainId?: number;
}

interface ExtendedChain extends Chain {
  chainType?: string;
}

const WALLET_LABELS: Record<WalletType, string> = {
  evm: 'EVM wallet',
  solana: 'Solana wallet',
  bitcoin: 'Bitcoin wallet',
  sui: 'Sui wallet',
};

export function ChainSelector({ selectedChainId, onSelect, label, excludeChainId }: ChainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [chains, setChains] = useState<ExtendedChain[]>([]);
  const [search, setSearch] = useState('');
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const wallets = useMultiWallet();

  useEffect(() => {
    getChains().then(setChains);
  }, []);

  const supportedChains = useMemo(() => {
    return chains.filter(c => SUPPORTED_CHAIN_IDS.has(c.id) && c.id !== excludeChainId);
  }, [chains, excludeChainId]);

  const selectedChain = chains.find(c => c.id === selectedChainId);

  const { popular, other, unavailable } = useMemo(() => {
    const pop: ExtendedChain[] = [];
    const oth: ExtendedChain[] = [];
    const unav: { chain: ExtendedChain; walletType: WalletType }[] = [];

    const q = search.toLowerCase();
    const filtered = search
      ? supportedChains.filter(c => c.name.toLowerCase().includes(q))
      : supportedChains;

    for (const chain of filtered) {
      const walletType = getWalletTypeForChain(chain.id, chain.chainType);
      const isConnected = wallets.isWalletConnected(walletType);

      if (!isConnected) {
        unav.push({ chain, walletType });
      } else if (POPULAR_CHAIN_IDS.includes(chain.id) && !search) {
        pop.push(chain);
      } else {
        oth.push(chain);
      }
    }

    return { popular: pop, other: oth, unavailable: unav };
  }, [supportedChains, wallets, search]);

  const getChainIcon = (chain: ExtendedChain) => {
    if (imageErrors.has(chain.id) && CHAIN_ICON_FALLBACKS[chain.id]) {
      return CHAIN_ICON_FALLBACKS[chain.id];
    }
    return chain.logoURI;
  };

  const handleSelect = (chain: ExtendedChain) => {
    onSelect(chain);
    setIsOpen(false);
    setSearch('');
  };

  const ChainRow = ({ chain, disabled, hint }: { chain: ExtendedChain; disabled?: boolean; hint?: string }) => (
    <button
      onClick={() => !disabled && handleSelect(chain)}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
        disabled
          ? "opacity-40 cursor-not-allowed"
          : selectedChainId === chain.id
            ? "bg-primary/10 ring-1 ring-primary/20"
            : "hover:bg-muted/40"
      )}
    >
      <img
        src={getChainIcon(chain)}
        alt={chain.name}
        className={cn("w-7 h-7 rounded-full bg-muted ring-1 ring-border/20", disabled && "grayscale")}
        onError={() => setImageErrors(prev => new Set(prev).add(chain.id))}
      />
      <div className="flex-1 text-left min-w-0">
        <span className="font-medium text-sm">{chain.name}</span>
        {hint && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <AlertCircle className="w-3 h-3" />
            <span>{hint}</span>
          </div>
        )}
      </div>
      {chain.id === 11155111 && (
        <span className="text-[10px] bg-warning/20 text-warning px-2 py-0.5 rounded-full font-medium">
          Testnet
        </span>
      )}
    </button>
  );

  return (
    <div className="relative">
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-2.5 p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-all group"
      >
        {selectedChain ? (
          <>
            <img
              src={getChainIcon(selectedChain as ExtendedChain)}
              alt={selectedChain.name}
              className="w-6 h-6 rounded-full bg-muted ring-1 ring-border/30"
              onError={() => setImageErrors(prev => new Set(prev).add(selectedChain.id))}
            />
            <span className="flex-1 text-left font-semibold text-sm">{selectedChain.name}</span>
          </>
        ) : (
          <span className="text-muted-foreground text-sm">Select chain</span>
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
              onClick={() => { setIsOpen(false); setSearch(''); }}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed z-[70] inset-x-0 bottom-0 sm:bottom-auto sm:inset-auto sm:absolute sm:left-0 sm:top-full sm:mt-2 sm:w-[420px] sm:max-w-[95vw] bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
              style={{ maxHeight: 'min(520px, 70vh)' }}
            >
              {/* Header */}
              <div className="flex-shrink-0 p-4 border-b border-border/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    Select Chain
                  </h3>
                  <button
                    onClick={() => { setIsOpen(false); setSearch(''); }}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 border border-border/30 rounded-xl focus-within:ring-2 focus-within:ring-primary/30 transition-all">
                  <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search networks..."
                    className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/60"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="p-0.5 hover:bg-muted rounded">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Popular chips */}
                {!search && popular.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {popular.map(chain => (
                      <button
                        key={chain.id}
                        onClick={() => handleSelect(chain)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all",
                          selectedChainId === chain.id
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/50 bg-muted/30 hover:bg-muted/60 text-foreground"
                        )}
                      >
                        <img
                          src={getChainIcon(chain)}
                          alt={chain.name}
                          className="w-4 h-4 rounded-full"
                          onError={() => setImageErrors(prev => new Set(prev).add(chain.id))}
                        />
                        {chain.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Chain list */}
              <div className="overflow-y-auto flex-1 py-1 px-1">
                {(popular.length === 0 && other.length === 0 && unavailable.length === 0) ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Wallet className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No chains found</p>
                  </div>
                ) : (
                  <>
                    {other.map(chain => (
                      <ChainRow key={chain.id} chain={chain} />
                    ))}

                    {unavailable.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/30">
                        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Requires wallet connection
                        </div>
                        {unavailable.map(({ chain, walletType }) => (
                          <ChainRow
                            key={chain.id}
                            chain={chain}
                            disabled
                            hint={`Connect ${WALLET_LABELS[walletType]}`}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex-shrink-0 px-4 py-2 border-t border-border/30 text-xs text-muted-foreground text-center">
                {popular.length + other.length} network{popular.length + other.length !== 1 ? 's' : ''} available
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
