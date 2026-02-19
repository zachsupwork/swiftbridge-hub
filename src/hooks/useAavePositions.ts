/**
 * Aave V3 Positions Hook — v7 (in-flight guard + stable deps)
 *
 * ARCHITECTURE:
 *   1. Pool.getReservesList()                    → all reserve asset addresses on this chain
 *   2. Pool.getReserveData(asset) per reserve    → aTokenAddress, variableDebtTokenAddress
 *   3. aToken.balanceOf(user)                    → real supply balance
 *      variableDebtToken.balanceOf(user)         → real variable debt
 *   4. Pool.getUserAccountData(user)             → HF / collateral / debt / available borrow
 *   5. Enrich with DeFiLlama market metadata if a matching market exists
 *      (symbol, APYs, price, logo). For unknown assets, read ERC20 metadata on-chain.
 *
 *   Changes in v7:
 *   - Request-ID guard: only the latest fetch applies state (prevents stale-overwrite)
 *   - try/finally ensures setLoading(false) ALWAYS fires
 *   - marketLookup stored in ref to remove `markets` from useCallback deps
 *   - Stable fetchPositions → no endless re-trigger when markets list changes
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAccount } from 'wagmi';
import { createPublicClient, http, fallback, formatUnits, getAddress, parseAbi, erc20Abi } from 'viem';
import { tryNormalizeAddress } from '@/lib/address';
import { mainnet, arbitrum, optimism, polygon, base, avalanche } from 'viem/chains';
import { SUPPORTED_CHAINS, getFallbackRpcs } from '@/lib/chainConfig';
import { getAaveAddresses } from '@/lib/aaveAddressBook';
import type { LendingMarket } from '@/hooks/useLendingMarkets';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const DEBUG = import.meta.env.DEV;

/** Max reserves to fetch in parallel per chain to avoid RPC rate limits */
const BATCH_SIZE = 12;

// Known USD stablecoins → always price at $1
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
// ABIs — simple, proven, no large structs
// ──────────────────────────────────────────────

const POOL_RESERVES_LIST_ABI = parseAbi([
  'function getReservesList() view returns (address[])',
]);

const POOL_RESERVE_ABI = parseAbi([
  'function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint8 id)',
]);

const POOL_ACCOUNT_ABI = parseAbi([
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
]);

const ERC20_META_ABI = parseAbi([
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
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
  // Supply (real balance from aToken.balanceOf)
  supplyBalance: bigint;
  supplyBalanceFormatted: string;
  supplyBalanceUsd: number;
  supplyApy: number;
  isCollateralEnabled: boolean;
  // Borrow (real balance from variableDebtToken.balanceOf)
  variableDebt: bigint;
  variableDebtFormatted: string;
  variableDebtUsd: number;
  borrowApy: number;
  // Source of data
  dataSource: 'rpc' | 'subgraph';
  // Market reference (present when DeFiLlama had a matching entry)
  market?: LendingMarket;

  // ── Reserve contract addresses (from getReserveData) ──
  aTokenAddress: `0x${string}` | null;
  variableDebtTokenAddress: `0x${string}` | null;
  stableDebtTokenAddress: `0x${string}` | null;
  reserveId: number;
  lastUpdateTimestamp: number;
  // Raw borrow rates (ray-encoded 1e27)
  currentLiquidityRate: bigint;
  currentVariableBorrowRate: bigint;

  // ── Official Aave per-chain protocol addresses ──
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
}

export interface UseAavePositionsResult {
  positions: AavePosition[];
  chainAccountData: AaveChainAccountData[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** Sum of supplyBalanceUsd across all positions (may be 0 when prices missing) */
  totalSupplyUsd: number;
  /** Sum of variableDebtUsd across all positions (may be 0 when prices missing) */
  totalBorrowUsd: number;
  /** Sum of totalCollateralUsd from getUserAccountData — authoritative USD collateral value */
  totalCollateralUsd: number;
  /** Sum of totalDebtUsd from getUserAccountData — authoritative USD debt value */
  totalAccountDebtUsd: number;
  /** Sum of availableBorrowsUsd from getUserAccountData */
  totalAvailableBorrowsUsd: number;
  lowestHealthFactor: number | null;
  debugInfo: ChainDebugInfo[];
  /** Timestamp when last successful fetch started */
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
    http(rpc, { timeout: 15_000, retryCount: 0 })
  );

  return createPublicClient({
    chain: viemChain,
    transport: transports.length === 1
      ? transports[0]
      : fallback(transports, { rank: false }),
  }) as ReturnType<typeof createPublicClient>;
}

// ──────────────────────────────────────────────
// Helper: Run items in batches to avoid RPC rate limits
// ──────────────────────────────────────────────

async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
  }
  return results;
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

  // ── In-flight request guard ──
  // We increment this on each fetch. Callbacks check if their ID still matches before applying state.
  const fetchIdRef = useRef(0);

  // ── Markets stored in ref — allows fetchPositions to read markets without being in deps ──
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

    // Increment fetch ID — any earlier in-flight fetch will see a mismatch and abort its state update
    const myFetchId = ++fetchIdRef.current;
    const startedAt = Date.now();

    setLoading(true);
    setError(null);

    const allPositions: AavePosition[] = [];
    const allAccountData: AaveChainAccountData[] = [];
    const allDebugInfo: ChainDebugInfo[] = [];

    // Build a fast lookup map from DeFiLlama markets for metadata enrichment
    // key = `${chainId}-${assetAddress.toLowerCase()}`
    const currentMarkets = marketsRef.current;
    const marketLookup = new Map<string, LendingMarket>();
    for (const m of currentMarkets) {
      const key = `${m.chainId}-${m.assetAddress.toLowerCase()}`;
      marketLookup.set(key, m);
    }

    try {
      // Process all chains in parallel; failures are isolated per-chain
      await Promise.allSettled(
        SUPPORTED_CHAINS.map(async (chainConfig) => {
          const { chainId, name, logo, rpcUrl } = chainConfig;

          const aaveAddresses = getAaveAddresses(chainId);
          if (!aaveAddresses) return;

          const debugEntry: ChainDebugInfo = {
            chainId,
            chainName: name,
            dataSource: 'failed',
            reservesListCount: 0,
            reservesScannedCount: 0,
            positionsFound: 0,
            accountDataFetched: false,
            startedAt,
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

            // ── STEP 1: getUserAccountData (fire in parallel with reserve discovery) ──
            const accountPromise = (client.readContract as any)({
              address: checksummedPool,
              abi: POOL_ACCOUNT_ABI,
              functionName: 'getUserAccountData',
              args: [address],
            }).catch((e: any) => {
              if (DEBUG) console.warn(`[AavePositions] ${name}: getUserAccountData failed:`, e);
              debugEntry.failedStep = 'getUserAccountData';
              return null;
            });

            // ── STEP 2: getReservesList — get ALL configured assets on this chain ──
            let reservesList: `0x${string}`[] = [];
            try {
              const rawList = await (client.readContract as any)({
                address: checksummedPool,
                abi: POOL_RESERVES_LIST_ABI,
                functionName: 'getReservesList',
                args: [],
              });
              reservesList = (rawList as `0x${string}`[]).filter(
                (a): a is `0x${string}` => typeof a === 'string' && a.startsWith('0x') && a !== '0x0000000000000000000000000000000000000000',
              );
              debugEntry.reservesListCount = reservesList.length;
              if (DEBUG) console.log(`[AavePositions] ${name}: getReservesList → ${reservesList.length} reserves`);
            } catch (e: any) {
              debugEntry.failedStep = 'getReservesList';
              debugEntry.error = String(e?.message || e);
              if (DEBUG) console.warn(`[AavePositions] ${name}: getReservesList failed:`, e);

              // Fallback: use DeFiLlama markets for this chain as asset list
              const chainMarkets = currentMarkets.filter(m => m.chainId === chainId);
              reservesList = chainMarkets.map(m => {
                try { return getAddress(m.assetAddress) as `0x${string}`; } catch { return null; }
              }).filter((a): a is `0x${string}` => a !== null);

              debugEntry.reservesListCount = reservesList.length;
              if (DEBUG) console.log(`[AavePositions] ${name}: fallback to ${reservesList.length} DeFiLlama markets`);
            }

            if (reservesList.length === 0) {
              allDebugInfo.push(debugEntry);
              const accountResult = await accountPromise;
              if (accountResult) {
                const ad = parseAccountData(accountResult, chainId, name);
                if (ad) allAccountData.push(ad);
              }
              return;
            }

            // ── STEP 3: For each reserve, get aToken + debtToken addresses, then balances ──
            const positionCandidates = await runInBatches(
              reservesList,
              BATCH_SIZE,
              async (assetAddr): Promise<{
                assetAddr: `0x${string}`;
                supplyBalance: bigint;
                variableDebt: bigint;
                aTokenAddress: `0x${string}`;
                varDebtTokenAddress: `0x${string}` | null;
                stableDebtTokenAddress: `0x${string}` | null;
                currentLiquidityRate: bigint;
                currentVariableBorrowRate: bigint;
                reserveId: number;
                lastUpdateTimestamp: number;
              } | null> => {
                let checksummedAsset: `0x${string}`;
                try {
                  checksummedAsset = getAddress(assetAddr) as `0x${string}`;
                } catch {
                  return null;
                }

                let aTokenAddress: `0x${string}` | null = null;
                let varDebtTokenAddress: `0x${string}` | null = null;
                let stableDebtTokenAddress: `0x${string}` | null = null;
                let currentLiquidityRate = 0n;
                let currentVariableBorrowRate = 0n;
                let reserveId = 0;
                let lastUpdateTimestamp = 0;

                try {
                  const rd = await (client.readContract as any)({
                    address: checksummedPool,
                    abi: POOL_RESERVE_ABI,
                    functionName: 'getReserveData',
                    args: [checksummedAsset],
                  }) as any;

                  aTokenAddress = (rd?.aTokenAddress ?? rd?.[7] ?? null) as `0x${string}` | null;
                  stableDebtTokenAddress = (rd?.stableDebtTokenAddress ?? rd?.[8] ?? null) as `0x${string}` | null;
                  varDebtTokenAddress = (rd?.variableDebtTokenAddress ?? rd?.[9] ?? null) as `0x${string}` | null;
                  currentLiquidityRate = safeExtractBigInt(rd, 'currentLiquidityRate', 2);
                  currentVariableBorrowRate = safeExtractBigInt(rd, 'currentVariableBorrowRate', 4);
                  reserveId = Number(rd?.id ?? rd?.[11] ?? 0);
                  lastUpdateTimestamp = Number(rd?.lastUpdateTimestamp ?? rd?.[6] ?? 0);

                  if (!aTokenAddress || aTokenAddress === '0x0000000000000000000000000000000000000000') {
                    return null;
                  }
                } catch {
                  return null;
                }

                // Read balances in parallel
                const [supplyRaw, debtRaw] = await Promise.all([
                  (client.readContract as any)({
                    address: aTokenAddress,
                    abi: erc20Abi,
                    functionName: 'balanceOf',
                    args: [address],
                  }).catch(() => 0n),

                  varDebtTokenAddress && varDebtTokenAddress !== '0x0000000000000000000000000000000000000000'
                    ? (client.readContract as any)({
                      address: varDebtTokenAddress,
                      abi: erc20Abi,
                      functionName: 'balanceOf',
                      args: [address],
                    }).catch(() => 0n)
                    : Promise.resolve(0n),
                ]);

                const supplyBalance = BigInt(supplyRaw ?? 0n);
                const variableDebt = BigInt(debtRaw ?? 0n);

                // Skip if no position
                if (supplyBalance === 0n && variableDebt === 0n) return null;

                return {
                  assetAddr: checksummedAsset,
                  supplyBalance,
                  variableDebt,
                  aTokenAddress,
                  varDebtTokenAddress,
                  stableDebtTokenAddress,
                  currentLiquidityRate,
                  currentVariableBorrowRate,
                  reserveId,
                  lastUpdateTimestamp,
                };
              },
            );

            debugEntry.reservesScannedCount = reservesList.length;

            // ── STEP 4: Build positions — enrich with DeFiLlama or on-chain ERC20 metadata ──
            for (const candidate of positionCandidates) {
              if (!candidate) continue;

              const {
                assetAddr, supplyBalance, variableDebt,
                currentLiquidityRate, currentVariableBorrowRate,
                aTokenAddress: candidateAToken,
                varDebtTokenAddress: candidateVarDebt,
                stableDebtTokenAddress: candidateStableDebt,
                reserveId: candidateReserveId,
                lastUpdateTimestamp: candidateLUT,
              } = candidate;
              const lookupKey = `${chainId}-${assetAddr.toLowerCase()}`;
              const matchedMarket = marketLookup.get(lookupKey);

              let symbol = 'UNKNOWN';
              let assetName = 'Unknown Token';
              let decimals = 18;
              let priceUsd = 0;
              let supplyApy = 0;
              let borrowApy = 0;
              let assetLogo = getTokenLogo('UNKNOWN');
              let isCollateralEnabled = true;

              if (matchedMarket) {
                symbol = matchedMarket.assetSymbol;
                assetName = matchedMarket.assetName;
                decimals = matchedMarket.decimals || 18;
                priceUsd = matchedMarket.priceUsd || 0;
                supplyApy = matchedMarket.supplyAPY;
                borrowApy = matchedMarket.borrowAPY;
                assetLogo = matchedMarket.assetLogo || getTokenLogo(symbol);
                isCollateralEnabled = matchedMarket.collateralEnabled;
              } else {
                // Fallback: read ERC20 metadata on-chain
                try {
                  const [sym, dec, nm] = await Promise.all([
                    (client.readContract as any)({ address: assetAddr, abi: ERC20_META_ABI, functionName: 'symbol' }).catch(() => 'UNKNOWN'),
                    (client.readContract as any)({ address: assetAddr, abi: ERC20_META_ABI, functionName: 'decimals' }).catch(() => 18),
                    (client.readContract as any)({ address: assetAddr, abi: ERC20_META_ABI, functionName: 'name' }).catch(() => 'Unknown Token'),
                  ]);
                  symbol = String(sym);
                  decimals = Number(dec);
                  assetName = String(nm);
                } catch {
                  // keep defaults
                }

                // Derive APYs from ray-encoded rates
                const RAY = 1e27;
                supplyApy = (Number(currentLiquidityRate) / RAY) * 100;
                borrowApy = (Number(currentVariableBorrowRate) / RAY) * 100;

                if (isStable(symbol)) priceUsd = 1;
                assetLogo = getTokenLogo(symbol);
              }

              if (!priceUsd && isStable(symbol)) priceUsd = 1;

              const supplyFormatted = formatUnits(supplyBalance, decimals);
              const debtFormatted = formatUnits(variableDebt, decimals);
              const supplyBalanceUsd = parseFloat(supplyFormatted) * priceUsd;
              const variableDebtUsd = parseFloat(debtFormatted) * priceUsd;

              if (DEBUG) {
                console.log(
                  `[AavePositions] ${name} ${symbol} (${assetAddr.slice(0, 8)}):`,
                  `supply=${supplyFormatted} ($${supplyBalanceUsd.toFixed(4)})`,
                  `debt=${debtFormatted} ($${variableDebtUsd.toFixed(4)})`,
                  matchedMarket ? '✓ DeFiLlama' : '⚡ on-chain meta',
                );
              }

              allPositions.push({
                chainId,
                chainName: name,
                chainLogo: logo,
                assetAddress: assetAddr,
                assetSymbol: symbol,
                assetName,
                assetLogo,
                decimals,
                supplyBalance,
                supplyBalanceFormatted: supplyFormatted,
                supplyBalanceUsd,
                supplyApy,
                isCollateralEnabled,
                variableDebt,
                variableDebtFormatted: debtFormatted,
                variableDebtUsd,
                borrowApy,
                dataSource: 'rpc',
                market: matchedMarket,
                // Reserve contract addresses
                aTokenAddress: candidateAToken,
                variableDebtTokenAddress: candidateVarDebt,
                stableDebtTokenAddress: candidateStableDebt ?? null,
                reserveId: candidateReserveId,
                lastUpdateTimestamp: candidateLUT,
                currentLiquidityRate,
                currentVariableBorrowRate,
                // Protocol addresses for this chain
                poolAddress: checksummedPool as `0x${string}`,
                poolAddressesProvider: (aaveAddresses.POOL_ADDRESSES_PROVIDER as `0x${string}`) ?? null,
                uiPoolDataProvider: (aaveAddresses.UI_POOL_DATA_PROVIDER as `0x${string}`) ?? null,
                oracleAddress: (aaveAddresses.ORACLE as `0x${string}`) ?? null,
              });

              debugEntry.positionsFound++;
            }

            debugEntry.dataSource = 'rpc';

            // ── STEP 5: Resolve account data ──
            const accountResult = await accountPromise;
            if (accountResult) {
              const ad = parseAccountData(accountResult, chainId, name);
              if (ad) {
                allAccountData.push(ad);
                debugEntry.accountDataFetched = true;
              }
            }

          } catch (err) {
            console.error(`[AavePositions] Chain ${name} failed:`, err);
            debugEntry.error = String(err);
          }

          allDebugInfo.push(debugEntry);
        }),
      );
    } finally {
      // ── In-flight guard: only apply state if this is still the latest request ──
      if (myFetchId === fetchIdRef.current) {
        setPositions(allPositions);
        setChainAccountData(allAccountData);
        setDebugInfo(allDebugInfo);
        setLastFetchedAt(startedAt);
        setLoading(false);

        if (DEBUG) {
          const total = allDebugInfo.reduce((s, d) => s + d.positionsFound, 0);
          const scanned = allDebugInfo.reduce((s, d) => s + d.reservesScannedCount, 0);
          const listed = allDebugInfo.reduce((s, d) => s + d.reservesListCount, 0);
          console.log(
            `[AavePositions] Done (req#${myFetchId}). Listed=${listed} Scanned=${scanned} PositionsFound=${total}`,
            allDebugInfo,
          );
        }
      } else {
        if (DEBUG) console.log(`[AavePositions] req#${myFetchId} stale — discarded`);
      }
    }
    // NOTE: `markets` intentionally NOT in deps — we use marketsRef to avoid re-triggering
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isConnected]);

  // Re-fetch whenever wallet connects
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

  const totalSupplyUsd = useMemo(
    () => positions.reduce((acc, p) => acc + p.supplyBalanceUsd, 0),
    [positions],
  );
  const totalBorrowUsd = useMemo(
    () => positions.reduce((acc, p) => acc + p.variableDebtUsd, 0),
    [positions],
  );
  const totalCollateralUsd = useMemo(
    () => chainAccountData.reduce((acc, d) => acc + d.totalCollateralUsd, 0),
    [chainAccountData],
  );
  const totalAccountDebtUsd = useMemo(
    () => chainAccountData.reduce((acc, d) => acc + d.totalDebtUsd, 0),
    [chainAccountData],
  );
  const totalAvailableBorrowsUsd = useMemo(
    () => chainAccountData.reduce((acc, d) => acc + d.availableBorrowsUsd, 0),
    [chainAccountData],
  );
  const lowestHealthFactor = useMemo(() => {
    const factors = chainAccountData
      .filter((d) => d.totalDebtUsd > 0)
      .map((d) => d.healthFactor);
    return factors.length > 0 ? Math.min(...factors) : null;
  }, [chainAccountData]);

  return {
    positions,
    chainAccountData,
    loading,
    error,
    refresh: fetchPositions,
    totalSupplyUsd,
    totalBorrowUsd,
    totalCollateralUsd,
    totalAccountDebtUsd,
    totalAvailableBorrowsUsd,
    lowestHealthFactor,
    debugInfo,
    lastFetchedAt,
  };
}

// ──────────────────────────────────────────────
// Helper: parse getUserAccountData result
// ──────────────────────────────────────────────

function parseAccountData(result: any, chainId: number, chainName: string): AaveChainAccountData | null {
  try {
    const totalCollateralBase  = safeExtractBigInt(result, 'totalCollateralBase', 0);
    const totalDebtBase        = safeExtractBigInt(result, 'totalDebtBase', 1);
    const availableBorrowsBase = safeExtractBigInt(result, 'availableBorrowsBase', 2);
    const currentLiqThreshold  = safeExtractBigInt(result, 'currentLiquidationThreshold', 3);
    const ltvRaw               = safeExtractBigInt(result, 'ltv', 4);
    const healthFactor         = safeExtractBigInt(result, 'healthFactor', 5);

    const totalCollateralUsd  = Number(totalCollateralBase) / 1e8;
    const totalDebtUsd        = Number(totalDebtBase) / 1e8;
    const availableBorrowsUsd = Number(availableBorrowsBase) / 1e8;
    const hf                  = Number(healthFactor) / 1e18;

    return {
      chainId,
      chainName,
      totalCollateralUsd,
      totalDebtUsd,
      availableBorrowsUsd,
      healthFactor: hf,
      ltv: Number(ltvRaw) / 100,
      liquidationThreshold: Number(currentLiqThreshold) / 100,
      dataSource: 'rpc',
    };
  } catch {
    return null;
  }
}

function safeExtractBigInt(obj: any, name: string, index: number): bigint {
  const v = obj?.[name] ?? obj?.[index];
  if (v === undefined || v === null) return 0n;
  try { return BigInt(v); } catch { return 0n; }
}
