import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, ChevronDown, Check, Copy, AlertCircle, X } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useConnectWallet, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useBitcoinWallet, useMultiWallet, shortenAddress, WalletType } from '@/lib/wallets';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Wallet icons/colors
const WALLET_CONFIG: Record<WalletType, { label: string; color: string; bgColor: string }> = {
  evm: { label: 'EVM', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  solana: { label: 'Solana', color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
  bitcoin: { label: 'Bitcoin', color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  sui: { label: 'Sui', color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
};

function WalletStatusPill({ type, address, connected }: { type: WalletType; address: string | null; connected: boolean }) {
  const [copied, setCopied] = useState(false);
  const config = WALLET_CONFIG[type];

  if (!connected || !address) return null;

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success(`${config.label} address copied`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md border', config.bgColor, 'border-current/20')}>
      <span className={cn('text-[10px] font-medium', config.color)}>{config.label}</span>
      <span className="text-xs text-muted-foreground">{shortenAddress(address)}</span>
      <button onClick={copyAddress} className="p-0.5 hover:bg-muted/50 rounded">
        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
      </button>
    </div>
  );
}

export function MultiWalletButton() {
  const [isOpen, setIsOpen] = useState(false);
  const wallets = useMultiWallet();
  
  // Bitcoin wallet
  const { connect: connectBitcoin, disconnect: disconnectBitcoin, isAvailable: btcAvailable, providerName: btcProvider } = useBitcoinWallet();
  
  // Solana wallet
  const { disconnect: disconnectSolana } = useSolanaWallet();
  
  // Sui wallet
  const { mutate: connectSui } = useConnectWallet();
  const { mutate: disconnectSui } = useDisconnectWallet();

  const connectedCount = [wallets.evm.connected, wallets.solana.connected, wallets.bitcoin.connected, wallets.sui.connected].filter(Boolean).length;

  // Handle ESC key to close modal
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      setIsOpen(false);
    }
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  const handleBitcoinConnect = async () => {
    try {
      await connectBitcoin();
      toast.success('Bitcoin wallet connected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect Bitcoin wallet');
    }
  };

  const closeModal = () => setIsOpen(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
          wallets.anyWalletConnected ? 'glass' : 'gradient-primary text-primary-foreground'
        )}
      >
        <Wallet className="w-4 h-4" />
        <span className="text-sm font-medium">
          {connectedCount > 0 ? `${connectedCount} Wallet${connectedCount > 1 ? 's' : ''}` : 'Connect Wallets'}
        </span>
        <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={closeModal}
              aria-hidden="true"
            />
            
            {/* Modal container */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="wallet-modal-title"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-[420px] max-h-[80vh] overflow-y-auto rounded-2xl bg-background border border-border shadow-2xl"
            >
              <div className="p-4 sm:p-5">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
                  <h2 id="wallet-modal-title" className="text-lg font-semibold text-foreground">
                    Connect Wallets
                  </h2>
                  <button
                    onClick={closeModal}
                    className="flex items-center justify-center w-11 h-11 -mr-2 rounded-lg hover:bg-muted/50 transition-colors"
                    aria-label="Close modal"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>

                {/* Connected wallets summary */}
                {wallets.anyWalletConnected && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    <WalletStatusPill type="evm" address={wallets.evm.address} connected={wallets.evm.connected} />
                    <WalletStatusPill type="solana" address={wallets.solana.address} connected={wallets.solana.connected} />
                    <WalletStatusPill type="bitcoin" address={wallets.bitcoin.address} connected={wallets.bitcoin.connected} />
                    <WalletStatusPill type="sui" address={wallets.sui.address} connected={wallets.sui.connected} />
                  </div>
                )}

                {/* Wallet sections */}
                <div className="space-y-4">
                  {/* EVM Wallet (RainbowKit) */}
                  <WalletSection
                    title="EVM Chains"
                    titleColor={WALLET_CONFIG.evm.color}
                    connected={wallets.evm.connected}
                  >
                    <ConnectButton.Custom>
                      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                        const connected = mounted && account && chain;
                        return (
                          <div className="space-y-2">
                            {!connected ? (
                              <WalletConnectButton onClick={openConnectModal}>
                                Connect EVM Wallet
                              </WalletConnectButton>
                            ) : (
                              <div className="flex gap-2">
                                <WalletConnectButton onClick={openChainModal} variant="secondary" className="flex-1">
                                  {chain.name}
                                </WalletConnectButton>
                                <Button 
                                  onClick={openAccountModal} 
                                  variant="ghost" 
                                  className="h-12 px-4 text-sm"
                                >
                                  Disconnect
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      }}
                    </ConnectButton.Custom>
                  </WalletSection>

                  {/* Solana Wallet */}
                  <WalletSection
                    title="Solana"
                    titleColor={WALLET_CONFIG.solana.color}
                    connected={wallets.solana.connected}
                  >
                    <div className="wallet-button-wrapper">
                      <WalletMultiButton />
                    </div>
                  </WalletSection>

                  {/* Bitcoin Wallet */}
                  <WalletSection
                    title="Bitcoin"
                    titleColor={WALLET_CONFIG.bitcoin.color}
                    connected={wallets.bitcoin.connected}
                  >
                    {!btcAvailable ? (
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/50 text-sm text-muted-foreground">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span className="leading-relaxed">
                          Install UniSat, Xverse, or Leather wallet extension to use Bitcoin routes.
                        </span>
                      </div>
                    ) : wallets.bitcoin.connected ? (
                      <div className="flex gap-2">
                        <div className="flex-1 flex items-center px-4 h-12 rounded-xl bg-muted/50 text-sm font-medium truncate">
                          {btcProvider}: {wallets.bitcoin.shortAddress}
                        </div>
                        <Button 
                          onClick={disconnectBitcoin} 
                          variant="ghost" 
                          className="h-12 px-4 text-sm"
                        >
                          Disconnect
                        </Button>
                      </div>
                    ) : (
                      <WalletConnectButton onClick={handleBitcoinConnect}>
                        Connect {btcProvider || 'Bitcoin'} Wallet
                      </WalletConnectButton>
                    )}
                  </WalletSection>

                  {/* Sui Wallet */}
                  <WalletSection
                    title="Sui"
                    titleColor={WALLET_CONFIG.sui.color}
                    connected={wallets.sui.connected}
                  >
                    {wallets.sui.connected ? (
                      <div className="flex gap-2">
                        <div className="flex-1 flex items-center px-4 h-12 rounded-xl bg-muted/50 text-sm font-medium truncate">
                          {wallets.sui.shortAddress}
                        </div>
                        <Button 
                          onClick={() => disconnectSui()} 
                          variant="ghost" 
                          className="h-12 px-4 text-sm"
                        >
                          Disconnect
                        </Button>
                      </div>
                    ) : (
                      <WalletConnectButton onClick={() => connectSui({ wallet: null as any })}>
                        Connect Sui Wallet
                      </WalletConnectButton>
                    )}
                  </WalletSection>
                </div>

                {/* Footer helper text */}
                <p className="text-xs text-muted-foreground/60 text-center pt-4 mt-4 border-t border-border">
                  Connect wallets for the chains you want to use
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// Reusable section wrapper
function WalletSection({ 
  title, 
  titleColor, 
  connected, 
  children 
}: { 
  title: string; 
  titleColor: string; 
  connected: boolean; 
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={cn('text-sm font-semibold', titleColor)}>{title}</span>
        {connected && (
          <span className="text-xs text-green-500 font-medium">Connected</span>
        )}
      </div>
      {children}
    </div>
  );
}

// Consistent wallet connect button
function WalletConnectButton({ 
  children, 
  onClick, 
  variant = 'primary',
  className = ''
}: { 
  children: React.ReactNode; 
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full h-12 px-4 rounded-xl text-base font-medium transition-colors',
        'flex items-center justify-center',
        variant === 'primary' 
          ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
          : 'bg-muted/50 text-foreground hover:bg-muted',
        className
      )}
    >
      {children}
    </button>
  );
}
