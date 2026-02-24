import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BtcDepositInstructions } from '@/lib/lifiBtc';

interface BtcManualDepositProps {
  instructions: BtcDepositInstructions;
  onConfirmSent: () => void;
  onRequote: () => void;
  expired: boolean;
}

export function BtcManualDeposit({ instructions, onConfirmSent, onRequote, expired }: BtcManualDepositProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyButton = ({ text, field, label }: { text: string; field: string; label: string }) => (
    <button
      onClick={() => copyToClipboard(text, field)}
      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
    >
      {copiedField === field ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copiedField === field ? 'Copied!' : label}
    </button>
  );

  // Build QR data: bitcoin:<address>?amount=<btc>
  const qrData = `bitcoin:${instructions.depositAddress}?amount=${instructions.amountBtc}`;

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">Send only BTC on the Bitcoin network</p>
          <p className="text-warning/80">This address is unique to this swap. Sending any other asset or on a different network will result in permanent loss.</p>
        </div>
      </div>

      {expired ? (
        <div className="text-center py-6 space-y-3">
          <p className="text-sm text-destructive font-medium">Quote expired</p>
          <Button onClick={onRequote} variant="outline" size="sm">Get New Quote</Button>
        </div>
      ) : (
        <>
          {/* QR Code */}
          <div className="flex justify-center py-4">
            <div className="p-4 bg-white rounded-xl shadow-sm">
              <QRCodeSVG value={qrData} size={180} level="M" />
            </div>
          </div>

          {/* Deposit address */}
          <div className="bg-muted/30 rounded-xl p-4 space-y-3 border border-border/30">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">Deposit Address</span>
                <CopyButton text={instructions.depositAddress} field="address" label="Copy" />
              </div>
              <p className="text-sm font-mono break-all bg-muted/40 rounded-lg p-2.5 border border-border/20">
                {instructions.depositAddress}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">Amount (BTC)</span>
                <CopyButton text={instructions.amountBtc} field="amount" label="Copy" />
              </div>
              <p className="text-lg font-bold font-mono">
                {instructions.amountBtc} <span className="text-sm text-muted-foreground font-normal">BTC</span>
              </p>
            </div>

            {instructions.memo && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground font-medium">Memo (required)</span>
                  <CopyButton text={instructions.memo} field="memo" label="Copy" />
                </div>
                <p className="text-xs font-mono break-all bg-muted/40 rounded-lg p-2.5 border border-border/20">
                  {instructions.memo}
                </p>
                <p className="text-[10px] text-destructive mt-1">⚠ You must include this memo or funds may be lost</p>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/20">
              <span>Route via <strong className="text-foreground">{instructions.tool}</strong></span>
              <a
                href={`https://mempool.space/address/${instructions.depositAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                View on Mempool <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Confirm sent */}
          <Button onClick={onConfirmSent} className="w-full gradient-primary text-primary-foreground">
            I've Sent the BTC
          </Button>
        </>
      )}
    </div>
  );
}
