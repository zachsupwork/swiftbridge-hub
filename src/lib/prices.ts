/**
 * Token Price Service
 * 
 * Fetches USD prices from DefiLlama (primary) with LI.FI fallback.
 * In-memory cache with configurable TTL to avoid rate limits.
 */

const DEFILLAMA_BASE = 'https://coins.llama.fi';
const LIFI_BASE = 'https://li.quest';

// Native token "address" conventions
const NATIVE_ZERO = '0x0000000000000000000000000000000000000000';
const NATIVE_EEE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

// Chain name mapping for DefiLlama coin IDs
const CHAIN_SLUG: Record<number, string> = {
  1: 'ethereum',
  10: 'optimism',
  137: 'polygon',
  42161: 'arbitrum',
  8453: 'base',
  56: 'bsc',
  43114: 'avax',
  250: 'fantom',
  100: 'gnosis',
  42220: 'celo',
  1284: 'moonbeam',
  324: 'era',
  59144: 'linea',
  534352: 'scroll',
  5000: 'mantle',
};

// Native token CoinGecko IDs for DefiLlama
const NATIVE_COINGECKO_ID: Record<number, string> = {
  1: 'coingecko:ethereum',
  10: 'coingecko:ethereum',
  137: 'coingecko:matic-network',
  42161: 'coingecko:ethereum',
  8453: 'coingecko:ethereum',
  56: 'coingecko:binancecoin',
  43114: 'coingecko:avalanche-2',
  250: 'coingecko:fantom',
  100: 'coingecko:xdai',
  42220: 'coingecko:celo',
  1284: 'coingecko:moonbeam',
  324: 'coingecko:ethereum',
  59144: 'coingecko:ethereum',
  534352: 'coingecko:ethereum',
  5000: 'coingecko:mantle',
};

export interface TokenPrice {
  usdPrice: number;
  timestamp: number;
  confidence?: 'high' | 'medium' | 'low';
}

interface CacheEntry {
  price: TokenPrice;
  fetchedAt: number;
}

// In-memory cache: key = `${chainId}:${address.toLowerCase()}`
const priceCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 90_000; // 90 seconds

function cacheKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

function isNativeAddress(address: string): boolean {
  const lower = address.toLowerCase();
  return lower === NATIVE_ZERO || lower === NATIVE_EEE;
}

/**
 * Get cached price if still fresh
 */
function getCached(chainId: number, address: string): TokenPrice | null {
  const key = cacheKey(chainId, address);
  const entry = priceCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    priceCache.delete(key);
    return null;
  }
  return entry.price;
}

function setCache(chainId: number, address: string, price: TokenPrice): void {
  const key = cacheKey(chainId, address);
  priceCache.set(key, { price, fetchedAt: Date.now() });
  // Also cache under alternate native address
  if (isNativeAddress(address)) {
    const altKey1 = cacheKey(chainId, NATIVE_ZERO);
    const altKey2 = cacheKey(chainId, NATIVE_EEE);
    const entry = { price, fetchedAt: Date.now() };
    priceCache.set(altKey1, entry);
    priceCache.set(altKey2, entry);
  }
}

/**
 * Batch-fetch prices from DefiLlama for multiple tokens across chains.
 * Returns a map of `chainId:address` -> TokenPrice
 */
export async function fetchPrices(
  tokens: Array<{ chainId: number; address: string }>
): Promise<Map<string, TokenPrice>> {
  const result = new Map<string, TokenPrice>();
  const toFetch: Array<{ chainId: number; address: string; defillamaId: string }> = [];

  // Check cache first
  for (const { chainId, address } of tokens) {
    const cached = getCached(chainId, address);
    if (cached) {
      result.set(cacheKey(chainId, address), cached);
    } else {
      const slug = CHAIN_SLUG[chainId];
      if (isNativeAddress(address)) {
        const cgId = NATIVE_COINGECKO_ID[chainId];
        if (cgId) {
          toFetch.push({ chainId, address, defillamaId: cgId });
        }
      } else if (slug) {
        toFetch.push({ chainId, address, defillamaId: `${slug}:${address}` });
      }
    }
  }

  if (toFetch.length === 0) return result;

  // DefiLlama batch endpoint: /prices/current/{coins}
  // Max ~100 coins per request
  const BATCH_SIZE = 80;
  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE);
    const coinIds = batch.map((t) => t.defillamaId).join(',');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(`${DEFILLAMA_BASE}/prices/current/${coinIds}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeout);

      if (resp.ok) {
        const data = await resp.json();
        const coins = data?.coins || {};

        for (const item of batch) {
          const priceData = coins[item.defillamaId];
          if (priceData && typeof priceData.price === 'number') {
            const tp: TokenPrice = {
              usdPrice: priceData.price,
              timestamp: priceData.timestamp || Date.now() / 1000,
              confidence: priceData.confidence || 'high',
            };
            setCache(item.chainId, item.address, tp);
            result.set(cacheKey(item.chainId, item.address), tp);
          }
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[Prices] DefiLlama batch failed:', e);
    }
  }

  // Fallback: for tokens still missing, try LI.FI /v1/token
  const missing = toFetch.filter((t) => !result.has(cacheKey(t.chainId, t.address)));
  if (missing.length > 0 && missing.length <= 20) {
    await Promise.allSettled(
      missing.map(async (item) => {
        try {
          const addr = isNativeAddress(item.address) ? NATIVE_EEE : item.address;
          const resp = await fetch(
            `${LIFI_BASE}/v1/token?chain=${item.chainId}&token=${addr}`,
            { headers: { Accept: 'application/json' } }
          );
          if (resp.ok) {
            const data = await resp.json();
            const price = parseFloat(data?.priceUSD || '0');
            if (price > 0) {
              const tp: TokenPrice = { usdPrice: price, timestamp: Date.now() / 1000, confidence: 'medium' };
              setCache(item.chainId, item.address, tp);
              result.set(cacheKey(item.chainId, item.address), tp);
            }
          }
        } catch { /* skip */ }
      })
    );
  }

  return result;
}

/**
 * Get price for a single token (uses cache).
 */
export async function getTokenPrice(chainId: number, address: string): Promise<number | null> {
  const cached = getCached(chainId, address);
  if (cached) return cached.usdPrice;

  const prices = await fetchPrices([{ chainId, address }]);
  const key = cacheKey(chainId, address);
  return prices.get(key)?.usdPrice ?? null;
}

/**
 * Clear the entire price cache (useful for forced refresh).
 */
export function clearPriceCache(): void {
  priceCache.clear();
}

/**
 * Get the cache TTL in ms.
 */
export function getPriceCacheTTL(): number {
  return CACHE_TTL_MS;
}
