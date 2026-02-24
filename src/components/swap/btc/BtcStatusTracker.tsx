import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, Clock, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getBtcRouteStatus,
  BTC_CHAIN_ID,
  updateBtcSwapStatus,
  type ActiveBtcSwap,
  type BtcRouteStatus,
} from '@/lib/lifiBtc';

interface BtcStatusTrackerProps {
  swap: ActiveBtcSwap;
  onComplete: () => void;
  onReset: () => void;
}

const STEPS = [
  { key: 'waiting', label: 'Waiting for BTC', desc: 'Send BTC to the deposit address' },
  { key: 'deposited', label: 'Deposit Detected', desc: 'BTC transaction found' },
  { key: 'confirming', label: 'Confirming', desc: 'Waiting for confirmations' },
  { key: 'bridging', label: 'Bridging / Swapping', desc: 'Cross-chain transfer in progress' },
  { key: 'completed', label: 'Completed', desc: 'Tokens received!' },
];

const statusToStepIndex: Record<string, number> = {
  waiting: 0,
  deposited: 1,
  confirming: 2,
  bridging: 3,
  completed: 4,
  failed: -1,
  expired: -1,
};

export function BtcStatusTracker({ swap, onComplete, onReset }: BtcStatusTrackerProps) {
  const [currentStatus, setCurrentStatus] = useState(swap.status);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [statusData, setStatusData] = useState<BtcRouteStatus | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const swapIdRef = useRef(swap.id);

  const currentStepIndex = statusToStepIndex[currentStatus] ?? 0;
  const isTerminal = currentStatus === 'completed' || currentStatus === 'failed' || currentStatus === 'expired';

  useEffect(() => {
    swapIdRef.current = swap.id;

    if (isTerminal || !swap.btcTxHash) return;

    let delay = 5000;
    let consecutiveErrors = 0;

    const poll = async () => {
      if (swapIdRef.current !== swap.id) return;

      try {
        const status = await getBtcRouteStatus(
          swap.btcTxHash!,
          BTC_CHAIN_ID,
          swap.toChainId,
          swap.depositInstructions.tool,
        );

        setStatusData(status);
        setLastChecked(Date.now());
        setPollError(null);
        consecutiveErrors = 0;
        delay = 5000;

        let newStatus: ActiveBtcSwap['status'] = currentStatus;

        if (status.status === 'DONE') {
          newStatus = 'completed';
          updateBtcSwapStatus(swap.id, {
            status: 'completed',
            receivingTxHash: status.receiving?.txHash,
            receivedAmount: status.receiving?.amount,
            lastChecked: Date.now(),
          });
          setCurrentStatus('completed');
          onComplete();
          return;
        }

        if (status.status === 'FAILED') {
          newStatus = 'failed';
          updateBtcSwapStatus(swap.id, { status: 'failed', lastChecked: Date.now() });
          setCurrentStatus('failed');
          return;
        }

        if (status.status === 'PENDING') {
          if (status.substatus === 'WAIT_SOURCE_CONFIRMATIONS') {
            newStatus = 'confirming';
          } else if (status.substatus === 'WAIT_DESTINATION_TRANSACTION') {
            newStatus = 'bridging';
          } else if (status.sending?.txHash) {
            newStatus = 'deposited';
          }

          if (newStatus !== currentStatus) {
            setCurrentStatus(newStatus);
            updateBtcSwapStatus(swap.id, { status: newStatus, lastChecked: Date.now() });
          }
        }
      } catch (err) {
        consecutiveErrors++;
        delay = Math.min(delay * 2, 20000);
        setPollError(`Retrying... (attempt ${consecutiveErrors})`);
      }
    };

    poll();
    pollingRef.current = setInterval(poll, delay);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [swap.id, swap.btcTxHash, swap.toChainId, isTerminal]);

  const getExplorerLink = (chainId: number, txHash: string) => {
    if (chainId === BTC_CHAIN_ID) return `https://mempool.space/tx/${txHash}`;
    const explorers: Record<number, string> = {
      1: 'https://etherscan.io/tx/',
      10: 'https://optimistic.etherscan.io/tx/',
      137: 'https://polygonscan.com/tx/',
      42161: 'https://arbiscan.io/tx/',
      8453: 'https://basescan.org/tx/',
      43114: 'https://snowtrace.io/tx/',
    };
    return `${explorers[chainId] || 'https://etherscan.io/tx/'}${txHash}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Status icon */}
      <div className="text-center">
        {currentStatus === 'completed' ? (
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
        ) : currentStatus === 'failed' ? (
          <XCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
        ) : (
          <Loader2 className="w-12 h-12 text-primary mx-auto mb-2 animate-spin" />
        )}
        <h3 className="font-semibold text-sm">
          {currentStatus === 'completed' ? 'Swap Complete!' :
           currentStatus === 'failed' ? 'Swap Failed' :
           currentStatus === 'waiting' ? 'Waiting for BTC deposit…' :
           'Processing BTC Swap…'}
        </h3>
      </div>

      {/* Step timeline */}
      <div className="relative px-2">
        {/* Progress bar */}
        <div className="absolute left-6 top-3 bottom-3 w-0.5 bg-border/40">
          <div
            className="w-full bg-primary transition-all duration-500"
            style={{ height: `${Math.min(100, (currentStepIndex / (STEPS.length - 1)) * 100)}%` }}
          />
        </div>

        <div className="space-y-4">
          {STEPS.map((step, idx) => {
            const isActive = idx <= currentStepIndex && currentStatus !== 'failed';
            const isCurrent = idx === currentStepIndex && !isTerminal;

            return (
              <div key={step.key} className="flex items-center gap-3 relative">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center z-10 flex-shrink-0 text-xs",
                    isActive ? "bg-primary text-primary-foreground" :
                    isCurrent ? "bg-primary/20 text-primary" :
                    "bg-muted text-muted-foreground"
                  )}
                >
                  {isActive && idx < currentStepIndex ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isCurrent ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                </div>
                <div>
                  <p className={cn("text-sm font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transaction links */}
      <div className="space-y-2">
        {swap.btcTxHash && (
          <a
            href={getExplorerLink(BTC_CHAIN_ID, swap.btcTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            View BTC transaction on Mempool <ExternalLink className="w-3 h-3" />
          </a>
        )}

        {statusData?.receiving?.txHash && (
          <a
            href={getExplorerLink(swap.toChainId, statusData.receiving.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            View on destination chain explorer <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Last checked */}
      {lastChecked && !isTerminal && (
        <p className="text-[10px] text-muted-foreground text-center">
          Last checked: {new Date(lastChecked).toLocaleTimeString()}
          {pollError && <span className="text-warning ml-2">{pollError}</span>}
        </p>
      )}

      {/* Completion / failure actions */}
      {isTerminal && (
        <Button onClick={onReset} variant="outline" className="w-full">
          New Swap
        </Button>
      )}
    </motion.div>
  );
}
