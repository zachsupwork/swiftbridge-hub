import { useState } from 'react';
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
  const { select: selectSolanaWallet, disconnect: disconnectSolana, wallets: solanaWallets, wallet: solanaWallet } = useSolanaWallet();
  
  // Sui wallet
  const { mutate: connectSui } = useConnectWallet();
  const { mutate: disconnectSui } = useDisconnectWallet();
  const suiAccount = useCurrentAccount();

  const connectedCount = [wallets.evm.connected, wallets.solana.connected, wallets.bitcoin.connected, wallets.sui.connected].filter(Boolean).length;

  const handleBitcoinConnect = async () => {
    try {
      await connectBitcoin();
      toast.success('Bitcoin wallet connected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect Bitcoin wallet');
    }
  };

  return (
    <div className="relative">
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 z-50 w-80 glass rounded-xl border border-border shadow-xl overflow-hidden"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Multi-Chain Wallets</h3>
                  <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-muted/50 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Connected wallets summary */}
                {wallets.anyWalletConnected && (
                  <div className="flex flex-wrap gap-1.5">
                    <WalletStatusPill type="evm" address={wallets.evm.address} connected={wallets.evm.connected} />
                    <WalletStatusPill type="solana" address={wallets.solana.address} connected={wallets.solana.connected} />
                    <WalletStatusPill type="bitcoin" address={wallets.bitcoin.address} connected={wallets.bitcoin.connected} />
                    <WalletStatusPill type="sui" address={wallets.sui.address} connected={wallets.sui.connected} />
                  </div>
                )}

                <div className="border-t border-border pt-3 space-y-2">
                  {/* EVM Wallet (RainbowKit) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={cn('text-sm font-medium', WALLET_CONFIG.evm.color)}>EVM Chains</span>
                      {wallets.evm.connected && (
                        <span className="text-[10px] text-green-500">Connected</span>
                      )}
                    </div>
                    <ConnectButton.Custom>
                      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                        const connected = mounted && account && chain;
                        return (
                          <div className="flex gap-2">
                            {!connected ? (
                              <Button onClick={openConnectModal} size="sm" variant="outline" className="flex-1">
                                Connect EVM Wallet
                              </Button>
                            ) : (
                              <>
                                <Button onClick={openChainModal} size="sm" variant="outline" className="flex-1">
                                  {chain.name}
                                </Button>
                                <Button onClick={openAccountModal} size="sm" variant="ghost">
                                  Disconnect
                                </Button>
                              </>
                            )}
                          </div>
                        );
                      }}
                    </ConnectButton.Custom>
                  </div>

                  {/* Solana Wallet */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={cn('text-sm font-medium', WALLET_CONFIG.solana.color)}>Solana</span>
                      {wallets.solana.connected && (
                        <span className="text-[10px] text-green-500">Connected</span>
                      )}
                    </div>
                    <div className="solana-wallet-button">
                      <WalletMultiButton />
                    </div>
                  </div>

                  {/* Bitcoin Wallet */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={cn('text-sm font-medium', WALLET_CONFIG.bitcoin.color)}>Bitcoin</span>
                      {wallets.bitcoin.connected && (
                        <span className="text-[10px] text-green-500">Connected</span>
                      )}
                    </div>
                    {!btcAvailable ? (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>Install UniSat, Xverse, or Leather wallet</span>
                      </div>
                    ) : wallets.bitcoin.connected ? (
                      <div className="flex gap-2">
                        <div className="flex-1 px-3 py-2 rounded-lg bg-muted/50 text-sm">
                          {btcProvider}: {wallets.bitcoin.shortAddress}
                        </div>
                        <Button onClick={disconnectBitcoin} size="sm" variant="ghost">
                          Disconnect
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={handleBitcoinConnect} size="sm" variant="outline" className="w-full">
                        Connect {btcProvider || 'Bitcoin'} Wallet
                      </Button>
                    )}
                  </div>

                  {/* Sui Wallet */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={cn('text-sm font-medium', WALLET_CONFIG.sui.color)}>Sui</span>
                      {wallets.sui.connected && (
                        <span className="text-[10px] text-green-500">Connected</span>
                      )}
                    </div>
                    {wallets.sui.connected ? (
                      <div className="flex gap-2">
                        <div className="flex-1 px-3 py-2 rounded-lg bg-muted/50 text-sm">
                          {wallets.sui.shortAddress}
                        </div>
                        <Button onClick={() => disconnectSui()} size="sm" variant="ghost">
                          Disconnect
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        onClick={() => connectSui({ wallet: null as any })} 
                        size="sm" 
                        variant="outline" 
                        className="w-full"
                      >
                        Connect Sui Wallet
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground/60 text-center pt-2 border-t border-border">
                  Connect wallets for the chains you want to use
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
