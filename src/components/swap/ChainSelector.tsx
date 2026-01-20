import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, AlertCircle, Wallet } from 'lucide-react';
import { Chain, getChains } from '@/lib/lifiClient';
import { useMultiWallet, getWalletTypeForChain, WalletType } from '@/lib/wallets';
import { cn } from '@/lib/utils';

interface ChainSelectorProps {
  selectedChainId: number;
  onSelect: (chain: Chain) => void;
  label: string;
  excludeChainId?: number;
}

// Extended chain type from LI.FI that may include chainType
interface ExtendedChain extends Chain {
  chainType?: string;
}

// Wallet type labels for UI
const WALLET_LABELS: Record<WalletType, string> = {
  evm: 'EVM wallet',
  solana: 'Solana wallet',
  bitcoin: 'Bitcoin wallet',
  sui: 'Sui wallet',
};

export function ChainSelector({ selectedChainId, onSelect, label, excludeChainId }: ChainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [chains, setChains] = useState<ExtendedChain[]>([]);
  const [showMoreChains, setShowMoreChains] = useState(false);
  const wallets = useMultiWallet();

  useEffect(() => {
    getChains().then(setChains);
  }, []);

  const selectedChain = chains.find(c => c.id === selectedChainId);
  const filteredChains = chains.filter(c => c.id !== excludeChainId);

  // Categorize chains by wallet type and availability
  const { availableChains, unavailableChains } = useMemo(() => {
    const available: ExtendedChain[] = [];
    const unavailable: { chain: ExtendedChain; walletType: WalletType }[] = [];

    for (const chain of filteredChains) {
      const walletType = getWalletTypeForChain(chain.id, chain.chainType);
      const isConnected = wallets.isWalletConnected(walletType);

      if (isConnected) {
        available.push(chain);
      } else {
        unavailable.push({ chain, walletType });
      }
    }

    return { availableChains: available, unavailableChains: unavailable };
  }, [filteredChains, wallets]);

  const handleChainSelect = (chain: ExtendedChain) => {
    const walletType = getWalletTypeForChain(chain.id, chain.chainType);
    const isConnected = wallets.isWalletConnected(walletType);

    if (!isConnected) {
      // Don't allow selection of chains without connected wallet
      return;
    }

    onSelect(chain);
    setIsOpen(false);
  };

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
              <div className="max-h-80 overflow-y-auto p-2">
                {/* Available chains (wallet connected) */}
                {availableChains.length > 0 ? (
                  availableChains.map((chain) => (
                    <button
                      key={chain.id}
                      onClick={() => handleChainSelect(chain)}
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
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    <Wallet className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Connect a wallet to see available chains</p>
                  </div>
                )}

                {/* Unavailable chains (need different wallet) */}
                {unavailableChains.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <button
                      onClick={() => setShowMoreChains(!showMoreChains)}
                      className="w-full flex items-center gap-2 p-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronRight className={cn("w-4 h-4 transition-transform", showMoreChains && "rotate-90")} />
                      <span>More chains (connect wallet)</span>
                      <span className="ml-auto bg-muted px-1.5 py-0.5 rounded text-[10px]">
                        {unavailableChains.length}
                      </span>
                    </button>

                    <AnimatePresence>
                      {showMoreChains && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          {unavailableChains.map(({ chain, walletType }) => (
                            <div
                              key={chain.id}
                              className="w-full flex items-center gap-3 p-3 rounded-lg opacity-50 cursor-not-allowed"
                            >
                              <img
                                src={chain.logoURI}
                                alt={chain.name}
                                className="w-6 h-6 rounded-full grayscale"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <div className="flex-1 text-left">
                                <span className="font-medium text-sm">{chain.name}</span>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Connect {WALLET_LABELS[walletType]}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
