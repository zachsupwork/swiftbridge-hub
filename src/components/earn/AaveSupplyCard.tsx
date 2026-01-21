/**
 * Aave Supply Card Component
 * 
 * A card-based UI for supplying assets to Aave V3 with optional platform fee.
 * Mobile-first design matching the swap card style.
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Wallet, 
  AlertTriangle, 
  ExternalLink, 
  ChevronDown, 
  Info, 
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { useAaveSupply } from '@/hooks/useAaveSupply';
import { getMarketsForChain, type AaveMarket } from '@/lib/aaveMarkets';
import { 
  isEarnChainSupported, 
  EARN_CHAIN_NAMES, 
  EARN_CHAIN_LOGOS,
  getAaveDeepLink,
  EARN_SUPPORTED_CHAINS,
} from '@/lib/aaveV3';
import { getFeePercentage, isPlatformFeeConfigured, FEE_BPS } from '@/lib/env';
import { logDeepLinkClick } from '@/lib/earnLogger';
import { CHAIN_EXPLORERS } from '@/lib/wagmiConfig';
import { cn } from '@/lib/utils';

export function AaveSupplyCard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [selectedChainId, setSelectedChainId] = useState<number>(1);
  const [selectedMarket, setSelectedMarket] = useState<AaveMarket | null>(null);
  const [amount, setAmount] = useState('');
  const [enableFee, setEnableFee] = useState(false);

  const {
    supplyState,
    balance,
    balanceFormatted,
    isLoading,
    supply,
    resetState,
    refetchBalance,
  } = useAaveSupply(selectedMarket);

  // Get markets for selected chain
  const chainMarkets = useMemo(() => {
    return getMarketsForChain(selectedChainId);
  }, [selectedChainId]);

  // Update selected market when chain changes
  useEffect(() => {
    if (chainMarkets.length > 0) {
      setSelectedMarket(chainMarkets[0]);
    } else {
      setSelectedMarket(null);
    }
    setAmount('');
    resetState();
  }, [selectedChainId, chainMarkets, resetState]);

  // Fetch balance when market or address changes
  useEffect(() => {
    if (selectedMarket && address) {
      refetchBalance();
    }
  }, [selectedMarket, address, refetchBalance]);

  // Calculate fee amount for display
  const feeAmount = useMemo(() => {
    if (!enableFee || !amount || !selectedMarket) return '0';
    try {
      const parsed = parseUnits(amount, selectedMarket.decimals);
      const fee = (parsed * BigInt(FEE_BPS)) / 10000n;
      return formatUnits(fee, selectedMarket.decimals);
    } catch {
      return '0';
    }
  }, [enableFee, amount, selectedMarket]);

  const supplyAmount = useMemo(() => {
    if (!amount || !selectedMarket) return '0';
    try {
      const parsed = parseUnits(amount, selectedMarket.decimals);
      if (enableFee) {
        const fee = (parsed * BigInt(FEE_BPS)) / 10000n;
        return formatUnits(parsed - fee, selectedMarket.decimals);
      }
      return amount;
    } catch {
      return '0';
    }
  }, [enableFee, amount, selectedMarket]);

  // Check if chain matches
  const isChainMatch = chainId === selectedChainId;
  const isChainSupported = isEarnChainSupported(selectedChainId);

  // Handle max button
  const handleMax = () => {
    if (balance !== null && selectedMarket) {
      setAmount(formatUnits(balance, selectedMarket.decimals));
    }
  };

  // Handle supply
  const handleSupply = async () => {
    if (!selectedMarket || !amount) return;
    await supply(amount, enableFee);
  };

  // Handle deep link
  const handleDeepLink = () => {
    if (!selectedMarket) return;
    
    logDeepLinkClick({
      chainId: selectedMarket.chainId,
      assetSymbol: selectedMarket.symbol,
      assetAddress: selectedMarket.address,
      walletAddress: address,
    });

    const url = getAaveDeepLink(selectedMarket.chainId, selectedMarket.address);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Get explorer URL for tx
  const getExplorerUrl = (txHash: string) => {
    const baseUrl = CHAIN_EXPLORERS[selectedChainId] || 'https://etherscan.io/tx/';
    return `${baseUrl}${txHash}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl overflow-hidden max-w-lg mx-auto"
    >
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-border">
        <h2 className="text-xl font-bold mb-1">Earn</h2>
        <p className="text-sm text-muted-foreground">Lending via Aave V3</p>
      </div>

      {/* Risk Disclosure */}
      <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            You are interacting with Aave V3 contracts. Rates and risks vary. This app does not custody funds.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 space-y-4">
        {/* Chain Selector */}
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Network</label>
          <Select 
            value={selectedChainId.toString()} 
            onValueChange={(v) => setSelectedChainId(Number(v))}
          >
            <SelectTrigger className="w-full h-12">
              <SelectValue>
                <div className="flex items-center gap-2">
                  <img 
                    src={EARN_CHAIN_LOGOS[selectedChainId]} 
                    alt="" 
                    className="w-5 h-5 rounded-full"
                  />
                  <span>{EARN_CHAIN_NAMES[selectedChainId]}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {EARN_SUPPORTED_CHAINS.map((cId) => (
                <SelectItem key={cId} value={cId.toString()}>
                  <div className="flex items-center gap-2">
                    <img 
                      src={EARN_CHAIN_LOGOS[cId]} 
                      alt="" 
                      className="w-5 h-5 rounded-full"
                    />
                    <span>{EARN_CHAIN_NAMES[cId]}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Chain not supported warning */}
        {!isChainSupported && (
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <p className="text-muted-foreground mb-3">
              Earn is not supported on this network yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Switch to Ethereum, Arbitrum, Optimism, Polygon, or Base.
            </p>
          </div>
        )}

        {isChainSupported && (
          <>
            {/* Asset Selector */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Asset</label>
              <Select 
                value={selectedMarket?.address || ''} 
                onValueChange={(addr) => {
                  const market = chainMarkets.find(m => m.address === addr);
                  setSelectedMarket(market || null);
                  setAmount('');
                  resetState();
                }}
              >
                <SelectTrigger className="w-full h-12">
                  <SelectValue placeholder="Select asset">
                    {selectedMarket && (
                      <div className="flex items-center gap-2">
                        <img 
                          src={selectedMarket.logo} 
                          alt={selectedMarket.symbol} 
                          className="w-5 h-5 rounded-full"
                        />
                        <span>{selectedMarket.symbol}</span>
                        <span className="text-muted-foreground text-xs">
                          {selectedMarket.name}
                        </span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {chainMarkets.map((market) => (
                    <SelectItem key={market.address} value={market.address}>
                      <div className="flex items-center gap-2">
                        <img 
                          src={market.logo} 
                          alt={market.symbol} 
                          className="w-5 h-5 rounded-full"
                        />
                        <span>{market.symbol}</span>
                        <span className="text-muted-foreground text-xs">
                          {market.name}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-muted-foreground">Amount</label>
                {isConnected && selectedMarket && (
                  <button
                    onClick={handleMax}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    Balance: {parseFloat(balanceFormatted).toFixed(4)} {selectedMarket.symbol}
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-14 text-lg pr-20"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {selectedMarket && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedMarket.symbol}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Platform Fee Toggle */}
            {isPlatformFeeConfigured() && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={enableFee} 
                    onCheckedChange={setEnableFee}
                    id="fee-toggle"
                  />
                  <label 
                    htmlFor="fee-toggle" 
                    className="text-sm cursor-pointer"
                  >
                    Platform Fee
                  </label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-[200px]">
                        Optional {getFeePercentage()}% platform fee to support development.
                        You can toggle this off to skip the fee.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                {enableFee && amount && (
                  <span className="text-xs text-muted-foreground">
                    Fee: {parseFloat(feeAmount).toFixed(6)} {selectedMarket?.symbol}
                  </span>
                )}
              </div>
            )}

            {/* Summary */}
            {amount && parseFloat(amount) > 0 && selectedMarket && (
              <div className="p-3 rounded-lg bg-muted/20 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">You supply</span>
                  <span>{parseFloat(supplyAmount).toFixed(6)} {selectedMarket.symbol}</span>
                </div>
                {enableFee && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Platform fee</span>
                    <span>{parseFloat(feeAmount).toFixed(6)} {selectedMarket.symbol}</span>
                  </div>
                )}
              </div>
            )}

            {/* Transaction Status */}
            {supplyState.step !== 'idle' && (
              <div className="p-4 rounded-lg bg-muted/30 space-y-3">
                <TransactionStep 
                  label="Approval" 
                  status={
                    supplyState.step === 'approving' ? 'pending' :
                    supplyState.approvalTxHash ? 'complete' : 'idle'
                  }
                  txHash={supplyState.approvalTxHash}
                  explorerUrl={supplyState.approvalTxHash ? getExplorerUrl(supplyState.approvalTxHash) : undefined}
                />
                {enableFee && (
                  <TransactionStep 
                    label="Fee Transfer" 
                    status={
                      supplyState.step === 'transferring_fee' ? 'pending' :
                      supplyState.feeTxHash ? 'complete' : 
                      supplyState.step === 'error' && !supplyState.supplyTxHash ? 'error' : 'idle'
                    }
                    txHash={supplyState.feeTxHash}
                    explorerUrl={supplyState.feeTxHash ? getExplorerUrl(supplyState.feeTxHash) : undefined}
                  />
                )}
                <TransactionStep 
                  label="Supply to Aave" 
                  status={
                    supplyState.step === 'supplying' ? 'pending' :
                    supplyState.step === 'complete' ? 'complete' :
                    supplyState.step === 'error' ? 'error' : 'idle'
                  }
                  txHash={supplyState.supplyTxHash}
                  explorerUrl={supplyState.supplyTxHash ? getExplorerUrl(supplyState.supplyTxHash) : undefined}
                />
                {supplyState.error && (
                  <p className="text-xs text-destructive">{supplyState.error}</p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {!isConnected ? (
                <Button className="w-full h-12" disabled>
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </Button>
              ) : !isChainMatch ? (
                <Button 
                  className="w-full h-12" 
                  onClick={() => switchChain?.({ chainId: selectedChainId })}
                >
                  Switch to {EARN_CHAIN_NAMES[selectedChainId]}
                </Button>
              ) : (
                <Button 
                  className="w-full h-12" 
                  onClick={handleSupply}
                  disabled={
                    isLoading || 
                    !amount || 
                    parseFloat(amount) <= 0 ||
                    supplyState.step === 'complete'
                  }
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {supplyState.step === 'approving' && 'Approving...'}
                      {supplyState.step === 'transferring_fee' && 'Transferring fee...'}
                      {supplyState.step === 'supplying' && 'Supplying...'}
                    </>
                  ) : supplyState.step === 'complete' ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Supply Complete
                    </>
                  ) : (
                    'Supply'
                  )}
                </Button>
              )}

              {/* Deep Link Fallback */}
              <Button 
                variant="outline" 
                className="w-full h-10 text-sm"
                onClick={handleDeepLink}
              >
                Supply on Aave
                <ExternalLink className="w-3.5 h-3.5 ml-2" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-6 pb-4 sm:pb-6">
        <p className="text-[10px] text-muted-foreground text-center">
          Powered by Aave V3 (external protocol). Platform fee (if enabled) is separate and disclosed.
        </p>
      </div>
    </motion.div>
  );
}

// Transaction step indicator component
function TransactionStep({ 
  label, 
  status, 
  txHash, 
  explorerUrl 
}: { 
  label: string; 
  status: 'idle' | 'pending' | 'complete' | 'error';
  txHash?: string;
  explorerUrl?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {status === 'pending' && (
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        )}
        {status === 'complete' && (
          <Check className="w-4 h-4 text-success" />
        )}
        {status === 'error' && (
          <X className="w-4 h-4 text-destructive" />
        )}
        {status === 'idle' && (
          <div className="w-4 h-4 rounded-full border border-muted-foreground/30" />
        )}
        <span className={cn(
          "text-sm",
          status === 'idle' && "text-muted-foreground"
        )}>
          {label}
        </span>
      </div>
      {txHash && explorerUrl && (
        <a 
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
        >
          View tx
        </a>
      )}
    </div>
  );
}
