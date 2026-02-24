import { useState, useCallback } from 'react';
import { Wallet, AlertTriangle, ExternalLink, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BtcDepositInstructions } from '@/lib/lifiBtc';

interface BtcWalletConnectProps {
  instructions: BtcDepositInstructions;
  onTxSent: (txHash: string) => void;
  onFallbackToManual: () => void;
}

type WalletProvider = 'unisat' | 'xverse' | null;

export function BtcWalletConnect({ instructions, onTxSent, onFallbackToManual }: BtcWalletConnectProps) {
  const [selectedProvider, setSelectedProvider] = useState<WalletProvider>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const win = window as any;
  const hasUniSat = !!win.unisat;
  const hasXverse = !!win.XverseProviders?.BitcoinProvider || !!win.BitcoinProvider;

  const connectUniSat = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const accounts = await win.unisat.requestAccounts();
      if (accounts && accounts.length > 0) {
        setConnectedAddress(accounts[0]);
        setSelectedProvider('unisat');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to connect UniSat');
    } finally {
      setConnecting(false);
    }
  }, []);

  const connectXverse = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      // Try Sats Connect or direct provider
      const provider = win.XverseProviders?.BitcoinProvider || win.BitcoinProvider;
      if (!provider) throw new Error('Xverse not found');
      const accounts = await provider.requestAccounts();
      if (accounts && accounts.length > 0) {
        setConnectedAddress(accounts[0]?.address || accounts[0]);
        setSelectedProvider('xverse');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to connect Xverse');
    } finally {
      setConnecting(false);
    }
  }, []);

  const sendBtc = useCallback(async () => {
    if (!connectedAddress || !selectedProvider) return;
    setSending(true);
    setError(null);

    try {
      if (selectedProvider === 'unisat') {
        // UniSat sendBitcoin API
        const txid = await win.unisat.sendBitcoin(
          instructions.depositAddress,
          parseInt(instructions.amountSats),
        );
        if (txid) {
          onTxSent(txid);
          return;
        }
        throw new Error('No transaction ID returned');
      }

      if (selectedProvider === 'xverse') {
        // For Xverse, try direct send if available
        const provider = win.XverseProviders?.BitcoinProvider || win.BitcoinProvider;
        if (provider.sendBitcoin) {
          const txid = await provider.sendBitcoin(
            instructions.depositAddress,
            parseInt(instructions.amountSats),
          );
          if (txid) {
            onTxSent(txid);
            return;
          }
        }
        // PSBT signing is complex — fall back to manual
        throw new Error('Direct send not supported by this wallet version. Please use manual deposit.');
      }
    } catch (err: any) {
      const msg = err?.message || 'Send failed';
      if (msg.includes('manual deposit') || msg.includes('not supported')) {
        setError(msg);
      } else if (err?.code === 4001 || msg.includes('rejected') || msg.includes('cancel')) {
        setError('Transaction rejected by user');
      } else {
        setError(msg);
      }
    } finally {
      setSending(false);
    }
  }, [connectedAddress, selectedProvider, instructions, onTxSent]);

  // If no wallets detected, show fallback message
  if (!hasUniSat && !hasXverse) {
    return (
      <div className="text-center py-6 space-y-3">
        <Wallet className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
        <p className="text-sm text-muted-foreground">No Bitcoin wallet extension detected.</p>
        <p className="text-xs text-muted-foreground">Install UniSat or Xverse, or use manual deposit below.</p>
        <Button onClick={onFallbackToManual} variant="outline" size="sm">
          Use Manual Deposit (QR)
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Wallet selection */}
      {!connectedAddress && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium mb-2">Select Bitcoin Wallet</p>

          {hasUniSat && (
            <Button
              onClick={connectUniSat}
              disabled={connecting}
              variant="outline"
              className="w-full justify-start gap-3 h-12"
            >
              <div className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 text-xs font-bold">U</div>
              <span className="flex-1 text-left">UniSat Wallet</span>
              {connecting && selectedProvider === 'unisat' && <Loader2 className="w-4 h-4 animate-spin" />}
            </Button>
          )}

          {hasXverse && (
            <Button
              onClick={connectXverse}
              disabled={connecting}
              variant="outline"
              className="w-full justify-start gap-3 h-12"
            >
              <div className="w-7 h-7 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 text-xs font-bold">X</div>
              <span className="flex-1 text-left">Xverse Wallet</span>
              {connecting && selectedProvider === 'xverse' && <Loader2 className="w-4 h-4 animate-spin" />}
            </Button>
          )}

          <button
            onClick={onFallbackToManual}
            className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors py-2"
          >
            Or use manual QR deposit →
          </button>
        </div>
      )}

      {/* Connected state — show send button */}
      {connectedAddress && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium capitalize">{selectedProvider}</span>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {connectedAddress.slice(0, 8)}…{connectedAddress.slice(-6)}
            </Badge>
          </div>

          <div className="bg-muted/20 rounded-lg p-3 space-y-2 text-sm border border-border/20">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Send</span>
              <span className="font-mono font-bold">{instructions.amountBtc} BTC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">To</span>
              <span className="font-mono text-xs">{instructions.depositAddress.slice(0, 12)}…{instructions.depositAddress.slice(-8)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Via</span>
              <span className="capitalize">{instructions.tool}</span>
            </div>
          </div>

          {instructions.memo && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>This route requires a memo. Wallet send may not include it — consider using manual deposit for safety.</span>
            </div>
          )}

          <Button
            onClick={sendBtc}
            disabled={sending}
            className="w-full gradient-primary text-primary-foreground"
          >
            {sending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending…</>
            ) : (
              `Send ${instructions.amountBtc} BTC`
            )}
          </Button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
