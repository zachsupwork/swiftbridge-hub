import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, ChevronDown, Check, Copy, AlertTriangle, X, Loader2, LogOut, Globe } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect } from 'wagmi';
import { useBitcoinWallet, useMultiWallet, shortenAddress, WalletType } from '@/lib/wallets';
import { isChainSupported, getChainName } from '@/lib/wagmiConfig';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const WALLET_CONFIG: Record<WalletType, { label: string; color: string; bgColor: string }> = {
  evm: { label: 'EVM', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  solana: { label: 'Solana', color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
  bitcoin: { label: 'Bitcoin', color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  sui: { label: 'Sui', color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
};

const CONNECTION_TIMEOUT_MS = 14000;

export function MultiWalletButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [connectingType, setConnectingType] = useState<WalletType | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wallets = useMultiWallet();

  const { address: evmAddr, chainId: currentChainId, isConnected: evmConnected } = useAccount();
  
  const { disconnect: disconnectEvm } = useDisconnect();
  const { connect: connectBitcoin, disconnect: disconnectBitcoin, isAvailable: btcAvailable, providerName: btcProvider } = useBitcoinWallet();

  const isUnsupportedNetwork = evmConnected && currentChainId && !isChainSupported(currentChainId);
  const connectedCount = [wallets.evm.connected, wallets.solana.connected, wallets.bitcoin.connected, wallets.sui.connected].filter(Boolean).length;

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  const handleSwitchNetwork = useCallback(() => {
    toast.info('Please switch networks using the chain selector or your wallet app.');
  }, []);

  const handleSwitchToChain = useCallback((_chainId: number) => {
    toast.info('Please switch networks using the chain selector or your wallet app.');
  }, []);

  useEffect(() => {
    if (connectingType === 'evm' && wallets.evm.connected) setConnectingType(null);
    if (connectingType === 'bitcoin' && wallets.bitcoin.connected) setConnectingType(null);
    if (connectingType === 'sui' && wallets.sui.connected) setConnectingType(null);
    if (connectingType === 'solana' && wallets.solana.connected) setConnectingType(null);
  }, [wallets.evm.connected, wallets.bitcoin.connected, wallets.sui.connected, wallets.solana.connected, connectingType]);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const startConnecting = useCallback((type: WalletType) => {
    setConnectingType(type);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setConnectingType(null);
      toast.error('Connection taking too long. Please try again.');
    }, CONNECTION_TIMEOUT_MS);
  }, []);

  const handleBitcoinConnect = useCallback(async () => {
    try {
      startConnecting('bitcoin');
      await connectBitcoin();
      toast.success('Bitcoin wallet connected');
    } catch (err) {
      if (import.meta.env.DEV) console.error('[Wallet] Bitcoin connect error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to connect Bitcoin wallet');
    } finally {
      setConnectingType(null);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [connectBitcoin, startConnecting]);

  const handleSuiConnect = useCallback(() => {
    toast.info('Sui wallet support is not available.');
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setConnectingType(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const copyAddress = useCallback(() => {
    if (evmAddr) {
      navigator.clipboard.writeText(evmAddr);
      toast.success('Address copied');
      setShowDropdown(false);
    }
  }, [evmAddr]);

  // Force-clear all wallet-related localStorage/sessionStorage keys
  const clearWalletStorage = useCallback(() => {
    const walletKeyPatterns = ['wagmi', 'rk-', 'rainbowkit', 'walletconnect', 'wc@2'];
    const clearFromStorage = (storage: Storage) => {
      const keysToRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && walletKeyPatterns.some(p => key.toLowerCase().includes(p))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => storage.removeItem(k));
    };
    try { clearFromStorage(localStorage); } catch {}
    try { clearFromStorage(sessionStorage); } catch {}
  }, []);

  const handleDisconnect = useCallback(() => {
    // 1. Call wagmi disconnect
    disconnectEvm();
    // 2. Clear cached wallet sessions
    clearWalletStorage();
    // 3. Close dropdown immediately
    setShowDropdown(false);
    // 4. Toast with hard-reset fallback
    toast.success('Wallet disconnected', {
      action: {
        label: 'Hard Reset',
        onClick: () => {
          clearWalletStorage();
          window.location.reload();
        },
      },
    });
    // 5. Defensive re-disconnect after 250ms if still connected
    setTimeout(() => {
      // This runs in next tick — if wagmi still reports connected, force again
      disconnectEvm();
      clearWalletStorage();
    }, 250);
  }, [disconnectEvm, clearWalletStorage]);

  const isConnecting = connectingType !== null;

  // If EVM is connected, show connected button with dropdown
  if (evmConnected && evmAddr) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl glass hover:bg-muted/40 transition-all"
        >
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
          <span className="text-sm font-medium hidden sm:inline font-mono">
            {shortenAddress(evmAddr)}
          </span>
          <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', showDropdown && 'rotate-180')} />
        </button>

        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card shadow-2xl z-[60] overflow-hidden"
            >
              <div className="p-3 border-b border-border/50">
                <div className="text-xs text-muted-foreground mb-1">Connected</div>
                <div className="text-sm font-mono font-medium truncate">{evmAddr}</div>
                {currentChainId && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {getChainName(currentChainId)}
                  </div>
                )}
              </div>
              <div className="p-1">
                <button
                  type="button"
                  onClick={copyAddress}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm hover:bg-muted/50 transition-colors"
                >
                  <Copy className="w-4 h-4 text-muted-foreground" />
                  Copy Address
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDropdown(false); setIsOpen(true); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm hover:bg-muted/50 transition-colors"
                >
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                  Multi-Wallet ({connectedCount}/4)
                </button>
                <ConnectButton.Custom>
                  {({ openChainModal, mounted }) => (
                    <button
                      type="button"
                      onClick={() => {
                        setShowDropdown(false);
                        if (mounted && openChainModal) {
                          openChainModal();
                        } else {
                          toast.info('Please switch networks in your wallet app.');
                        }
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm hover:bg-muted/50 transition-colors"
                    >
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      Switch Network
                    </button>
                  )}
                </ConnectButton.Custom>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Multi-wallet modal still available */}
        <WalletModal
          isOpen={isOpen}
          onClose={closeModal}
          wallets={wallets}
          connectingType={connectingType}
          isConnecting={isConnecting}
          connectedCount={connectedCount}
          isUnsupportedNetwork={!!isUnsupportedNetwork}
          onSwitchNetwork={handleSwitchNetwork}
          onStartConnecting={startConnecting}
          onBitcoinConnect={handleBitcoinConnect}
          onSuiConnect={handleSuiConnect}
          btcAvailable={btcAvailable}
          btcProvider={btcProvider}
          onDisconnectBitcoin={disconnectBitcoin}
          onDisconnectSolana={() => {}}
          onDisconnectSui={() => {}}
        />
      </div>
    );
  }

  // Not connected: show Connect Wallet button that opens RainbowKit
  return (
    <>
      <ConnectButton.Custom>
        {({ openConnectModal, mounted }) => (
          <button
            type="button"
            onClick={() => {
              if (mounted) openConnectModal();
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-all active:scale-[0.97] touch-manipulation"
          >
            <Wallet className="w-4 h-4" />
            <span>Connect Wallet</span>
          </button>
        )}
      </ConnectButton.Custom>

      <WalletModal
        isOpen={isOpen}
        onClose={closeModal}
        wallets={wallets}
        connectingType={connectingType}
        isConnecting={isConnecting}
        connectedCount={connectedCount}
        isUnsupportedNetwork={!!isUnsupportedNetwork}
        onSwitchNetwork={handleSwitchNetwork}
        onStartConnecting={startConnecting}
        onBitcoinConnect={handleBitcoinConnect}
        onSuiConnect={handleSuiConnect}
        btcAvailable={btcAvailable}
        btcProvider={btcProvider}
        onDisconnectBitcoin={disconnectBitcoin}
        onDisconnectSolana={() => {}}
        onDisconnectSui={() => {}}
      />
    </>
  );
}

// ─── Multi-wallet modal ──────────────────────────────────────────
interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ReturnType<typeof useMultiWallet>;
  connectingType: WalletType | null;
  isConnecting: boolean;
  connectedCount: number;
  isUnsupportedNetwork: boolean;
  onSwitchNetwork: () => void;
  onStartConnecting: (type: WalletType) => void;
  onBitcoinConnect: () => void;
  onSuiConnect: () => void;
  btcAvailable: boolean;
  btcProvider: string | null;
  onDisconnectBitcoin: () => void;
  onDisconnectSolana: () => void;
  onDisconnectSui: () => void;
}

function WalletModal({
  isOpen, onClose, wallets, connectingType, isConnecting, connectedCount,
  isUnsupportedNetwork, onSwitchNetwork, onStartConnecting,
  onBitcoinConnect, onSuiConnect, btcAvailable, btcProvider,
  onDisconnectBitcoin, onDisconnectSolana, onDisconnectSui,
}: WalletModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            style={{ touchAction: 'none' }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 z-[101] mx-auto w-[92vw] max-w-[460px] rounded-2xl border border-border bg-card shadow-2xl"
            style={{ top: '50%', transform: 'translateY(-50%)', maxHeight: 'min(85vh, 680px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/50">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Connect Wallets</h2>
                <span className="text-xs text-muted-foreground">Connected: {connectedCount}/4</span>
              </div>
              <button type="button" onClick={onClose} className="p-2 -mr-2 rounded-lg hover:bg-muted/50 transition-colors" aria-label="Close">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-4" style={{ maxHeight: 'calc(85vh - 80px)' }}>
              {/* EVM */}
              <WalletSection title="EVM Chains" titleColor={WALLET_CONFIG.evm.color} connected={wallets.evm.connected}>
                <ConnectButton.Custom>
                  {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                    const connected = mounted && account && chain;
                    return (
                      <div className="space-y-2">
                        {!connected ? (
                          <WalletConnectBtn
                            onClick={() => { onStartConnecting('evm'); openConnectModal(); }}
                            loading={connectingType === 'evm'}
                            disabled={isConnecting && connectingType !== 'evm'}
                          >
                            Connect EVM Wallet
                          </WalletConnectBtn>
                        ) : (
                          <div className="flex gap-2">
                            <WalletConnectBtn onClick={openChainModal} variant="secondary" className="flex-1">
                              {chain.name}
                            </WalletConnectBtn>
                            <button type="button" onClick={openAccountModal} className="h-12 px-4 text-sm rounded-xl hover:bg-muted/50 transition-colors text-muted-foreground">
                              Disconnect
                            </button>
                          </div>
                        )}
                        {connected && isUnsupportedNetwork && (
                          <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-sm">
                            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                            <span className="text-destructive flex-1">Unsupported network</span>
                            <button type="button" onClick={onSwitchNetwork} className="px-3 py-1 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90">
                              Switch to Ethereum
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  }}
                </ConnectButton.Custom>
              </WalletSection>

              {/* Solana - not available */}
              <WalletSection title="Solana" titleColor={WALLET_CONFIG.solana.color} connected={false}>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/30 text-sm text-muted-foreground">
                  <span className="leading-relaxed">Solana wallet support coming soon.</span>
                </div>
              </WalletSection>

              {/* Bitcoin */}
              <WalletSection title="Bitcoin" titleColor={WALLET_CONFIG.bitcoin.color} connected={wallets.bitcoin.connected}>
                {!btcAvailable ? (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/30 text-sm text-muted-foreground">
                    <span className="leading-relaxed">Install UniSat, Xverse, or Leather to use Bitcoin routes.</span>
                  </div>
                ) : wallets.bitcoin.connected ? (
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center px-4 h-12 rounded-xl bg-muted/30 text-sm font-medium font-mono truncate">
                      {btcProvider}: {wallets.bitcoin.shortAddress}
                    </div>
                    <button type="button" onClick={onDisconnectBitcoin} className="h-12 px-4 text-sm rounded-xl hover:bg-muted/50 text-muted-foreground">
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <WalletConnectBtn onClick={onBitcoinConnect} loading={connectingType === 'bitcoin'} disabled={isConnecting && connectingType !== 'bitcoin'}>
                    Connect {btcProvider || 'Bitcoin'} Wallet
                  </WalletConnectBtn>
                )}
              </WalletSection>

              {/* Sui */}
              <WalletSection title="Sui" titleColor={WALLET_CONFIG.sui.color} connected={wallets.sui.connected}>
                {wallets.sui.connected ? (
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center px-4 h-12 rounded-xl bg-muted/30 text-sm font-medium font-mono truncate">
                      {wallets.sui.shortAddress}
                    </div>
                    <button type="button" onClick={onDisconnectSui} className="h-12 px-4 text-sm rounded-xl hover:bg-muted/50 text-muted-foreground">
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <WalletConnectBtn onClick={onSuiConnect} loading={connectingType === 'sui'} disabled={isConnecting && connectingType !== 'sui'}>
                    Connect Sui Wallet
                  </WalletConnectBtn>
                )}
              </WalletSection>

              <p className="text-xs text-muted-foreground/60 text-center pt-2">
                Connect wallets for the chains you want to use
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function WalletSection({ title, titleColor, connected, children }: {
  title: string; titleColor: string; connected: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={cn('text-sm font-semibold', titleColor)}>{title}</span>
        {connected && (
          <span className="text-xs text-green-500 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Connected
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function WalletConnectBtn({ children, onClick, variant = 'primary', className = '', loading = false, disabled = false }: {
  children: React.ReactNode; onClick: () => void; variant?: 'primary' | 'secondary'; className?: string; loading?: boolean; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'w-full min-h-[48px] h-12 px-4 rounded-xl text-base font-medium transition-colors',
        'flex items-center justify-center gap-2',
        'active:scale-[0.98] touch-manipulation',
        disabled && 'opacity-40 cursor-not-allowed',
        variant === 'primary'
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'bg-muted/30 text-foreground hover:bg-muted/50',
        className
      )}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
