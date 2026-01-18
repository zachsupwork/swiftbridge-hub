import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, ExternalLink, Clock } from 'lucide-react';
import { Route, getTransactionStatus, TransactionStatus } from '@/lib/lifiClient';
import { updateSwapStatus } from '@/lib/swapStorage';

interface TransactionTrackerProps {
  txHash: string;
  route: Route;
  swapId: string;
  onComplete?: () => void;
}

type TxStatus = 'pending' | 'sending' | 'bridging' | 'receiving' | 'completed' | 'failed';

export function TransactionTracker({ txHash, route, swapId, onComplete }: TransactionTrackerProps) {
  const [status, setStatus] = useState<TxStatus>('pending');
  const [statusData, setStatusData] = useState<TransactionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    const checkStatus = async () => {
      try {
        const data = await getTransactionStatus(txHash, route.fromChainId, route.toChainId);
        setStatusData(data);

        if (data.status === 'DONE') {
          setStatus('completed');
          updateSwapStatus(swapId, 'completed');
          clearInterval(interval);
          onComplete?.();
        } else if (data.status === 'FAILED') {
          setStatus('failed');
          updateSwapStatus(swapId, 'failed');
          clearInterval(interval);
        } else if (data.status === 'PENDING') {
          if (data.substatus === 'WAIT_SOURCE_CONFIRMATIONS') {
            setStatus('sending');
          } else if (data.substatus === 'WAIT_DESTINATION_TRANSACTION') {
            setStatus('bridging');
          } else {
            setStatus('receiving');
          }
        }

        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Failed to fetch status:', err);
      }
    };

    checkStatus();
    interval = setInterval(checkStatus, 5000);

    return () => clearInterval(interval);
  }, [txHash, route, swapId, onComplete]);

  const steps = [
    { key: 'sending', label: 'Sending', description: 'Transaction submitted' },
    { key: 'bridging', label: 'Bridging', description: route.fromChainId !== route.toChainId ? 'Cross-chain transfer' : 'Swapping' },
    { key: 'receiving', label: 'Receiving', description: 'Waiting for confirmation' },
    { key: 'completed', label: 'Completed', description: 'Transaction successful' },
  ];

  const getCurrentStep = () => {
    const stepOrder = ['pending', 'sending', 'bridging', 'receiving', 'completed'];
    return stepOrder.indexOf(status);
  };

  const getExplorerUrl = (chainId: number, hash: string) => {
    // Import from wagmiConfig for consistency
    const explorers: Record<number, string> = {
      1: 'https://etherscan.io/tx/',
      10: 'https://optimistic.etherscan.io/tx/',
      137: 'https://polygonscan.com/tx/',
      42161: 'https://arbiscan.io/tx/',
      8453: 'https://basescan.org/tx/',
      43114: 'https://snowtrace.io/tx/',
      56: 'https://bscscan.com/tx/',
      250: 'https://ftmscan.com/tx/',
      100: 'https://gnosisscan.io/tx/',
      42220: 'https://celoscan.io/tx/',
      1284: 'https://moonscan.io/tx/',
      324: 'https://era.zksync.network/tx/',
      59144: 'https://lineascan.build/tx/',
      534352: 'https://scrollscan.com/tx/',
      5000: 'https://explorer.mantle.xyz/tx/',
      11155111: 'https://sepolia.etherscan.io/tx/',
    };
    return `${explorers[chainId] || 'https://etherscan.io/tx/'}${hash}`;
  };

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl p-6 text-center"
      >
        <XCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h3 className="font-semibold mb-1">Transaction Failed</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-6"
    >
      <div className="text-center mb-6">
        {status === 'completed' ? (
          <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
        ) : status === 'failed' ? (
          <XCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        ) : (
          <Loader2 className="w-12 h-12 text-primary mx-auto mb-3 animate-spin" />
        )}
        <h3 className="font-semibold">
          {status === 'completed' ? 'Swap Complete!' : status === 'failed' ? 'Swap Failed' : 'Processing Swap...'}
        </h3>
      </div>

      {/* Progress steps */}
      <div className="relative mb-6">
        <div className="flex justify-between">
          {steps.map((step, idx) => {
            const currentStep = getCurrentStep();
            const isActive = currentStep >= idx + 1;
            const isCurrent = currentStep === idx + 1;
            
            return (
              <div key={step.key} className="flex flex-col items-center relative z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                      ? 'bg-primary/20 text-primary animate-pulse-glow'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isActive ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                </div>
                <span className="text-xs mt-2 text-center max-w-[80px]">{step.label}</span>
              </div>
            );
          })}
        </div>
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted -z-0">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(100, (getCurrentStep() / (steps.length)) * 100)}%` }}
          />
        </div>
      </div>

      {/* Transaction links */}
      <div className="flex flex-col gap-2">
        <a
          href={getExplorerUrl(route.fromChainId, txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          View on source chain explorer
          <ExternalLink className="w-3 h-3" />
        </a>
        {statusData?.receiving?.txHash && (
          <a
            href={getExplorerUrl(route.toChainId, statusData.receiving.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            View on destination chain explorer
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </motion.div>
  );
}
