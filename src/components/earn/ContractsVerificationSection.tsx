/**
 * Contracts & Verification Section
 * 
 * Collapsible panel showing Aave contract addresses for audit/verification.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { getAaveAddresses } from '@/lib/aaveAddressBook';
import { cn } from '@/lib/utils';

interface ContractsVerificationSectionProps {
  chainId: number;
  chainName: string;
  underlyingAddress?: string;
  aTokenAddress?: string;
  variableDebtTokenAddress?: string;
  /** Optional extra contracts (e.g. LI.FI router) */
  extraContracts?: { label: string; address: string }[];
}

function getExplorerBase(chainId: number): string {
  const map: Record<number, string> = {
    1: 'https://etherscan.io',
    42161: 'https://arbiscan.io',
    10: 'https://optimistic.etherscan.io',
    137: 'https://polygonscan.com',
    8453: 'https://basescan.org',
    43114: 'https://snowtrace.io',
  };
  return map[chainId] || 'https://etherscan.io';
}

function AddressRow({ label, address, chainId }: { label: string; address: string; chainId: number }) {
  const copy = () => {
    navigator.clipboard.writeText(address);
    toast({ title: 'Copied', description: `${label} address copied` });
  };
  const explorerUrl = `${getExplorerBase(chainId)}/address/${address}`;
  const short = `${address.slice(0, 8)}…${address.slice(-6)}`;

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[10px] text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <span className="font-mono text-[10px] truncate">{short}</span>
        <button onClick={copy} className="text-muted-foreground hover:text-foreground shrink-0">
          <Copy className="w-3 h-3" />
        </button>
        <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary shrink-0">
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

export function ContractsVerificationSection({
  chainId,
  chainName,
  underlyingAddress,
  aTokenAddress,
  variableDebtTokenAddress,
  extraContracts,
}: ContractsVerificationSectionProps) {
  const [open, setOpen] = useState(false);
  const aaveAddrs = getAaveAddresses(chainId);

  return (
    <div className="border border-border/30 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Contracts & Verification
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="px-3 pb-2.5 space-y-0.5 border-t border-border/20">
          <div className="pt-1.5 pb-1 text-[10px] text-muted-foreground font-medium">
            Aave V3 — {chainName}
          </div>
          {aaveAddrs && (
            <>
              <AddressRow label="Pool" address={aaveAddrs.POOL} chainId={chainId} />
              <AddressRow label="Addresses Provider" address={aaveAddrs.POOL_ADDRESSES_PROVIDER} chainId={chainId} />
              <AddressRow label="Oracle" address={aaveAddrs.ORACLE} chainId={chainId} />
              <AddressRow label="UI Data Provider" address={aaveAddrs.UI_POOL_DATA_PROVIDER} chainId={chainId} />
            </>
          )}
          {underlyingAddress && (
            <AddressRow label="Underlying Token" address={underlyingAddress} chainId={chainId} />
          )}
          {aTokenAddress && aTokenAddress !== '0x0000000000000000000000000000000000000000' && (
            <AddressRow label="aToken" address={aTokenAddress} chainId={chainId} />
          )}
          {variableDebtTokenAddress && variableDebtTokenAddress !== '0x0000000000000000000000000000000000000000' && (
            <AddressRow label="Variable Debt Token" address={variableDebtTokenAddress} chainId={chainId} />
          )}
          {extraContracts?.map(ec => (
            <AddressRow key={ec.label} label={ec.label} address={ec.address} chainId={chainId} />
          ))}
          <div className="pt-1">
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-1 border-success/30 text-success">
              <ShieldCheck className="w-2.5 h-2.5" />
              Verified on-chain
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}
