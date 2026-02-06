import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, ChevronDown, Check, Copy, AlertCircle, X, Loader2, AlertTriangle } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useConnectWallet, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useAccount, useSwitchChain } from 'wagmi';
import { useBitcoinWallet, useMultiWallet, shortenAddress, WalletType } from '@/lib/wallets';
import { isChainSupported, SUPPORTED_CHAINS } from '@/lib/wagmiConfig';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const WALLET_CONFIG: Record<WalletType, { label: string; color: string; bgColor: string }> = {
  evm: { label: 'EVM', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  solana: { label: 'Solana', color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
  bitcoin: { label: 'Bitcoin', color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  sui: { label: 'Sui', color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
};

const CONNECTION_TIMEOUT_MS = 14000;

function WalletStatusPill({ type, address, connected }: { type: WalletType; address: string | null; connected: boolean }) {
  const [copied, setCopied] = useState(false);
  const config = WALLET_CONFIG[type];

  if (!connected || !address) return null;

  const copyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success(`${config.label} address copied`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md border', config.bgColor, 'border-current/20')}>
      <span className={cn('text-[10px] font-medium', config.color)}>{config.label}</span>
      <span className="text-xs text-muted-foreground">{shortenAddress(address)}</span>
      <button type="button" onClick={copyAddress} className="p-0.5 hover:bg-muted/50 rounded">
        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
      </button>
    </div>
  );
}

export function MultiWalletButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [connectingType, setConnectingType] = useState<WalletType | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wallets = useMultiWallet();

  const { address: evmAddr, chainId: currentChainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { connect: connectBitcoin, disconnect: disconnectBitcoin, isAvailable: btcAvailable, providerName: btcProvider } = useBitcoinWallet();
  const { disconnect: disconnectSolana } = useSolanaWallet();
  const { mutate: connectSui } = useConnectWallet();
  const { mutate: disconnectSui } = useDisconnectWallet();

  const isUnsupportedNetwork = wallets.evm.connected && currentChainId && !isChainSupported(currentChainId);

  const handleSwitchNetwork = useCallback(() => {
    try {
      switchChain({ chainId: 1 }); // default to Ethereum mainnet
      toast.success('Switching to Ethereum Mainnet…');
    } catch (err) {
      if (import.meta.env.DEV) console.error('[Wallet] Network switch error:', err);
      toast.error('Failed to switch network. Please switch manually in your wallet.');
    }
  }, [switchChain]);

  const connectedCount = [wallets.evm.connected, wallets.solana.connected, wallets.bitcoin.connected, wallets.sui.connected].filter(Boolean).length;
  useEffect(() => {
    if (connectingType === 'evm' && wallets.evm.connected) setConnectingType(null);
    if (connectingType === 'bitcoin' && wallets.bitcoin.connected) setConnectingType(null);
    if (connectingType === 'sui' && wallets.sui.connected) setConnectingType(null);
    if (connectingType === 'solana' && wallets.solana.connected) setConnectingType(null);
  }, [wallets.evm.connected, wallets.bitcoin.connected, wallets.sui.connected, wallets.solana.connected, connectingType]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const startConnecting = useCallback((type: WalletType) => {
    setConnectingType(type);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setConnectingType(null);
      toast.error('Connection taking too long. Please try again.');
      if (import.meta.env.DEV) console.warn(`[Wallet] ${type} connection timed out after ${CONNECTION_TIMEOUT_MS}ms`);
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
    startConnecting('sui');
    try {
      connectSui({ wallet: null as any });
    } catch (err) {
      if (import.meta.env.DEV) console.error('[Wallet] Sui connect error:', err);
      toast.error('Failed to connect Sui wallet');
      setConnectingType(null);
    }
  }, [connectSui, startConnecting]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setConnectingType(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const isConnecting = connectingType !== null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
          wallets.anyWalletConnected ? 'glass' : 'gradient-primary text-primary-foreground'
        )}
      >
        <Wallet className="w-4 h-4" />
        <span className="text-sm font-medium hidden sm:inline">
          {connectedCount > 0 ? `${connectedCount} Wallet${connectedCount > 1 ? 's' : ''}` : 'Connect'}
        </span>
        <ChevronDown className={cn('w-4 h-4 transition-transform hidden sm:block', isOpen && 'rotate-180')} />
      </button>

      {/* Custom portal-based modal to avoid z-index / nested modal conflicts */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[100] bg-black/70"
              onClick={closeModal}
              style={{ touchAction: 'none' }}
            />

            {/* Modal content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 z-[101] mx-auto w-[92vw] max-w-[460px] rounded-2xl border border-border bg-background shadow-2xl"
              style={{
                top: '50%',
                transform: 'translateY(-50%)',
                maxHeight: 'min(85vh, 680px)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Connect Wallets</h2>
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-2 -mr-2 rounded-lg hover:bg-muted/50 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto p-5 space-y-4" style={{ maxHeight: 'calc(85vh - 80px)' }}>
                {/* Connected wallets summary */}
                {wallets.anyWalletConnected && (
                  <div className="flex flex-wrap gap-1.5">
                    <WalletStatusPill type="evm" address={wallets.evm.address} connected={wallets.evm.connected} />
                    <WalletStatusPill type="solana" address={wallets.solana.address} connected={wallets.solana.connected} />
                    <WalletStatusPill type="bitcoin" address={wallets.bitcoin.address} connected={wallets.bitcoin.connected} />
                    <WalletStatusPill type="sui" address={wallets.sui.address} connected={wallets.sui.connected} />
                  </div>
                )}

                {/* EVM Wallet (RainbowKit) */}
                <WalletSection title="EVM Chains" titleColor={WALLET_CONFIG.evm.color} connected={wallets.evm.connected}>
                  <ConnectButton.Custom>
                    {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                      const connected = mounted && account && chain;
                      return (
                        <div className="space-y-2">
                          {!connected ? (
                            <WalletConnectBtn
                              onClick={() => {
                                startConnecting('evm');
                                openConnectModal();
                              }}
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
                              <Button type="button" onClick={openAccountModal} variant="ghost" className="h-12 px-4 text-sm">
                                Disconnect
                              </Button>
                            </div>
                          )}
                          {/* Unsupported network warning */}
                          {connected && isUnsupportedNetwork && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-sm">
                              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                              <span className="text-destructive flex-1">Unsupported network detected</span>
                              <button
                                type="button"
                                onClick={handleSwitchNetwork}
                                className="px-3 py-1 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90"
                              >
                                Switch
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  </ConnectButton.Custom>
                </WalletSection>

                {/* Solana Wallet */}
                <WalletSection title="Solana" titleColor={WALLET_CONFIG.solana.color} connected={wallets.solana.connected}>
                  <div className="wallet-button-wrapper">
                    <WalletMultiButton />
                  </div>
                </WalletSection>

                {/* Bitcoin Wallet */}
                <WalletSection title="Bitcoin" titleColor={WALLET_CONFIG.bitcoin.color} connected={wallets.bitcoin.connected}>
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
                      <Button type="button" onClick={disconnectBitcoin} variant="ghost" className="h-12 px-4 text-sm">
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <WalletConnectBtn
                      onClick={handleBitcoinConnect}
                      loading={connectingType === 'bitcoin'}
                      disabled={isConnecting && connectingType !== 'bitcoin'}
                    >
                      Connect {btcProvider || 'Bitcoin'} Wallet
                    </WalletConnectBtn>
                  )}
                </WalletSection>

                {/* Sui Wallet */}
                <WalletSection title="Sui" titleColor={WALLET_CONFIG.sui.color} connected={wallets.sui.connected}>
                  {wallets.sui.connected ? (
                    <div className="flex gap-2">
                      <div className="flex-1 flex items-center px-4 h-12 rounded-xl bg-muted/50 text-sm font-medium truncate">
                        {wallets.sui.shortAddress}
                      </div>
                      <Button type="button" onClick={() => disconnectSui()} variant="ghost" className="h-12 px-4 text-sm">
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <WalletConnectBtn
                      onClick={handleSuiConnect}
                      loading={connectingType === 'sui'}
                      disabled={isConnecting && connectingType !== 'sui'}
                    >
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
    </>
  );
}

function WalletSection({ title, titleColor, connected, children }: {
  title: string; titleColor: string; connected: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={cn('text-sm font-semibold', titleColor)}>{title}</span>
        {connected && <span className="text-xs text-green-500 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Connected</span>}
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
          : 'bg-muted/50 text-foreground hover:bg-muted',
        className
      )}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
