/**
 * Aave V3 Positions Hook — v9 (UiPoolDataProvider-first, minimal ABI)
 *
 * ARCHITECTURE:
 *   PRIMARY PATH (fast — 1 RPC call to discover, then N targeted calls for position reserves only):
 *   1. UiPoolDataProvider.getUserReservesData(addressesProvider, user)
 *      → returns per-reserve scaled balances + collateral state (simple struct, works on ALL chains)
 *   2. For reserves where user HAS a position (typically 1-3):
 *      → Pool.getReserveData(asset) to get liquidityIndex/variableBorrowIndex for balance conversion
 *   3. Pool.getUserAccountData(user) in parallel → HF / collateral / debt totals
 *   4. Enrich with DeFiLlama market metadata
 *
 *   FALLBACK (slow — N+1 calls per chain, used only when UiPoolDataProvider fails):
 *   Same as v7: getReservesList → getReserveData per reserve → balanceOf per reserve
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

const DEBUG = true; // Always log for debugging

const BATCH_SIZE = 12;

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
// ABIs
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

/**
 * UiPoolDataProvider.getUserReservesData ABI — MINIMAL struct (works on ALL Aave V3 deployments)
 * Returns (UserReserveData[], uint8 eModeCategory)
 */
const UI_POOL_USER_RESERVES_ABI = [
  {
    inputs: [
      { internalType: 'contract IPoolAddressesProvider', name: 'provider', type: 'address' },
      { internalType: 'address', name: 'user', type: 'address' },
    ],
    name: 'getUserReservesData',
    outputs: [
      {
        components: [
          { internalType: 'address', name: 'underlyingAsset', type: 'address' },
          { internalType: 'uint256', name: 'scaledATokenBalance', type: 'uint256' },
          { internalType: 'bool', name: 'usageAsCollateralEnabledOnUser', type: 'bool' },
          { internalType: 'uint256', name: 'stableBorrowRate', type: 'uint256' },
          { internalType: 'uint256', name: 'scaledVariableDebt', type: 'uint256' },
          { internalType: 'uint256', name: 'principalStableDebt', type: 'uint256' },
          { internalType: 'uint256', name: 'stableBorrowLastUpdateTimestamp', type: 'uint256' },
        ],
        internalType: 'struct IUiPoolDataProviderV3.UserReserveData[]',
        name: '',
        type: 'tuple[]',
      },
      { internalType: 'uint8', name: '', type: 'uint8' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

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
  discoveryMethod?: 'uiPoolDataProvider' | 'fallback-scanning';
  uiPoolCallOk?: boolean;
  uiPoolReservesReturned?: number;
  uiPoolError?: string;
  scanCallsSucceeded?: number;
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
// Helper: Run items in batches
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

          const debugEntry: ChainDebugInfo = {
            chainId,
            chainName: name,
            dataSource: 'failed',
            reservesListCount: 0,
            reservesScannedCount: 0,
            positionsFound: 0,
            accountDataFetched: false,
            startedAt,
            uiPoolCallOk: false,
            uiPoolReservesReturned: 0,
            scanCallsSucceeded: 0,
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
            // PRIMARY: UiPoolDataProvider.getUserReservesData
            // ════════════════════════════════════════════════

            let usedPrimaryPath = false;

            try {
              const uiProvider = getAddress(aaveAddresses.UI_POOL_DATA_PROVIDER);
              const addressesProvider = getAddress(aaveAddresses.POOL_ADDRESSES_PROVIDER);

              console.log(`[AavePositions] ${name}: calling getUserReservesData on ${uiProvider} with provider ${addressesProvider}`);

              const userReservesRaw = await (client.readContract as any)({
                address: uiProvider,
                abi: UI_POOL_USER_RESERVES_ABI,
                functionName: 'getUserReservesData',
                args: [addressesProvider, address],
              });

              // Parse — result is [UserReserveData[], uint8] or just the array
              const userReserves: any[] = Array.isArray(userReservesRaw)
                ? (Array.isArray(userReservesRaw[0]) ? userReservesRaw[0] : userReservesRaw)
                : [];

              debugEntry.uiPoolCallOk = true;
              debugEntry.uiPoolReservesReturned = userReserves.length;

              console.log(`[AavePositions] ${name}: getUserReservesData returned ${userReserves.length} reserves`);

              // Filter to reserves with non-zero positions
              const activeReserves: Array<{
                assetAddr: `0x${string}`;
                scaledAToken: bigint;
                scaledVarDebt: bigint;
                isCollateral: boolean;
              }> = [];

              for (const ur of userReserves) {
                const scaledAToken = BigInt(ur.scaledATokenBalance ?? ur[1] ?? 0n);
                const scaledVarDebt = BigInt(ur.scaledVariableDebt ?? ur[4] ?? 0n);
                const principalStableDebt = BigInt(ur.principalStableDebt ?? ur[5] ?? 0n);

                if (scaledAToken === 0n && scaledVarDebt === 0n && principalStableDebt === 0n) continue;

                const rawAsset = ur.underlyingAsset ?? ur[0];
                const assetAddr = tryNormalizeAddress(rawAsset);
                if (!assetAddr) continue;

                const isCollateral = Boolean(ur.usageAsCollateralEnabledOnUser ?? ur[2] ?? true);

                activeReserves.push({ assetAddr, scaledAToken, scaledVarDebt, isCollateral });
              }

              console.log(`[AavePositions] ${name}: ${activeReserves.length} active positions from getUserReservesData`);

              if (activeReserves.length > 0) {
                // For each active reserve, get reserve data (indices + contract addresses)
                // This is only 1-5 calls, not 50+
                const reserveResults = await Promise.allSettled(
                  activeReserves.map(async (ar) => {
                    const rd = await (client.readContract as any)({
                      address: checksummedPool,
                      abi: POOL_RESERVE_ABI,
                      functionName: 'getReserveData',
                      args: [ar.assetAddr],
                    });
                    return { ...ar, reserveData: rd };
                  })
                );

                for (const result of reserveResults) {
                  if (result.status !== 'fulfilled') {
                    console.warn(`[AavePositions] ${name}: getReserveData failed for a position:`, result.reason?.message);
                    continue;
                  }

                  const { assetAddr, scaledAToken, scaledVarDebt, isCollateral, reserveData: rd } = result.value;

                  // Extract indices and addresses
                  const liquidityIndex = BigInt(rd?.liquidityIndex ?? rd?.[1] ?? 10n ** 27n);
                  const variableBorrowIndex = BigInt(rd?.variableBorrowIndex ?? rd?.[3] ?? 10n ** 27n);
                  const aTokenAddr = tryNormalizeAddress(rd?.aTokenAddress ?? rd?.[7]);
                  const stableDebtAddr = tryNormalizeAddress(rd?.stableDebtTokenAddress ?? rd?.[8]);
                  const varDebtAddr = tryNormalizeAddress(rd?.variableDebtTokenAddress ?? rd?.[9]);
                  const currentLiquidityRate = safeExtractBigInt(rd, 'currentLiquidityRate', 2);
                  const currentVariableBorrowRate = safeExtractBigInt(rd, 'currentVariableBorrowRate', 4);
                  const reserveId = Number(rd?.id ?? rd?.[11] ?? 0);
                  const lastUpdateTs = Number(rd?.lastUpdateTimestamp ?? rd?.[6] ?? 0);

                  // Convert scaled balances to actual using indices
                  const RAY = 10n ** 27n;
                  const supplyBalance = (scaledAToken * liquidityIndex) / RAY;
                  const variableDebt = (scaledVarDebt * variableBorrowIndex) / RAY;

                  // Enrich with DeFiLlama
                  const lookupKey = `${chainId}-${assetAddr.toLowerCase()}`;
                  const matchedMarket = marketLookup.get(lookupKey);

                  let symbol = 'UNKNOWN';
                  let assetName = 'Unknown Token';
                  let decimals = 18;
                  let priceUsd = 0;
                  let supplyApy = 0;
                  let borrowApy = 0;
                  let assetLogo = getTokenLogo('UNKNOWN');

                  if (matchedMarket) {
                    symbol = matchedMarket.assetSymbol;
                    assetName = matchedMarket.assetName;
                    decimals = matchedMarket.decimals || 18;
                    priceUsd = matchedMarket.priceUsd || 0;
                    supplyApy = matchedMarket.supplyAPY;
                    borrowApy = matchedMarket.borrowAPY;
                    assetLogo = matchedMarket.assetLogo || getTokenLogo(symbol);
                  } else {
                    // Fallback: read ERC20 metadata
                    try {
                      const [sym, dec, nm] = await Promise.all([
                        (client.readContract as any)({ address: assetAddr, abi: ERC20_META_ABI, functionName: 'symbol' }).catch(() => 'UNKNOWN'),
                        (client.readContract as any)({ address: assetAddr, abi: ERC20_META_ABI, functionName: 'decimals' }).catch(() => 18),
                        (client.readContract as any)({ address: assetAddr, abi: ERC20_META_ABI, functionName: 'name' }).catch(() => 'Unknown Token'),
                      ]);
                      symbol = String(sym);
                      decimals = Number(dec);
                      assetName = String(nm);
                    } catch { /* keep defaults */ }

                    const rayF = 1e27;
                    supplyApy = (Number(currentLiquidityRate) / rayF) * 100;
                    borrowApy = (Number(currentVariableBorrowRate) / rayF) * 100;
                    assetLogo = getTokenLogo(symbol);
                  }

                  if (!priceUsd && isStable(symbol)) priceUsd = 1;

                  const supplyFormatted = formatUnits(supplyBalance, decimals);
                  const debtFormatted = formatUnits(variableDebt, decimals);
                  const supplyBalanceUsd = parseFloat(supplyFormatted) * priceUsd;
                  const variableDebtUsd = parseFloat(debtFormatted) * priceUsd;

                  console.log(
                    `[AavePositions] ${name} ${symbol}: supply=${supplyFormatted} ($${supplyBalanceUsd.toFixed(2)}) debt=${debtFormatted} ($${variableDebtUsd.toFixed(2)}) collateral=${isCollateral}`,
                  );

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
                    isCollateralEnabled: isCollateral,
                    variableDebt,
                    variableDebtFormatted: debtFormatted,
                    variableDebtUsd,
                    borrowApy,
                    dataSource: 'rpc',
                    market: matchedMarket,
                    aTokenAddress: aTokenAddr,
                    variableDebtTokenAddress: varDebtAddr,
                    stableDebtTokenAddress: stableDebtAddr,
                    reserveId,
                    lastUpdateTimestamp: lastUpdateTs,
                    currentLiquidityRate,
                    currentVariableBorrowRate,
                    poolAddress: checksummedPool as `0x${string}`,
                    poolAddressesProvider: aaveAddresses.POOL_ADDRESSES_PROVIDER as `0x${string}`,
                    uiPoolDataProvider: aaveAddresses.UI_POOL_DATA_PROVIDER as `0x${string}`,
                    oracleAddress: aaveAddresses.ORACLE as `0x${string}`,
                  });

                  debugEntry.positionsFound++;
                }
              }

              debugEntry.dataSource = 'rpc';
              debugEntry.discoveryMethod = 'uiPoolDataProvider';
              usedPrimaryPath = true;

            } catch (primaryErr: any) {
              const errMsg = primaryErr?.message || String(primaryErr);
              console.warn(`[AavePositions] ${name}: UiPoolDataProvider FAILED: ${errMsg}`);
              debugEntry.uiPoolCallOk = false;
              debugEntry.uiPoolError = errMsg.slice(0, 200);
              debugEntry.failedStep = 'getUserReservesData';
            }

            // ════════════════════════════════════════════════
            // FALLBACK: Per-reserve scanning (only if primary failed)
            // ════════════════════════════════════════════════

            if (!usedPrimaryPath) {
              console.log(`[AavePositions] ${name}: Falling back to reserve scanning...`);
              debugEntry.discoveryMethod = 'fallback-scanning';

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
                console.log(`[AavePositions] ${name}: getReservesList → ${reservesList.length} reserves`);
              } catch (e: any) {
                debugEntry.error = String(e?.message || e);
                debugEntry.firstError = String(e?.message || e).slice(0, 200);
                const chainMarkets = currentMarkets.filter(m => m.chainId === chainId);
                reservesList = chainMarkets.map(m => {
                  try { return getAddress(m.assetAddress) as `0x${string}`; } catch { return null; }
                }).filter((a): a is `0x${string}` => a !== null);
                debugEntry.reservesListCount = reservesList.length;
              }

              if (reservesList.length > 0) {
                let callsSucceeded = 0;
                let lastErr = '';

                const positionCandidates = await runInBatches(
                  reservesList,
                  BATCH_SIZE,
                  async (assetAddr) => {
                    let checksummedAsset: `0x${string}`;
                    try {
                      checksummedAsset = getAddress(assetAddr) as `0x${string}`;
                    } catch { return null; }

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

                      aTokenAddress = tryNormalizeAddress(rd?.aTokenAddress ?? rd?.[7]) as `0x${string}` | null;
                      stableDebtTokenAddress = tryNormalizeAddress(rd?.stableDebtTokenAddress ?? rd?.[8]) as `0x${string}` | null;
                      varDebtTokenAddress = tryNormalizeAddress(rd?.variableDebtTokenAddress ?? rd?.[9]) as `0x${string}` | null;
                      currentLiquidityRate = safeExtractBigInt(rd, 'currentLiquidityRate', 2);
                      currentVariableBorrowRate = safeExtractBigInt(rd, 'currentVariableBorrowRate', 4);
                      reserveId = Number(rd?.id ?? rd?.[11] ?? 0);
                      lastUpdateTimestamp = Number(rd?.lastUpdateTimestamp ?? rd?.[6] ?? 0);

                      if (!aTokenAddress || aTokenAddress === '0x0000000000000000000000000000000000000000') return null;
                      callsSucceeded++;
                    } catch (e: any) {
                      lastErr = String(e?.message || e).slice(0, 200);
                      return null;
                    }

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
                debugEntry.scanCallsSucceeded = callsSucceeded;
                if (lastErr) debugEntry.lastError = lastErr;

                for (const candidate of positionCandidates) {
                  if (!candidate) continue;

                  const { assetAddr, supplyBalance, variableDebt, currentLiquidityRate, currentVariableBorrowRate } = candidate;
                  const lookupKey = `${chainId}-${assetAddr.toLowerCase()}`;
                  const matchedMarket = marketLookup.get(lookupKey);

                  let symbol = 'UNKNOWN', assetName = 'Unknown Token', decimals = 18;
                  let priceUsd = 0, supplyApy = 0, borrowApy = 0;
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
                    try {
                      const [sym, dec, nm] = await Promise.all([
                        (client.readContract as any)({ address: assetAddr, abi: ERC20_META_ABI, functionName: 'symbol' }).catch(() => 'UNKNOWN'),
                        (client.readContract as any)({ address: assetAddr, abi: ERC20_META_ABI, functionName: 'decimals' }).catch(() => 18),
                        (client.readContract as any)({ address: assetAddr, abi: ERC20_META_ABI, functionName: 'name' }).catch(() => 'Unknown Token'),
                      ]);
                      symbol = String(sym); decimals = Number(dec); assetName = String(nm);
                    } catch { /* keep defaults */ }
                    const rayF = 1e27;
                    supplyApy = (Number(currentLiquidityRate) / rayF) * 100;
                    borrowApy = (Number(currentVariableBorrowRate) / rayF) * 100;
                    if (isStable(symbol)) priceUsd = 1;
                    assetLogo = getTokenLogo(symbol);
                  }

                  if (!priceUsd && isStable(symbol)) priceUsd = 1;
                  const supplyFormatted = formatUnits(supplyBalance, decimals);
                  const debtFormatted = formatUnits(variableDebt, decimals);

                  allPositions.push({
                    chainId, chainName: name, chainLogo: logo, assetAddress: assetAddr,
                    assetSymbol: symbol, assetName, assetLogo, decimals,
                    supplyBalance, supplyBalanceFormatted: supplyFormatted,
                    supplyBalanceUsd: parseFloat(supplyFormatted) * priceUsd, supplyApy,
                    isCollateralEnabled, variableDebt, variableDebtFormatted: debtFormatted,
                    variableDebtUsd: parseFloat(debtFormatted) * priceUsd, borrowApy,
                    dataSource: 'rpc', market: matchedMarket,
                    aTokenAddress: candidate.aTokenAddress,
                    variableDebtTokenAddress: candidate.varDebtTokenAddress,
                    stableDebtTokenAddress: candidate.stableDebtTokenAddress ?? null,
                    reserveId: candidate.reserveId, lastUpdateTimestamp: candidate.lastUpdateTimestamp,
                    currentLiquidityRate, currentVariableBorrowRate,
                    poolAddress: checksummedPool as `0x${string}`,
                    poolAddressesProvider: aaveAddresses.POOL_ADDRESSES_PROVIDER as `0x${string}`,
                    uiPoolDataProvider: aaveAddresses.UI_POOL_DATA_PROVIDER as `0x${string}`,
                    oracleAddress: aaveAddresses.ORACLE as `0x${string}`,
                  });
                  debugEntry.positionsFound++;
                }
                debugEntry.dataSource = 'rpc';
              }
            }

            // ── Resolve account data ──
            const accountResult = await accountPromise;
            if (accountResult) {
              const ad = parseAccountData(accountResult, chainId, name);
              if (ad) {
                allAccountData.push(ad);
                debugEntry.accountDataFetched = true;
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
          console.log(`[AavePositions]   ${d.chainName}: uiPool=${d.uiPoolCallOk ? '✓' : '✗'} reserves=${d.uiPoolReservesReturned ?? 0} positions=${d.positionsFound} acct=${d.accountDataFetched ? '✓' : '✗'}${d.uiPoolError ? ` err=${d.uiPoolError.slice(0, 80)}` : ''}${d.lastError ? ` scanErr=${d.lastError.slice(0, 80)}` : ''}`);
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
