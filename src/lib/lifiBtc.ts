/**
 * LI.FI Bitcoin Route Client
 * Handles BTC → EVM routes via LI.FI REST API.
 * Bitcoin chain ID in LI.FI: 20000000000001
 * Bitcoin token address: "bitcoin"
 */

const LIFI_BASE_URL = import.meta.env.VITE_LIFI_BASE_URL || 'https://li.quest';
const INTEGRATOR = import.meta.env.VITE_LIFI_INTEGRATOR || 'Lovable';

export const BTC_CHAIN_ID = 20000000000001;
export const BTC_TOKEN_ADDRESS = 'bitcoin';
export const BTC_DECIMALS = 8;

export interface BtcDepositInstructions {
  /** Vault/deposit BTC address */
  depositAddress: string;
  /** Exact BTC amount in satoshis (string) */
  amountSats: string;
  /** Human-readable BTC amount */
  amountBtc: string;
  /** Memo to include in the BTC tx (OP_RETURN or output) */
  memo: string;
  /** Refund address if present */
  refundAddress?: string;
  /** Tool used (e.g. thorchain) */
  tool: string;
  /** Route ID for status tracking */
  routeId: string;
  /** Full route object */
  route: any;
  /** Expiry timestamp if available */
  expiresAt?: number;
}

export interface BtcRouteParams {
  /** BTC amount in satoshis as string */
  fromAmount: string;
  /** BTC sender address (or xpub) — can be empty for manual deposit */
  fromAddress?: string;
  /** Target EVM chain ID */
  toChainId: number;
  /** Target token address on EVM chain */
  toTokenAddress: string;
  /** EVM recipient address */
  toAddress: string;
  /** Slippage tolerance (0-1) */
  slippage?: number;
}

export interface BtcRouteStatus {
  status: 'NOT_FOUND' | 'PENDING' | 'DONE' | 'FAILED';
  substatus?: string;
  substatusMessage?: string;
  sending?: {
    txHash: string;
    txLink: string;
    amount: string;
    chainId: number;
  };
  receiving?: {
    txHash: string;
    txLink: string;
    amount: string;
    token: { symbol: string; decimals: number; address: string };
    chainId: number;
  };
}

/**
 * Request a BTC → EVM route from LI.FI
 */
export async function createBtcRoute(params: BtcRouteParams): Promise<BtcDepositInstructions> {
  const body: Record<string, any> = {
    fromChainId: BTC_CHAIN_ID,
    toChainId: params.toChainId,
    fromTokenAddress: BTC_TOKEN_ADDRESS,
    toTokenAddress: params.toTokenAddress,
    fromAmount: params.fromAmount,
    toAddress: params.toAddress,
    options: {
      slippage: params.slippage || 0.03,
      integrator: INTEGRATOR,
      order: 'RECOMMENDED',
    },
  };

  // Only include fromAddress for UTXO chains if it's a valid BTC address
  // Never send EVM addresses for Bitcoin routes
  if (params.fromAddress && /^(bc1|[13]|tb1)/.test(params.fromAddress)) {
    body.fromAddress = params.fromAddress;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${LIFI_BASE_URL}/v1/advanced/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`LI.FI BTC route error (${response.status}): ${errBody}`);
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error('No BTC route found. Try a different amount or destination token.');
    }

    const route = data.routes[0];
    return parseDepositInstructions(route);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('BTC route request timed out. Please try again.');
    }
    throw err;
  }
}

/**
 * Parse deposit instructions from a LI.FI BTC route response.
 * The transactionRequest contains the vault address (to), memo (data), and value.
 */
/**
 * Deep-scan any object for a string matching BTC address formats.
 * Returns the longest match found (most likely the real address).
 */
function findBtcAddressDeepScan(obj: unknown, path = ''): { address: string; path: string } | null {
  let best: { address: string; path: string } | null = null;
  const btcRegex = /(bc1[a-z0-9]{25,}|tb1[a-z0-9]{25,}|[13][a-km-zA-HJ-NP-Z1-9]{25,})/g;

  function scan(val: unknown, currentPath: string) {
    if (!val) return;
    if (typeof val === 'string') {
      const matches = val.match(btcRegex);
      if (matches) {
        for (const m of matches) {
          if (!best || m.length > best.address.length) {
            best = { address: m, path: currentPath };
          }
        }
      }
    } else if (Array.isArray(val)) {
      val.forEach((item, i) => scan(item, `${currentPath}[${i}]`));
    } else if (typeof val === 'object') {
      for (const key of Object.keys(val as Record<string, unknown>)) {
        scan((val as Record<string, unknown>)[key], `${currentPath}.${key}`);
      }
    }
  }

  scan(obj, path);
  return best;
}

export function parseDepositInstructions(route: any): BtcDepositInstructions {
  const step = route.steps?.[0];
  if (!step) throw new Error('Invalid route: no steps');

  const txReq = step.transactionRequest;
  const tool = step.tool || step.toolDetails?.name || 'unknown';

  // Debug: log full route so we can inspect address location
  console.log('[BTC Route] Full route structure:', JSON.stringify(route, null, 2));

  let memo = '';
  let amountSats = route.fromAmount || step.action?.fromAmount || '0';

  // Extract deposit address from known locations first
  let depositAddress =
    txReq?.to ||
    step.estimate?.toolData?.to ||
    step.toolDetails?.depositAddress ||
    step.estimate?.data?.depositAddress ||
    route.depositAddress ||
    '';
  let depositAddressSource = depositAddress ? 'known_path' : '';

  // Deep-scan fallback: search entire route object for BTC address patterns
  if (!depositAddress) {
    const deepResult = findBtcAddressDeepScan(route, 'route');
    if (deepResult) {
      depositAddress = deepResult.address;
      depositAddressSource = `deep_scan:${deepResult.path}`;
    }
  }

  if (txReq) {
    memo = txReq.data || '';
    if (txReq.value) {
      amountSats = txReq.value;
    }
  }

  if (!memo && step.estimate?.data?.memo) {
    memo = step.estimate.data.memo;
  }

  console.log('[BTC Route] depositAddress:', depositAddress, '| source:', depositAddressSource);
  console.log('[BTC Route] amountSats:', amountSats);

  const amountBtc = (parseInt(amountSats) / 1e8).toFixed(8);

  return {
    depositAddress,
    amountSats,
    amountBtc,
    memo,
    tool,
    routeId: route.id,
    route,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 min default expiry
  };
}

/**
 * Poll LI.FI status for a BTC route.
 * For BTC routes without a txHash yet, use the bridge/tool-specific approach.
 */
export async function getBtcRouteStatus(
  txHash: string,
  fromChainId: number,
  toChainId: number,
  tool?: string,
): Promise<BtcRouteStatus> {
  let url = `${LIFI_BASE_URL}/v1/status?txHash=${txHash}&fromChain=${fromChainId}&toChain=${toChainId}`;
  if (tool) url += `&bridge=${encodeURIComponent(tool)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Convert BTC amount string to satoshis string.
 */
export function btcToSats(btcAmount: string): string {
  const num = parseFloat(btcAmount);
  if (isNaN(num) || num <= 0) return '0';
  return Math.round(num * 1e8).toString();
}

/**
 * Convert satoshis to BTC display string.
 */
export function satsToBtc(sats: string): string {
  return (parseInt(sats) / 1e8).toFixed(8);
}

// Storage key for persisting active BTC swaps
const BTC_SWAP_STORAGE_KEY = 'cdb_active_btc_swaps';

export interface ActiveBtcSwap {
  id: string;
  depositInstructions: BtcDepositInstructions;
  toChainId: number;
  toTokenSymbol: string;
  toAddress: string;
  createdAt: number;
  btcTxHash?: string;
  status: 'waiting' | 'deposited' | 'confirming' | 'bridging' | 'completed' | 'failed' | 'expired';
  lastChecked?: number;
  receivingTxHash?: string;
  receivedAmount?: string;
}

export function saveActiveBtcSwap(swap: ActiveBtcSwap) {
  try {
    const existing = getActiveBtcSwaps();
    const updated = [swap, ...existing.filter(s => s.id !== swap.id)].slice(0, 10);
    localStorage.setItem(BTC_SWAP_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

export function getActiveBtcSwaps(): ActiveBtcSwap[] {
  try {
    const raw = localStorage.getItem(BTC_SWAP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function updateBtcSwapStatus(id: string, updates: Partial<ActiveBtcSwap>) {
  try {
    const swaps = getActiveBtcSwaps();
    const idx = swaps.findIndex(s => s.id === id);
    if (idx >= 0) {
      swaps[idx] = { ...swaps[idx], ...updates };
      localStorage.setItem(BTC_SWAP_STORAGE_KEY, JSON.stringify(swaps));
    }
  } catch {}
}
