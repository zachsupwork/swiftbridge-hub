/**
 * Aave V3 Positions Hook — v10 (Address Book balanceOf-first)
 *
 * ARCHITECTURE:
 *   PRIMARY PATH (reliable — uses static aToken/vToken addresses from @bgd-labs/aave-address-book):
 *   1. Get known assets list from address book (with aToken + vToken addresses)
 *   2. Batch balanceOf(user) on all aTokens + vTokens
 *   3. Any non-zero balance = position found
 *   4. Pool.getUserAccountData(user) in parallel → HF / collateral / debt totals
 *   5. Enrich with DeFiLlama market metadata
 *
 *   NO MORE fragile UiPoolDataProvider ABI struct decoding.
 *   NO MORE getReserveData ABI version issues.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAccount } from 'wagmi';
import { createPublicClient, http, fallback, formatUnits, getAddress, parseAbi, erc20Abi } from 'viem';
import { tryNormalizeAddress } from '@/lib/address';
import { mainnet, arbitrum, optimism, polygon, base, avalanche } from 'viem/chains';
import { SUPPORTED_CHAINS, getFallbackRpcs } from '@/lib/chainConfig';
import { getAaveAddresses, getAaveAssets, type AaveAssetInfo } from '@/lib/aaveAddressBook';
import type { LendingMarket } from '@/hooks/useLendingMarkets';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const DEBUG = true;

const STABLE_SYMBOLS = new Set([
  'USDC', 'USDT', 'DAI', 'FRAX', 'LUSD', 'TUSD', 'USDP', 'GHO',
  'USDC.E', 'USDCE', 'USDC_E', 'BUSD', 'GUSD', 'CUSD', 'SUSD',
  'MIM', 'EURS', 'JEUR', 'AGEUR', 'XSGD', 'CADC', 'CEUR',
]);

function isStable(symbol: string): boolean {
  return STABLE_SYMBOLS.has(symbol.toUpperCase().replace(/[^A-Z0-9]/g, ''));
}

// ──────────────────────────────────────────────
// Viem chains
// ──────────────────────────────────────────────

const VIEM_CHAINS: Record<number, any> = {
  1: mainnet, 42161: arbitrum, 10: optimism, 137: polygon, 8453: base, 43114: avalanche,
};

// ──────────────────────────────────────────────
// ABIs (minimal — only getUserAccountData needed)
// ──────────────────────────────────────────────

const POOL_ACCOUNT_ABI = parseAbi([
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
]);

// ──────────────────────────────────────────────
// Token logos
// ──────────────────────────────────────────────

const TOKEN_LOGOS: Record<string, string> = {
  ETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/eth.svg',
  WETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg',
  USDC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  USDT: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdt.svg',
  DAI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/dai.svg',
  WBTC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg',
  LINK: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/link.svg',
  AAVE: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/aave.svg',
  WSTETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wsteth.svg',
  CBETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/cbeth.svg',
  RETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/reth.svg',
};

function getTokenLogo(symbol: string): string {
  return (
    TOKEN_LOGOS[symbol.toUpperCase()] ||
    'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg'
  );
}

// ──────────────────────────────────────────────
// Exported Types
// ──────────────────────────────────────────────

export interface AavePosition {
  chainId: number;
  chainName: string;
  chainLogo: string;
  assetAddress: `0x${string}`;
  assetSymbol: string;
  assetName: string;
  assetLogo: string;
  decimals: number;
  supplyBalance: bigint;
  supplyBalanceFormatted: string;
  supplyBalanceUsd: number;
  supplyApy: number;
  isCollateralEnabled: boolean;
  variableDebt: bigint;
  variableDebtFormatted: string;
  variableDebtUsd: number;
  borrowApy: number;
  dataSource: 'rpc' | 'subgraph';
  market?: LendingMarket;
  aTokenAddress: `0x${string}` | null;
  variableDebtTokenAddress: `0x${string}` | null;
  stableDebtTokenAddress: `0x${string}` | null;
  reserveId: number;
  lastUpdateTimestamp: number;
  currentLiquidityRate: bigint;
  currentVariableBorrowRate: bigint;
  poolAddress: `0x${string}` | null;
  poolAddressesProvider: `0x${string}` | null;
  uiPoolDataProvider: `0x${string}` | null;
  oracleAddress: `0x${string}` | null;
}

export interface AaveChainAccountData {
  chainId: number;
  chainName: string;
  totalCollateralUsd: number;
  totalDebtUsd: number;
  availableBorrowsUsd: number;
  healthFactor: number;
  ltv: number;
  liquidationThreshold?: number;
  dataSource: 'rpc' | 'subgraph';
}

export interface ChainDebugInfo {
  chainId: number;
  chainName: string;
  dataSource: 'rpc' | 'subgraph' | 'failed';
  rpcUsed?: string;
  reservesListCount: number;
  reservesScannedCount: number;
  positionsFound: number;
  accountDataFetched: boolean;
  error?: string;
  failedStep?: string;
  startedAt?: number;
  discoveryMethod?: 'address-book-balanceOf' | 'fallback-scanning';
  addressBookAssetsCount?: number;
  balanceOfCallsOk?: number;
  balanceOfCallsFailed?: number;
  poolAddress?: string;
  accountCollateralBase?: string;
  accountDebtBase?: string;
  accountHF?: string;
  wrongMarketWarning?: string;
  firstError?: string;
  lastError?: string;
}

export interface UseAavePositionsResult {
  positions: AavePosition[];
  chainAccountData: AaveChainAccountData[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  totalSupplyUsd: number;
  totalBorrowUsd: number;
  totalCollateralUsd: number;
  totalAccountDebtUsd: number;
  totalAvailableBorrowsUsd: number;
  lowestHealthFactor: number | null;
  debugInfo: ChainDebugInfo[];
  lastFetchedAt: number | null;
}

// ──────────────────────────────────────────────
// Helper: Create viem client with fallback transport
// ──────────────────────────────────────────────

function createFallbackClient(
  chainId: number,
  primaryRpc: string | undefined,
): ReturnType<typeof createPublicClient> | null {
  const viemChain = VIEM_CHAINS[chainId];
  if (!viemChain) return null;

  const rpcs: string[] = [];
  if (primaryRpc) rpcs.push(primaryRpc);
  rpcs.push(...getFallbackRpcs(chainId));

  const unique = [...new Set(rpcs)];
  if (unique.length === 0) return null;

  const transports = unique.map(rpc =>
    http(rpc, { timeout: 20_000, retryCount: 1 })
  );

  return createPublicClient({
    chain: viemChain,
    transport: transports.length === 1
      ? transports[0]
      : fallback(transports, { rank: false }),
  }) as ReturnType<typeof createPublicClient>;
}

// ──────────────────────────────────────────────
// Main Hook
// ──────────────────────────────────────────────

export function useAavePositions(markets: LendingMarket[]): UseAavePositionsResult {
  const { address, isConnected } = useAccount();
  const [positions, setPositions] = useState<AavePosition[]>([]);
  const [chainAccountData, setChainAccountData] = useState<AaveChainAccountData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<ChainDebugInfo[]>([]);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

  const fetchIdRef = useRef(0);
  const marketsRef = useRef<LendingMarket[]>(markets);
  useEffect(() => { marketsRef.current = markets; }, [markets]);

  const fetchPositions = useCallback(async () => {
    if (!address || !isConnected) {
      setPositions([]);
      setChainAccountData([]);
      setDebugInfo([]);
      setLoading(false);
      return;
    }

    const myFetchId = ++fetchIdRef.current;
    const startedAt = Date.now();

    setLoading(true);
    setError(null);

    const allPositions: AavePosition[] = [];
    const allAccountData: AaveChainAccountData[] = [];
    const allDebugInfo: ChainDebugInfo[] = [];

    const currentMarkets = marketsRef.current;
    const marketLookup = new Map<string, LendingMarket>();
    for (const m of currentMarkets) {
      const key = `${m.chainId}-${m.assetAddress.toLowerCase()}`;
      marketLookup.set(key, m);
    }

    console.log(`[AavePositions] Starting fetch #${myFetchId} for ${address} across ${SUPPORTED_CHAINS.length} chains`);

    try {
      await Promise.allSettled(
        SUPPORTED_CHAINS.map(async (chainConfig) => {
          const { chainId, name, logo, rpcUrl } = chainConfig;

          const aaveAddresses = getAaveAddresses(chainId);
          if (!aaveAddresses) {
            console.warn(`[AavePositions] ${name}: No Aave addresses found — skipping`);
            return;
          }

          const assets = getAaveAssets(chainId);
          const debugEntry: ChainDebugInfo = {
            chainId,
            chainName: name,
            dataSource: 'failed',
            reservesListCount: 0,
            reservesScannedCount: 0,
            positionsFound: 0,
            accountDataFetched: false,
            startedAt,
            addressBookAssetsCount: assets.length,
            balanceOfCallsOk: 0,
            balanceOfCallsFailed: 0,
            poolAddress: aaveAddresses.POOL,
          };

          try {
            const checksummedPool = getAddress(aaveAddresses.POOL);
            const client = createFallbackClient(chainId, rpcUrl);
            if (!client) {
              debugEntry.error = 'No RPC client available';
              allDebugInfo.push(debugEntry);
              return;
            }

            debugEntry.rpcUsed = rpcUrl || 'public-fallback';

            // ── getUserAccountData in parallel ──
            const accountPromise = (client.readContract as any)({
              address: checksummedPool,
              abi: POOL_ACCOUNT_ABI,
              functionName: 'getUserAccountData',
              args: [address],
            }).catch((e: any) => {
              console.warn(`[AavePositions] ${name}: getUserAccountData failed:`, e?.message || e);
              debugEntry.failedStep = 'getUserAccountData';
              return null;
            });

            // ════════════════════════════════════════════════
            // PRIMARY: Address Book balanceOf discovery
            // ════════════════════════════════════════════════

            if (assets.length > 0) {
              console.log(`[AavePositions] ${name}: Scanning ${assets.length} assets via address book balanceOf...`);
              debugEntry.discoveryMethod = 'address-book-balanceOf';

              // Build batch of balanceOf calls: [aToken, vToken] for each asset
              const balanceCalls = assets.flatMap((asset) => [
                {
                  type: 'supply' as const,
                  asset,
                  promise: (client.readContract as any)({
                    address: asset.aToken,
                    abi: erc20Abi,
                    functionName: 'balanceOf',
                    args: [address],
                  }).catch(() => 0n) as Promise<bigint>,
                },
                {
                  type: 'borrow' as const,
                  asset,
                  promise: (client.readContract as any)({
                    address: asset.vToken,
                    abi: erc20Abi,
                    functionName: 'balanceOf',
                    args: [address],
                  }).catch(() => 0n) as Promise<bigint>,
                },
              ]);

              // Execute all balanceOf calls
              const balanceResults = await Promise.allSettled(
                balanceCalls.map(async (call) => ({
                  type: call.type,
                  asset: call.asset,
                  balance: await call.promise,
                }))
              );

              // Group by asset
              const assetBalances = new Map<string, { supply: bigint; borrow: bigint; asset: AaveAssetInfo }>();

              for (const result of balanceResults) {
                if (result.status === 'fulfilled') {
                  debugEntry.balanceOfCallsOk = (debugEntry.balanceOfCallsOk || 0) + 1;
                  const { type, asset, balance } = result.value;
                  const key = asset.underlying.toLowerCase();
                  const existing = assetBalances.get(key) || { supply: 0n, borrow: 0n, asset };
                  if (type === 'supply') existing.supply = BigInt(balance ?? 0n);
                  else existing.borrow = BigInt(balance ?? 0n);
                  assetBalances.set(key, existing);
                } else {
                  debugEntry.balanceOfCallsFailed = (debugEntry.balanceOfCallsFailed || 0) + 1;
                  debugEntry.lastError = result.reason?.message?.slice(0, 200);
                }
              }

              debugEntry.reservesScannedCount = assets.length;

              // Build positions from non-zero balances
              for (const [, { supply, borrow, asset }] of assetBalances) {
                if (supply === 0n && borrow === 0n) continue;

                const lookupKey = `${chainId}-${asset.underlying.toLowerCase()}`;
                const matchedMarket = marketLookup.get(lookupKey);

                let symbol = asset.symbol;
                let assetName = asset.symbol;
                let decimals = asset.decimals;
                let priceUsd = 0;
                let supplyApy = 0;
                let borrowApy = 0;
                let assetLogo = getTokenLogo(asset.symbol);
                let isCollateralEnabled = true;

                if (matchedMarket) {
                  symbol = matchedMarket.assetSymbol;
                  assetName = matchedMarket.assetName;
                  decimals = matchedMarket.decimals || asset.decimals;
                  priceUsd = matchedMarket.priceUsd || 0;
                  supplyApy = matchedMarket.supplyAPY;
                  borrowApy = matchedMarket.borrowAPY;
                  assetLogo = matchedMarket.assetLogo || getTokenLogo(symbol);
                  isCollateralEnabled = matchedMarket.collateralEnabled;
                }

                if (!priceUsd && isStable(symbol)) priceUsd = 1;

                const supplyFormatted = formatUnits(supply, decimals);
                const debtFormatted = formatUnits(borrow, decimals);
                const supplyBalanceUsd = parseFloat(supplyFormatted) * priceUsd;
                const variableDebtUsd = parseFloat(debtFormatted) * priceUsd;

                console.log(
                  `[AavePositions] ${name} ${symbol}: supply=${supplyFormatted} ($${supplyBalanceUsd.toFixed(2)}) debt=${debtFormatted} ($${variableDebtUsd.toFixed(2)}) collateral=${isCollateralEnabled}`,
                );

                allPositions.push({
                  chainId,
                  chainName: name,
                  chainLogo: logo,
                  assetAddress: asset.underlying,
                  assetSymbol: symbol,
                  assetName,
                  assetLogo,
                  decimals,
                  supplyBalance: supply,
                  supplyBalanceFormatted: supplyFormatted,
                  supplyBalanceUsd,
                  supplyApy,
                  isCollateralEnabled,
                  variableDebt: borrow,
                  variableDebtFormatted: debtFormatted,
                  variableDebtUsd,
                  borrowApy,
                  dataSource: 'rpc',
                  market: matchedMarket,
                  aTokenAddress: asset.aToken,
                  variableDebtTokenAddress: asset.vToken,
                  stableDebtTokenAddress: null,
                  reserveId: 0,
                  lastUpdateTimestamp: 0,
                  currentLiquidityRate: 0n,
                  currentVariableBorrowRate: 0n,
                  poolAddress: checksummedPool as `0x${string}`,
                  poolAddressesProvider: aaveAddresses.POOL_ADDRESSES_PROVIDER as `0x${string}`,
                  uiPoolDataProvider: aaveAddresses.UI_POOL_DATA_PROVIDER as `0x${string}`,
                  oracleAddress: aaveAddresses.ORACLE as `0x${string}`,
                });

                debugEntry.positionsFound++;
              }

              debugEntry.dataSource = 'rpc';
            } else {
              debugEntry.error = 'No assets in address book for this chain';
              debugEntry.discoveryMethod = 'address-book-balanceOf';
            }

            // ── Resolve account data ──
            const accountResult = await accountPromise;
            if (accountResult) {
              const ad = parseAccountData(accountResult, chainId, name);
              if (ad) {
                allAccountData.push(ad);
                debugEntry.accountDataFetched = true;
                debugEntry.accountCollateralBase = ad.totalCollateralUsd.toFixed(2);
                debugEntry.accountDebtBase = ad.totalDebtUsd.toFixed(2);
                debugEntry.accountHF = ad.healthFactor > 1e10 ? '∞' : ad.healthFactor.toFixed(4);

                // Wrong market detection
                if ((ad.totalCollateralUsd > 0 || ad.totalDebtUsd > 0) && debugEntry.positionsFound === 0) {
                  debugEntry.wrongMarketWarning = `Account has $${ad.totalCollateralUsd.toFixed(2)} collateral / $${ad.totalDebtUsd.toFixed(2)} debt but 0 positions found. Possible wrong market or missing assets in address book.`;
                }
              }
            }

          } catch (err: any) {
            console.error(`[AavePositions] Chain ${name} CRASHED:`, err);
            debugEntry.error = String(err?.message || err).slice(0, 200);
          }

          allDebugInfo.push(debugEntry);
        }),
      );
    } finally {
      if (myFetchId === fetchIdRef.current) {
        setPositions(allPositions);
        setChainAccountData(allAccountData);
        setDebugInfo(allDebugInfo);
        setLastFetchedAt(startedAt);
        setLoading(false);

        const total = allDebugInfo.reduce((s, d) => s + d.positionsFound, 0);
        const methods = allDebugInfo.map(d => `${d.chainName}:${d.discoveryMethod || 'none'}(${d.positionsFound})`).join(', ');
        console.log(
          `[AavePositions] ✅ Done (req#${myFetchId}). Total positions=${total}. ${methods}`,
        );
        // Log detailed debug per chain
        for (const d of allDebugInfo) {
          const parts = [
            `${d.chainName}:`,
            `assets=${d.addressBookAssetsCount}`,
            `ok=${d.balanceOfCallsOk}`,
            `fail=${d.balanceOfCallsFailed}`,
            `positions=${d.positionsFound}`,
            `acct=${d.accountDataFetched ? '✓' : '✗'}`,
            d.accountCollateralBase ? `coll=$${d.accountCollateralBase}` : '',
            d.accountDebtBase ? `debt=$${d.accountDebtBase}` : '',
            d.accountHF ? `hf=${d.accountHF}` : '',
          ].filter(Boolean);
          console.log(`[AavePositions]   ${parts.join(' ')}`);
          if (d.wrongMarketWarning) {
            console.warn(`[AavePositions]   ⚠️ ${d.wrongMarketWarning}`);
          }
          if (d.lastError) {
            console.warn(`[AavePositions]   lastErr=${d.lastError.slice(0, 100)}`);
          }
        }
      } else {
        console.log(`[AavePositions] req#${myFetchId} stale — discarded`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isConnected]);

  useEffect(() => {
    if (isConnected && address) {
      fetchPositions();
    } else if (!isConnected) {
      setPositions([]);
      setChainAccountData([]);
      setLoading(false);
      setLastFetchedAt(null);
    }
  }, [fetchPositions, isConnected, address]);

  const totalSupplyUsd = useMemo(() => positions.reduce((acc, p) => acc + p.supplyBalanceUsd, 0), [positions]);
  const totalBorrowUsd = useMemo(() => positions.reduce((acc, p) => acc + p.variableDebtUsd, 0), [positions]);
  const totalCollateralUsd = useMemo(() => chainAccountData.reduce((acc, d) => acc + d.totalCollateralUsd, 0), [chainAccountData]);
  const totalAccountDebtUsd = useMemo(() => chainAccountData.reduce((acc, d) => acc + d.totalDebtUsd, 0), [chainAccountData]);
  const totalAvailableBorrowsUsd = useMemo(() => chainAccountData.reduce((acc, d) => acc + d.availableBorrowsUsd, 0), [chainAccountData]);
  const lowestHealthFactor = useMemo(() => {
    const factors = chainAccountData.filter(d => d.totalDebtUsd > 0).map(d => d.healthFactor);
    return factors.length > 0 ? Math.min(...factors) : null;
  }, [chainAccountData]);

  return {
    positions, chainAccountData, loading, error,
    refresh: fetchPositions,
    totalSupplyUsd, totalBorrowUsd, totalCollateralUsd,
    totalAccountDebtUsd, totalAvailableBorrowsUsd,
    lowestHealthFactor, debugInfo, lastFetchedAt,
  };
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function parseAccountData(result: any, chainId: number, chainName: string): AaveChainAccountData | null {
  try {
    const totalCollateralBase  = safeExtractBigInt(result, 'totalCollateralBase', 0);
    const totalDebtBase        = safeExtractBigInt(result, 'totalDebtBase', 1);
    const availableBorrowsBase = safeExtractBigInt(result, 'availableBorrowsBase', 2);
    const currentLiqThreshold  = safeExtractBigInt(result, 'currentLiquidationThreshold', 3);
    const ltvRaw               = safeExtractBigInt(result, 'ltv', 4);
    const healthFactor         = safeExtractBigInt(result, 'healthFactor', 5);

    return {
      chainId, chainName,
      totalCollateralUsd: Number(totalCollateralBase) / 1e8,
      totalDebtUsd: Number(totalDebtBase) / 1e8,
      availableBorrowsUsd: Number(availableBorrowsBase) / 1e8,
      healthFactor: Number(healthFactor) / 1e18,
      ltv: Number(ltvRaw) / 100,
      liquidationThreshold: Number(currentLiqThreshold) / 100,
      dataSource: 'rpc',
    };
  } catch { return null; }
}

function safeExtractBigInt(obj: any, name: string, index: number): bigint {
  const v = obj?.[name] ?? obj?.[index];
  if (v === undefined || v === null) return 0n;
  try { return BigInt(v); } catch { return 0n; }
}
