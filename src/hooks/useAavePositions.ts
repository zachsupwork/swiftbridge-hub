/**
 * Aave V3 Positions Hook
 *
 * ARCHITECTURE (v4 — no getReservesData):
 *
 *   getReservesData returns a huge AggregatedReserveData[] struct that differs
 *   across UI provider versions and causes ABI-decode failures on every chain.
 *   We no longer call it.
 *
 *   Instead the pipeline is:
 *   1. getUserReservesData(provider, user)   → scaled balances per asset
 *   2. For each active asset, Pool.getReserveData(asset) → liquidityIndex + variableBorrowIndex
 *   3. Pool.getUserAccountData(user)         → HF / collateral / debt / available borrow
 *
 *   Ray math:
 *     realSupply      = scaledATokenBalance * liquidityIndex   / RAY
 *     realVariableDebt = scaledVariableDebt  * variableBorrowIndex / RAY
 *
 *   USD pricing: market.priceUsd → stablecoin $1 fallback → 0
 *   Chain isolation: one chain failing does NOT fail others.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { createPublicClient, http, fallback, formatUnits, getAddress, parseAbi } from 'viem';
import { tryNormalizeAddress } from '@/lib/address';
import { mainnet, arbitrum, optimism, polygon, base, avalanche } from 'viem/chains';
import { SUPPORTED_CHAINS, getFallbackRpcs } from '@/lib/chainConfig';
import { getAaveAddresses } from '@/lib/aaveAddressBook';
import type { LendingMarket } from '@/hooks/useLendingMarkets';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const RAY = 10n ** 27n;
const DEBUG = import.meta.env.DEV;

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
// ABIs — ALL via parseAbi for correct encoding
// ──────────────────────────────────────────────

/**
 * getUserReservesData — simpler than getReservesData, reliable across UI provider versions.
 * The function returns: (UserReserveData[], uint8 userEmodeCategoryId)
 * We only use the array; the trailing uint8 is fine to omit IF the chain returns only 1 value.
 * We handle both: if result is a tuple/array of 2 we take index 0, otherwise treat as array directly.
 */
const UI_POOL_USER_ABI = parseAbi([
  'function getUserReservesData(address provider, address user) view returns ((address underlyingAsset, uint256 scaledATokenBalance, bool usageAsCollateralEnabledOnUser, uint256 stableBorrowRate, uint256 scaledVariableDebt, uint256 principalStableDebt, uint256 stableBorrowLastUpdateTimestamp)[])',
]);

/**
 * Pool.getReserveData — returns the reserve state for a single asset.
 * We only need liquidityIndex + variableBorrowIndex from this.
 * The struct layout is stable across all Aave V3 deployments.
 */
const POOL_RESERVE_ABI = parseAbi([
  'function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint8 id)',
]);

/**
 * Pool.getUserAccountData — returns account-level metrics.
 */
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
  // Supply (REAL balances after Ray-math)
  supplyBalance: bigint;
  supplyBalanceFormatted: string;
  supplyBalanceUsd: number;
  supplyApy: number;
  isCollateralEnabled: boolean;
  // Borrow (REAL balances after Ray-math)
  variableDebt: bigint;
  variableDebtFormatted: string;
  variableDebtUsd: number;
  borrowApy: number;
  // Source of data
  dataSource: 'rpc' | 'subgraph';
  // Market reference
  market?: LendingMarket;
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
  positionsFound: number;
  accountDataFetched: boolean;
  error?: string;
  /** Step that failed, e.g. 'getUserReservesData', 'getReserveData(0x...)', 'getUserAccountData' */
  failedStep?: string;
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
  lowestHealthFactor: number | null;
  debugInfo: ChainDebugInfo[];
}

// ──────────────────────────────────────────────
// Helper: Ray math
// ──────────────────────────────────────────────

function rayMul(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  return (a * b + RAY / 2n) / RAY;
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
// Helper: safely extract bigint from named-or-positional return
// ──────────────────────────────────────────────

function extractBigInt(obj: any, name: string, index: number): bigint {
  const v = obj?.[name] ?? obj?.[index];
  if (v === undefined || v === null) return 0n;
  try { return BigInt(v); } catch { return 0n; }
}

// ──────────────────────────────────────────────
// Helper: parse getUserReservesData result
// The function can return:
//   - an array of structs directly (single return value)
//   - a tuple [array, uint8] (two return values)
// ──────────────────────────────────────────────

function parseUserReservesResult(result: unknown): any[] {
  if (!result) return [];
  if (Array.isArray(result)) {
    // Check if it's [UserReserveData[], uint8] tuple
    if (result.length === 2 && Array.isArray(result[0])) return result[0];
    // Or plain array of structs
    return result;
  }
  return [];
}

// ──────────────────────────────────────────────
// Subgraph fallback types + query
// ──────────────────────────────────────────────

interface SubgraphUserReserve {
  underlyingAssetAddress: string;
  symbol: string;
  decimals: number;
  currentATokenBalance: string;
  currentVariableDebt: string;
  usageAsCollateralEnabledOnUser: boolean;
}

interface SubgraphAccountSummary {
  totalCollateralUSD: number;
  totalDebtUSD: number;
  availableBorrowsUSD: number;
  healthFactor: number;
  ltv: number;
}

async function fetchPositionsFromSubgraph(
  subgraphUrl: string,
  userAddress: string,
): Promise<{ reserves: SubgraphUserReserve[]; account: SubgraphAccountSummary | null }> {
  if (!subgraphUrl) return { reserves: [], account: null };

  const query = `
    query UserPositions($user: String!) {
      userReserves(where: { user: $user }, first: 100) {
        reserve {
          underlyingAsset
          symbol
          decimals
        }
        currentATokenBalance
        currentVariableDebt
        usageAsCollateralEnabledOnUser
      }
      users(where: { id: $user }) {
        totalCollateralUSD
        totalDebtUSD
        availableBorrowsUSD
        healthFactor
      }
    }
  `;

  const resp = await fetch(subgraphUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { user: userAddress.toLowerCase() } }),
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) throw new Error(`Subgraph HTTP ${resp.status}`);
  const json = await resp.json();

  if (json.errors && DEBUG) {
    console.warn('[AavePositions] Subgraph errors:', json.errors);
  }

  const data = json.data || {};
  const rawReserves: any[] = data.userReserves || [];
  const rawUsers: any[] = data.users || [];

  const reserves: SubgraphUserReserve[] = rawReserves
    .filter((r: any) => {
      const supply = BigInt(r.currentATokenBalance || '0');
      const debt = BigInt(r.currentVariableDebt || '0');
      return supply > 0n || debt > 0n;
    })
    .map((r: any) => ({
      underlyingAssetAddress: r.reserve.underlyingAsset,
      symbol: r.reserve.symbol,
      decimals: Number(r.reserve.decimals),
      currentATokenBalance: r.currentATokenBalance || '0',
      currentVariableDebt: r.currentVariableDebt || '0',
      usageAsCollateralEnabledOnUser: r.usageAsCollateralEnabledOnUser || false,
    }));

  let account: SubgraphAccountSummary | null = null;
  if (rawUsers.length > 0) {
    const u = rawUsers[0];
    const collateral = parseFloat(u.totalCollateralUSD || '0');
    const debt = parseFloat(u.totalDebtUSD || '0');
    account = {
      totalCollateralUSD: collateral,
      totalDebtUSD: debt,
      availableBorrowsUSD: parseFloat(u.availableBorrowsUSD || '0'),
      healthFactor: parseFloat(u.healthFactor || '0'),
      ltv: collateral > 0 ? (debt / collateral) * 100 : 0,
    };
  }

  if (DEBUG) {
    console.log(`[AavePositions] Subgraph: ${reserves.length} positions, account:`, account);
  }

  return { reserves, account };
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

  const fetchPositions = useCallback(async () => {
    if (!address || !isConnected) {
      setPositions([]);
      setChainAccountData([]);
      setDebugInfo([]);
      return;
    }

    setLoading(true);
    setError(null);

    const allPositions: AavePosition[] = [];
    const allAccountData: AaveChainAccountData[] = [];
    const allDebugInfo: ChainDebugInfo[] = [];
    let anySuccess = false;

    // Build market lookup: "chainId-assetAddress(lower)" → LendingMarket
    const marketMap = new Map<string, LendingMarket>();
    for (const m of markets) {
      const normalizedMarketAddr = tryNormalizeAddress(m.assetAddress);
      if (normalizedMarketAddr) {
        marketMap.set(`${m.chainId}-${normalizedMarketAddr.toLowerCase()}`, m);
      }
    }

    // Process all chains in parallel; failures are isolated per-chain
    await Promise.allSettled(
      SUPPORTED_CHAINS.map(async (chainConfig) => {
        const { chainId, name, logo, rpcUrl, aaveSubgraph } = chainConfig;

        const aaveAddresses = getAaveAddresses(chainId);
        if (!aaveAddresses) return;

        const debugEntry: ChainDebugInfo = {
          chainId,
          chainName: name,
          dataSource: 'failed',
          positionsFound: 0,
          accountDataFetched: false,
        };

        const checksummedProvider = getAddress(aaveAddresses.POOL_ADDRESSES_PROVIDER);
        const checksummedUiProvider = getAddress(aaveAddresses.UI_POOL_DATA_PROVIDER);
        const checksummedPool = getAddress(aaveAddresses.POOL);

        let rpcSuccess = false;

        // ── Try RPC ──
        const client = createFallbackClient(chainId, rpcUrl);

        if (client) {
          debugEntry.rpcUsed = rpcUrl || 'public-fallback';

          try {
            // ── STEP 1: getUserReservesData ──
            // This is the FIRST call — no more getReservesData()
            let rawUserReserves: unknown;
            try {
              rawUserReserves = await (client.readContract as any)({
                address: checksummedUiProvider,
                abi: UI_POOL_USER_ABI,
                functionName: 'getUserReservesData',
                args: [checksummedProvider, address],
              });
            } catch (e) {
              const msg = `getUserReservesData failed (uiProvider=${checksummedUiProvider}): ${String(e)}`;
              debugEntry.failedStep = 'getUserReservesData';
              throw new Error(msg);
            }

            const userReserves = parseUserReservesResult(rawUserReserves);

            if (DEBUG) {
              console.log(`[AavePositions] ${name}: ${userReserves.length} user reserves from getUserReservesData`);
            }

            // ── STEP 2: getUserAccountData (in parallel with per-asset reads) ──
            let accountResult: unknown;
            try {
              accountResult = await (client.readContract as any)({
                address: checksummedPool,
                abi: POOL_ACCOUNT_ABI,
                functionName: 'getUserAccountData',
                args: [address],
              });
            } catch (e) {
              // Non-fatal — we still proceed with positions even if account data fails
              if (DEBUG) console.warn(`[AavePositions] ${name}: getUserAccountData failed:`, e);
              debugEntry.failedStep = (debugEntry.failedStep ? debugEntry.failedStep + ' | ' : '') + 'getUserAccountData';
            }

            // ── Parse account data ──
            if (accountResult) {
              const acct = accountResult as any;
              const totalCollateralBase  = extractBigInt(acct, 'totalCollateralBase', 0);
              const totalDebtBase        = extractBigInt(acct, 'totalDebtBase', 1);
              const availableBorrowsBase = extractBigInt(acct, 'availableBorrowsBase', 2);
              const currentLiqThreshold  = extractBigInt(acct, 'currentLiquidationThreshold', 3);
              const ltvRaw               = extractBigInt(acct, 'ltv', 4);
              const healthFactor         = extractBigInt(acct, 'healthFactor', 5);

              const totalCollateralUsd   = Number(totalCollateralBase) / 1e8;
              const totalDebtUsd         = Number(totalDebtBase) / 1e8;
              const availableBorrowsUsd  = Number(availableBorrowsBase) / 1e8;
              const hf                   = Number(healthFactor) / 1e18;

              // Always add account data if we got a valid response, even with 0 collateral
              // (so Borrow tab shows the right state)
              if (totalCollateralUsd > 0 || totalDebtUsd > 0) {
                allAccountData.push({
                  chainId,
                  chainName: name,
                  totalCollateralUsd,
                  totalDebtUsd,
                  availableBorrowsUsd,
                  healthFactor: hf,
                  ltv: Number(ltvRaw) / 100,
                  liquidationThreshold: Number(currentLiqThreshold) / 100,
                  dataSource: 'rpc',
                });
                debugEntry.accountDataFetched = true;
              }
            }

            // ── STEP 3: For each active user reserve, fetch getReserveData individually ──
            // This replaces the huge getReservesData call with targeted per-asset reads
            for (const ur of userReserves) {
              try {
                let scaledSupply: bigint;
                let scaledVariableDebt: bigint;
                let principalStableDebt: bigint;

                try {
                  scaledSupply       = BigInt(ur.scaledATokenBalance  ?? ur[1] ?? 0n);
                  scaledVariableDebt = BigInt(ur.scaledVariableDebt   ?? ur[4] ?? 0n);
                  principalStableDebt = BigInt(ur.principalStableDebt ?? ur[5] ?? 0n);
                } catch {
                  scaledSupply = 0n;
                  scaledVariableDebt = 0n;
                  principalStableDebt = 0n;
                }

                // Skip reserves with no balance at all
                if (scaledSupply === 0n && scaledVariableDebt === 0n && principalStableDebt === 0n) continue;

                // Normalize the asset address — handles Uint8Array / number[] from some RPC nodes
                const rawAsset = ur.underlyingAsset ?? ur[0];
                const normalizedAsset = tryNormalizeAddress(rawAsset);

                if (!normalizedAsset) {
                  if (DEBUG) {
                    console.warn(
                      `[AavePositions] ${name}: cannot normalize underlyingAsset`,
                      `type=${typeof rawAsset}`,
                      `isArray=${Array.isArray(rawAsset)}`,
                      `isUint8Array=${rawAsset instanceof Uint8Array}`,
                      `value="${String(rawAsset).slice(0, 50)}"`,
                    );
                  }
                  continue;
                }

                const assetAddr = normalizedAsset.toLowerCase();

                // ── Fetch reserve indexes for this specific asset ──
                let liquidityIndex      = RAY;   // default: 1 RAY (no interest accrual)
                let variableBorrowIndex = RAY;

                try {
                  const rd = await (client.readContract as any)({
                    address: checksummedPool,
                    abi: POOL_RESERVE_ABI,
                    functionName: 'getReserveData',
                    args: [normalizedAsset],
                  }) as any;

                  // getReserveData returns named tuple or positional array
                  // Positional: [configuration, liquidityIndex, currentLiquidityRate, variableBorrowIndex, ...]
                  const rawLi  = rd?.liquidityIndex      ?? rd?.[1];
                  const rawVbi = rd?.variableBorrowIndex ?? rd?.[3];

                  if (rawLi  !== undefined && rawLi  !== null) liquidityIndex      = BigInt(rawLi);
                  if (rawVbi !== undefined && rawVbi !== null) variableBorrowIndex = BigInt(rawVbi);

                  if (DEBUG) {
                    console.log(
                      `[AavePositions] ${name} ${normalizedAsset}: liquidityIndex=${liquidityIndex} variableBorrowIndex=${variableBorrowIndex}`,
                    );
                  }
                } catch (rdErr) {
                  // Non-fatal: use RAY as fallback (1:1, no interest)
                  if (DEBUG) {
                    console.warn(
                      `[AavePositions] ${name}: getReserveData(${normalizedAsset}) failed — using RAY fallback:`,
                      String(rdErr),
                    );
                    debugEntry.failedStep = (debugEntry.failedStep ? debugEntry.failedStep + ' | ' : '')
                      + `getReserveData(${normalizedAsset})`;
                  }
                }

                // ── Ray math: scaled → real ──
                const realSupply       = rayMul(scaledSupply, liquidityIndex);
                const realVariableDebt = rayMul(scaledVariableDebt, variableBorrowIndex);
                const realTotalDebt    = realVariableDebt + principalStableDebt;

                if (realSupply === 0n && realTotalDebt === 0n) continue;

                // Lookup market for metadata (symbol, decimals, price, APY)
                const market    = marketMap.get(`${chainId}-${assetAddr}`);
                const decimals  = market?.decimals ?? 18;
                const symbol    = market?.assetSymbol ?? 'UNKNOWN';
                const assetName = market?.assetName   ?? 'Unknown Token';

                let priceUsd = 0;
                if (market && market.priceUsd > 0) {
                  priceUsd = market.priceUsd;
                } else if (isStable(symbol)) {
                  priceUsd = 1;
                }

                const supplyFormatted = formatUnits(realSupply, decimals);
                const debtFormatted   = formatUnits(realTotalDebt, decimals);
                const supplyUsd       = parseFloat(supplyFormatted) * priceUsd;
                const debtUsd         = parseFloat(debtFormatted) * priceUsd;

                if (DEBUG) {
                  console.log(
                    `[AavePositions] ${name} ${symbol}:`,
                    `scaledSupply=${scaledSupply}`,
                    `liquidityIndex=${liquidityIndex}`,
                    `→ realSupply=${realSupply} (${supplyFormatted}) $${supplyUsd.toFixed(4)}`,
                    `normalizedAsset=${normalizedAsset}`,
                  );
                }

                allPositions.push({
                  chainId,
                  chainName: name,
                  chainLogo: logo,
                  assetAddress: normalizedAsset,
                  assetSymbol: symbol,
                  assetName,
                  assetLogo: market?.assetLogo ?? getTokenLogo(symbol),
                  decimals,
                  supplyBalance:          realSupply,
                  supplyBalanceFormatted: supplyFormatted,
                  supplyBalanceUsd:       supplyUsd,
                  supplyApy:              market?.supplyAPY ?? 0,
                  isCollateralEnabled:    Boolean(ur.usageAsCollateralEnabledOnUser ?? ur[2]),
                  variableDebt:          realTotalDebt,
                  variableDebtFormatted: debtFormatted,
                  variableDebtUsd:       debtUsd,
                  borrowApy:             market?.borrowAPY ?? 0,
                  dataSource:            'rpc',
                  market,
                });

                debugEntry.positionsFound++;
              } catch (reserveErr) {
                if (DEBUG) {
                  console.warn(`[AavePositions] ${name}: skipping reserve due to error:`, reserveErr);
                }
              }
            }

            anySuccess = true;
            rpcSuccess = true;
            debugEntry.dataSource = 'rpc';

          } catch (err) {
            console.error(`[AavePositions] RPC pipeline failed for ${name}:`, err);
            debugEntry.error = String(err);
            // Fall through to subgraph
          }
        }

        // ── Subgraph fallback ──
        if (!rpcSuccess && aaveSubgraph) {
          if (DEBUG) console.log(`[AavePositions] Falling back to subgraph for ${name}`);
          debugEntry.dataSource = 'subgraph';
          debugEntry.rpcUsed = 'SUBGRAPH';

          try {
            const { reserves, account } = await fetchPositionsFromSubgraph(aaveSubgraph, address);

            anySuccess = true;

            if (account && (account.totalCollateralUSD > 0 || account.totalDebtUSD > 0)) {
              allAccountData.push({
                chainId,
                chainName: name,
                totalCollateralUsd: account.totalCollateralUSD,
                totalDebtUsd: account.totalDebtUSD,
                availableBorrowsUsd: account.availableBorrowsUSD,
                healthFactor: account.healthFactor,
                ltv: account.ltv,
                dataSource: 'subgraph',
              });
              debugEntry.accountDataFetched = true;
            }

            for (const sr of reserves) {
              try {
                const normalizedSgAsset = tryNormalizeAddress(sr.underlyingAssetAddress);
                if (!normalizedSgAsset) {
                  if (DEBUG) console.warn(`[AavePositions][SUBGRAPH] ${name}: bad address`, sr.underlyingAssetAddress);
                  continue;
                }

                const assetAddr = normalizedSgAsset.toLowerCase();
                const market = marketMap.get(`${chainId}-${assetAddr}`);
                const decimals = sr.decimals || market?.decimals || 18;
                const symbol = market?.assetSymbol ?? sr.symbol ?? 'UNKNOWN';
                const assetName = market?.assetName ?? 'Unknown Token';

                // Subgraph returns real balances (not scaled)
                const realSupply    = BigInt(sr.currentATokenBalance);
                const realTotalDebt = BigInt(sr.currentVariableDebt);

                if (realSupply === 0n && realTotalDebt === 0n) continue;

                let priceUsd = 0;
                if (market && market.priceUsd > 0) {
                  priceUsd = market.priceUsd;
                } else if (isStable(symbol)) {
                  priceUsd = 1;
                }

                const supplyFormatted = formatUnits(realSupply, decimals);
                const debtFormatted   = formatUnits(realTotalDebt, decimals);
                const supplyUsd       = parseFloat(supplyFormatted) * priceUsd;
                const debtUsd         = parseFloat(debtFormatted) * priceUsd;

                if (DEBUG) {
                  console.log(
                    `[AavePositions][SUBGRAPH] ${name} ${symbol}: supply=${supplyFormatted} $${supplyUsd.toFixed(4)}`,
                  );
                }

                allPositions.push({
                  chainId,
                  chainName: name,
                  chainLogo: logo,
                  assetAddress: normalizedSgAsset,
                  assetSymbol: symbol,
                  assetName,
                  assetLogo: market?.assetLogo ?? getTokenLogo(symbol),
                  decimals,
                  supplyBalance:          realSupply,
                  supplyBalanceFormatted: supplyFormatted,
                  supplyBalanceUsd:       supplyUsd,
                  supplyApy:              market?.supplyAPY ?? 0,
                  isCollateralEnabled:    sr.usageAsCollateralEnabledOnUser,
                  variableDebt:          realTotalDebt,
                  variableDebtFormatted: debtFormatted,
                  variableDebtUsd:       debtUsd,
                  borrowApy:             market?.borrowAPY ?? 0,
                  dataSource:            'subgraph',
                  market,
                });

                debugEntry.positionsFound++;
              } catch (srErr) {
                if (DEBUG) console.warn(`[AavePositions][SUBGRAPH] ${name}: skipping reserve:`, srErr);
              }
            }
          } catch (sgErr) {
            console.error(`[AavePositions] Subgraph also failed for ${name}:`, sgErr);
            debugEntry.error = (debugEntry.error ? debugEntry.error + ' | ' : '') + String(sgErr);
            debugEntry.dataSource = 'failed';
          }
        }

        if (rpcSuccess) anySuccess = true;
        allDebugInfo.push(debugEntry);
      }),
    );

    setPositions(allPositions);
    setChainAccountData(allAccountData);
    setDebugInfo(allDebugInfo);
    setLoading(false);

    if (!anySuccess && allPositions.length === 0) {
      setError('Could not fetch positions. Check network and try again.');
    }
  }, [address, isConnected, markets]);

  useEffect(() => {
    if (markets.length > 0 || (isConnected && address)) {
      fetchPositions();
    }
  }, [fetchPositions, markets.length, isConnected, address]);

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
    lowestHealthFactor,
    debugInfo,
  };
}
