export interface SwapRecord {
  id: string;
  timestamp: number;
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  fromAmountUSD: string;
  toAmountUSD: string;
  txHash: string;
  status: 'pending' | 'completed' | 'failed';
  integratorFee: string;
  integratorFeeUSD: string;
}

const STORAGE_KEY = 'swiftswap_history';

export function getSwapHistory(): SwapRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveSwap(swap: SwapRecord): void {
  const history = getSwapHistory();
  history.unshift(swap);
  // Keep last 100 swaps
  if (history.length > 100) {
    history.pop();
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function updateSwapStatus(id: string, status: SwapRecord['status']): void {
  const history = getSwapHistory();
  const swap = history.find(s => s.id === id);
  if (swap) {
    swap.status = status;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }
}

export function getAnalytics(days = 30): {
  totalSwaps: number;
  completedSwaps: number;
  totalVolumeUSD: number;
  earnedFeesUSD: number;
  dailyStats: { date: string; count: number; volume: number; fees: number }[];
} {
  const history = getSwapHistory();
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  
  const recentSwaps = history.filter(s => s.timestamp >= cutoff);
  const completedSwaps = recentSwaps.filter(s => s.status === 'completed');
  
  const dailyMap = new Map<string, { count: number; volume: number; fees: number }>();
  
  completedSwaps.forEach(swap => {
    const date = new Date(swap.timestamp).toISOString().split('T')[0];
    const existing = dailyMap.get(date) || { count: 0, volume: 0, fees: 0 };
    existing.count += 1;
    existing.volume += parseFloat(swap.fromAmountUSD) || 0;
    existing.fees += parseFloat(swap.integratorFeeUSD) || 0;
    dailyMap.set(date, existing);
  });
  
  const dailyStats = Array.from(dailyMap.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  return {
    totalSwaps: recentSwaps.length,
    completedSwaps: completedSwaps.length,
    totalVolumeUSD: completedSwaps.reduce((sum, s) => sum + (parseFloat(s.fromAmountUSD) || 0), 0),
    earnedFeesUSD: completedSwaps.reduce((sum, s) => sum + (parseFloat(s.integratorFeeUSD) || 0), 0),
    dailyStats,
  };
}

export function exportToCSV(): string {
  const history = getSwapHistory();
  const headers = ['Date', 'From Chain', 'To Chain', 'From Token', 'To Token', 'From Amount', 'To Amount', 'From USD', 'To USD', 'TX Hash', 'Status', 'Fee USD'];
  
  const rows = history.map(swap => [
    new Date(swap.timestamp).toISOString(),
    swap.fromChainId,
    swap.toChainId,
    swap.fromToken,
    swap.toToken,
    swap.fromAmount,
    swap.toAmount,
    swap.fromAmountUSD,
    swap.toAmountUSD,
    swap.txHash,
    swap.status,
    swap.integratorFeeUSD,
  ].join(','));
  
  return [headers.join(','), ...rows].join('\n');
}
