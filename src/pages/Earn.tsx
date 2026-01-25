/**
 * Earn Page - Morpho Blue lending interface
 * 
 * Features:
 * - Morpho Blue markets via subgraph (no API key needed)
 * - Starting with Base chain (extensible to more)
 * - Search and filter
 * - Debug report for troubleshooting
 * - Mobile-first responsive design
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  Copy, 
  Check, 
  Rocket, 
  Bug,
  ExternalLink,
} from 'lucide-react';
import { useAccount, useChainId } from 'wagmi';

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MorphoMarketsTable } from '@/components/earn/MorphoMarketsTable';
import { useMorphoMarkets } from '@/hooks/useMorphoMarkets';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Earn() {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();

  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedDebug, setCopiedDebug] = useState(false);

  // Fetch Morpho markets
  const { 
    markets, 
    loading, 
    error, 
    refresh,
    lastFetched,
    selectedChainId,
    setSelectedChainId,
    availableChains,
    debugReport,
  } = useMorphoMarkets();

  // Format last fetched time
  const lastFetchedDisplay = lastFetched 
    ? (() => {
        const seconds = Math.floor((Date.now() - lastFetched) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ago`;
      })()
    : null;

  // Copy wallet address
  const handleCopyAddress = useCallback(() => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  }, [address]);

  // Copy debug report
  const handleCopyDebugReport = useCallback(() => {
    const report = JSON.stringify(debugReport, null, 2);
    navigator.clipboard.writeText(report);
    setCopiedDebug(true);
    toast({
      title: 'Debug Report Copied',
      description: 'Debug information has been copied to clipboard.',
    });
    setTimeout(() => setCopiedDebug(false), 2000);
  }, [debugReport]);

  // Check if RPC is configured
  const rpcWarning = !import.meta.env.VITE_RPC_BASE;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold">
                  <span className="text-gradient">Earn</span>
                </h1>
                <Badge variant="outline" className="text-xs px-2 h-5 border-primary/40 text-primary bg-primary/10">
                  <Rocket className="w-3 h-3 mr-1" />
                  Morpho Blue
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Lending markets powered by Morpho Blue protocol
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Connected wallet display */}
              {isConnected && address && (
                <button
                  onClick={handleCopyAddress}
                  className="hidden sm:flex items-center gap-2 px-3 h-10 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors text-sm"
                >
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
                  {copiedAddress ? (
                    <Check className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
              )}
              
              {/* Chain selector */}
              <Select
                value={selectedChainId?.toString() || 'all'}
                onValueChange={(val) => setSelectedChainId(val === 'all' ? undefined : parseInt(val))}
              >
                <SelectTrigger className="w-[140px] h-10">
                  <SelectValue placeholder="Select chain" />
                </SelectTrigger>
                <SelectContent>
                  {availableChains.map(chain => (
                    <SelectItem key={chain.chainId} value={chain.chainId.toString()}>
                      <div className="flex items-center gap-2">
                        <img src={chain.logo} alt={chain.label} className="w-4 h-4 rounded-full" />
                        {chain.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={refresh}
                disabled={loading}
                className="h-10 w-10"
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>

              {/* Debug report button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyDebugReport}
                className="h-10 gap-2 text-muted-foreground"
              >
                {copiedDebug ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Bug className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Copy Debug</span>
              </Button>
            </div>
          </div>

          {/* RPC Warning */}
          {rpcWarning && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-warning font-medium">
                  RPC not configured
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Set VITE_RPC_BASE environment variable for optimal performance.
                  Markets are fetched via subgraph and should still work.
                </p>
              </div>
            </div>
          )}

          {/* Disclaimer Banner */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <AlertTriangle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-foreground">
                Supply and borrow actions open Morpho's official app. Crypto DeFi Bridge does not custody funds.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Lending involves smart contract risk. APY is variable and not guaranteed.
              </p>
            </div>
            <a
              href="https://app.morpho.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Morpho App
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Markets:</span>
                <span className="font-medium">{markets.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {isConnected && (
                <span className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-success" />
                  Wallet connected
                </span>
              )}
              {lastFetchedDisplay && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Updated {lastFetchedDisplay}
                </span>
              )}
            </div>
          </div>

          {/* Markets Table */}
          <MorphoMarketsTable
            markets={markets}
            loading={loading}
            error={error}
            onRefresh={refresh}
          />

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border/30">
            <p>Powered by Morpho Blue (external protocol). Data via The Graph subgraph.</p>
            <p className="mt-1">
              <a 
                href="https://docs.morpho.org" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Learn more about Morpho →
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
