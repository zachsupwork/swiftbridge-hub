/**
 * Aave Supply Card Component
 * 
 * Supply assets to Aave V3 with MANDATORY platform fee.
 * Supports Ethereum Mainnet and Sepolia only.
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Wallet, 
  AlertTriangle, 
  ExternalLink, 
  Info, 
  Loader2,
  Check,
  Shield,
} from 'lucide-react';
import { useAccount, useChainId } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

import { useAaveSupply } from '@/hooks/useAaveSupply';
import { getMarketsForChain, type AaveMarket } from '@/lib/aaveMarkets';
import { 
  isEarnChainSupported, 
  EARN_CHAIN_NAMES, 
  EARN_CHAIN_LOGOS,
  EARN_SUPPORTED_CHAINS,
  EARN_CHAIN_EXPLORERS,
} from '@/lib/aaveV3';
import { getFeePercentage, FEE_BPS, isPlatformFeeConfigured } from '@/lib/env';
import { cn } from '@/lib/utils';

export function AaveSupplyCard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  

  const [selectedChainId, setSelectedChainId] = useState<number>(1);
  const [selectedMarket, setSelectedMarket] = useState<AaveMarket | null>(null);
  const [amount, setAmount] = useState('');

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

  // Calculate fee and supply amounts for display
  const { feeAmountDisplay, supplyAmountDisplay } = useMemo(() => {
    if (!amount || !selectedMarket) {
      return { feeAmountDisplay: '0', supplyAmountDisplay: '0' };
    }
    try {
      const parsed = parseUnits(amount, selectedMarket.decimals);
      const fee = (parsed * BigInt(FEE_BPS)) / 10000n;
      const supplyAmt = parsed - fee;
      return {
        feeAmountDisplay: formatUnits(fee, selectedMarket.decimals),
        supplyAmountDisplay: formatUnits(supplyAmt, selectedMarket.decimals),
      };
    } catch {
      return { feeAmountDisplay: '0', supplyAmountDisplay: '0' };
    }
  }, [amount, selectedMarket]);

  // Check if chain matches
  const isChainMatch = chainId === selectedChainId;
  const isChainSupported = isEarnChainSupported(selectedChainId);
  const isFeeConfigured = isPlatformFeeConfigured();

  // Handle max button
  const handleMax = () => {
    if (balance !== undefined && selectedMarket) {
      setAmount(formatUnits(balance, selectedMarket.decimals));
    }
  };

  // Handle supply
  const handleSupply = async () => {
    if (!selectedMarket || !amount) return;
    await supply(amount);
  };

  // Get explorer URL for tx
  const getExplorerUrl = (txHash: string) => {
    const baseUrl = EARN_CHAIN_EXPLORERS[selectedChainId] || 'https://etherscan.io/tx/';
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
        <h2 className="text-xl font-bold mb-1">Supply to Aave v3</h2>
        <p className="text-sm text-muted-foreground">Lending via Aave V3</p>
      </div>

      {/* Disclosures */}
      <div className="mx-4 sm:mx-6 mt-4 space-y-3">
        {/* Non-custody disclosure */}
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-foreground">
              Funds are supplied directly to Aave v3. Crypto DeFi Bridge does not custody funds.
            </p>
          </div>
        </div>

        {/* Risk disclosure */}
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Supplying assets involves smart contract risk. APY is variable and not guaranteed.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 space-y-4">
        {/* Network Selector */}
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
              Aave not supported on this network.
            </p>
            <p className="text-sm text-muted-foreground">
              Switch to Ethereum Mainnet or Sepolia Testnet.
            </p>
          </div>
        )}

        {/* Fee not configured warning */}
        {isChainSupported && !isFeeConfigured && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
            <p className="text-sm text-destructive">
              Platform fee configuration error. Please contact support.
            </p>
          </div>
        )}

        {isChainSupported && isFeeConfigured && (
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

            {/* Fee Breakdown (Mandatory) */}
            {amount && parseFloat(amount) > 0 && selectedMarket && (
              <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" />
                    Platform Fee ({getFeePercentage()}%)
                  </span>
                  <span>{parseFloat(feeAmountDisplay).toFixed(6)} {selectedMarket.symbol}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">You will supply</span>
                  <span className="text-primary">{parseFloat(supplyAmountDisplay).toFixed(6)} {selectedMarket.symbol}</span>
                </div>
                <div className="flex justify-between text-sm pt-1 border-t border-border/30">
                  <span className="text-muted-foreground">Destination</span>
                  <span>Aave v3</span>
                </div>
              </div>
            )}

            {/* Transaction Status */}
            {supplyState.step !== 'idle' && (
              <div className="p-4 rounded-lg bg-muted/30 space-y-3">
                <TransactionStep 
                  label="Approving Aave Pool" 
                  status={
                    supplyState.step === 'approving' ? 'pending' :
                    supplyState.approvalTxHash ? 'complete' : 'idle'
                  }
                />
                <TransactionStep 
                  label="Supplying to Aave" 
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
                  disabled
                >
                  Switch to {EARN_CHAIN_NAMES[selectedChainId]} in your wallet
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
                      {supplyState.step === 'approving' && 'Approving Aave Pool...'}
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

              {supplyState.step === 'complete' && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setAmount('');
                    resetState();
                  }}
                >
                  Supply More
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-6 pb-4 sm:pb-6">
        <p className="text-[10px] text-muted-foreground text-center">
          Powered by Aave V3 (external protocol). Platform fee ({getFeePercentage()}%) is mandatory and disclosed.
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
          <Check className="w-4 h-4 text-green-500" />
        )}
        {status === 'error' && (
          <span className="w-4 h-4 rounded-full bg-destructive flex items-center justify-center text-destructive-foreground text-xs">!</span>
        )}
        {status === 'idle' && (
          <span className="w-4 h-4 rounded-full border border-muted-foreground/30" />
        )}
        <span className={cn(
          "text-sm",
          status === 'complete' && "text-green-500",
          status === 'error' && "text-destructive",
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
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          View <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}
