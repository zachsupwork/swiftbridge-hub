/**
 * Aave V3 Positions Hook
 *
 * CORS FIX:
 *   Uses viem's `fallback()` transport which tries multiple RPC endpoints
 *   automatically. Viem's transport layer uses the browser's native fetch
 *   with proper JSON-RPC content-type, which public nodes whitelist for CORS.
 *   
 *   Critically: NO preflight probe (no getBlockNumber() before reading).
 *   We go straight to the data reads with a timeout. If one RPC fails,
 *   viem's fallback transport automatically tries the next one.
 *
 * Subgraph fallback (FIXED):
 *   Removed the broken `or:` GraphQL filter. Now fetches all userReserves
 *   and filters client-side. Works on all Graph nodes.
 *
 * Balance math:
 *   realSupply      = scaledATokenBalance * liquidityIndex / RAY
 *   realVariableDebt = scaledVariableDebt  * variableBorrowIndex / RAY
 *
 * USD pricing: market.priceUsd → stablecoin $1 fallback → 0
 * Chain isolation: one chain failing does NOT fail others.
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
// ABIs
// ──────────────────────────────────────────────

// Use parseAbi for strongly-typed, correctly-encoded ABIs.
// This avoids viem mis-encoding struct fields as bytes arrays when using hand-written objects.
const UI_POOL_ABI = parseAbi([
  'function getReservesData(address provider) view returns ((address underlyingAsset, string name, string symbol, uint256 decimals, uint256 baseLTVasCollateral, uint256 reserveLiquidationThreshold, uint256 reserveLiquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool isActive, bool isFrozen, uint128 liquidityIndex, uint128 variableBorrowIndex, uint128 liquidityRate, uint128 variableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint256 availableLiquidity, uint256 totalScaledVariableDebt, uint256 priceInMarketReferenceCurrency, address priceOracle, uint256 variableRateSlope1, uint256 variableRateSlope2, uint256 baseVariableBorrowRate, uint256 optimalUsageRatio, bool isPaused, bool isSiloedBorrowing, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt, bool flashLoanEnabled, uint256 debtCeiling, uint256 debtCeilingDecimals, uint8 eModeCategoryId, uint256 borrowCap, uint256 supplyCap, bool borrowableInIsolation, bool virtualAccActive, uint128 virtualUnderlyingBalance)[], (uint256 marketReferenceCurrencyUnit, int256 marketReferenceCurrencyPriceInUsd, int256 networkBaseTokenPriceInUsd, uint8 networkBaseTokenPriceDecimals))',
]);

const UI_POOL_USER_ABI = parseAbi([
  'function getUserReservesData(address provider, address user) view returns ((address underlyingAsset, uint256 scaledATokenBalance, bool usageAsCollateralEnabledOnUser, uint256 stableBorrowRate, uint256 scaledVariableDebt, uint256 principalStableDebt, uint256 stableBorrowLastUpdateTimestamp)[], uint8)',
]);

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
//
// Uses viem's built-in fallback() transport which:
// - Tries each RPC in order
// - Automatically retries on failure
// - Uses native fetch (CORS-whitelisted for most public nodes)
// - NO custom preflight probe that could trigger CORS errors
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

  // Deduplicate
  const unique = [...new Set(rpcs)];
  if (unique.length === 0) return null;

  const transports = unique.map(rpc =>
    http(rpc, { timeout: 15_000, retryCount: 0 })
  );

  return createPublicClient({
    chain: viemChain,
    // fallback() tries each transport in order on failure
    transport: transports.length === 1
      ? transports[0]
      : fallback(transports, { rank: false }),
  }) as ReturnType<typeof createPublicClient>;
}

// ──────────────────────────────────────────────
// Subgraph fallback types
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

// ──────────────────────────────────────────────
// Subgraph query (FIXED — no `or:` filter)
//
// The previous query used `or: [{ currentATokenBalance_gt: "0" }, ...]`
// which fails on many Graph nodes. Now we fetch ALL reserves for the user
// and filter client-side.
// ──────────────────────────────────────────────

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

  // Filter client-side: keep only non-zero positions
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

    // Build market lookup: chainId-assetAddress(lower) → LendingMarket
    // Normalize market addresses defensively to ensure consistent keys
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

        // ── Try RPC (via viem fallback transport, no CORS-breaking preflight) ──
        const client = createFallbackClient(chainId, rpcUrl);

        if (client) {
          debugEntry.rpcUsed = rpcUrl || 'public-fallback';

          try {
            if (DEBUG) console.log(`[AavePositions] Reading data for ${name} via viem fallback transport`);

            // Run three calls in parallel, but label each so errors identify which call failed
            let reservesResult: any;
            let userReservesResult: any;
            let accountResult: any;

            try {
              reservesResult = await (client.readContract as any)({
                address: checksummedUiProvider,
                abi: UI_POOL_ABI,
                functionName: 'getReservesData',
                args: [checksummedProvider],
              });
            } catch (e) {
              throw new Error(`getReservesData failed on ${name} (uiProvider=${checksummedUiProvider}): ${String(e)}`);
            }

            try {
              userReservesResult = await (client.readContract as any)({
                address: checksummedUiProvider,
                abi: UI_POOL_USER_ABI,
                functionName: 'getUserReservesData',
                args: [checksummedProvider, address],
              });
            } catch (e) {
              throw new Error(`getUserReservesData failed on ${name} (uiProvider=${checksummedUiProvider}): ${String(e)}`);
            }

            try {
              accountResult = await (client.readContract as any)({
                address: checksummedPool,
                abi: POOL_ACCOUNT_ABI,
                functionName: 'getUserAccountData',
                args: [address],
              });
            } catch (e) {
              throw new Error(`getUserAccountData failed on ${name} (pool=${checksummedPool}): ${String(e)}`);
            }

            anySuccess = true;
            rpcSuccess = true;
            debugEntry.dataSource = 'rpc';

            // ── Build reserve index map ──
            // getReservesData returns [reservesArray, baseCurrencyInfo]
            const reservesList: any[] = Array.isArray(reservesResult) ? reservesResult[0] : [];

            if (DEBUG) {
              console.log(`[AavePositions] ${name}: ${reservesList.length} reserves fetched`);
            }

            interface ReserveIndex {
              liquidityIndex: bigint;
              variableBorrowIndex: bigint;
            }
            const reserveIndexMap = new Map<string, ReserveIndex>();
            for (const rd of reservesList) {
              // CRITICAL: normalize address — viem may return Uint8Array or number[]
              const normalizedAsset = tryNormalizeAddress(rd.underlyingAsset);
              if (!normalizedAsset) {
                if (DEBUG) console.warn(`[AavePositions] ${name}: could not normalize reserve asset`, typeof rd.underlyingAsset, rd.underlyingAsset);
                continue;
              }
              reserveIndexMap.set(normalizedAsset.toLowerCase(), {
                liquidityIndex: BigInt(rd.liquidityIndex),
                variableBorrowIndex: BigInt(rd.variableBorrowIndex),
              });
            }

            if (DEBUG) {
              console.log(`[AavePositions] ${name}: reserveIndexMap has ${reserveIndexMap.size} entries`);
            }

            // ── Parse getUserAccountData ──
            // parseAbi with named return values → viem returns a plain object with named keys
            // Handle both object (named) and array (positional) return shapes defensively
            const acct = accountResult as any;
            const totalCollateralBase = acct.totalCollateralBase ?? acct[0] ?? 0n;
            const totalDebtBase       = acct.totalDebtBase       ?? acct[1] ?? 0n;
            const availableBorrowsBase = acct.availableBorrowsBase ?? acct[2] ?? 0n;
            const currentLiqThreshold  = acct.currentLiquidationThreshold ?? acct[3] ?? 0n;
            const ltv                  = acct.ltv                ?? acct[4] ?? 0n;
            const healthFactor         = acct.healthFactor       ?? acct[5] ?? 0n;

            // Aave V3 base currency is USD with 8 decimals
            const totalCollateralUsd = Number(totalCollateralBase) / 1e8;
            const totalDebtUsd = Number(totalDebtBase) / 1e8;
            const availableBorrowsUsd = Number(availableBorrowsBase) / 1e8;
            const hf = Number(healthFactor) / 1e18;

            if (totalCollateralUsd > 0 || totalDebtUsd > 0) {
              allAccountData.push({
                chainId,
                chainName: name,
                totalCollateralUsd,
                totalDebtUsd,
                availableBorrowsUsd,
                healthFactor: hf,
                ltv: Number(ltv) / 100,
                liquidationThreshold: Number(currentLiqThreshold) / 100,
                dataSource: 'rpc',
              });
              debugEntry.accountDataFetched = true;
            }

            // ── Parse getUserReservesData ──
            // getUserReservesData returns [userReservesArray, eModeCategoryId]
            const userReserves: any[] = Array.isArray(userReservesResult) ? userReservesResult[0] : [];

            if (DEBUG) {
              console.log(`[AavePositions] ${name}: ${userReserves.length} user reserves`);
            }

            for (const ur of userReserves) {
              // Per-reserve try/catch: one bad asset must not crash the whole chain
              try {
                const scaledSupply = BigInt(ur.scaledATokenBalance || 0n);
                const scaledVariableDebt = BigInt(ur.scaledVariableDebt || 0n);
                const principalStableDebt = BigInt(ur.principalStableDebt || 0n);

                if (scaledSupply === 0n && scaledVariableDebt === 0n && principalStableDebt === 0n) continue;

                // Normalize address — core fix for Bytes value error
                const normalizedAsset = tryNormalizeAddress(ur.underlyingAsset);
                if (!normalizedAsset) {
                  if (DEBUG) {
                    console.warn(
                      `[AavePositions] ${name}: could not normalize user reserve asset`,
                      `type=${typeof ur.underlyingAsset}`,
                      `isArray=${Array.isArray(ur.underlyingAsset)}`,
                      `isUint8Array=${ur.underlyingAsset instanceof Uint8Array}`,
                      `value=${String(ur.underlyingAsset).slice(0, 40)}`,
                    );
                  }
                  continue;
                }

                const assetAddr = normalizedAsset.toLowerCase();
                const indexes = reserveIndexMap.get(assetAddr);

                const liquidityIndex = indexes?.liquidityIndex ?? RAY;
                const variableBorrowIndex = indexes?.variableBorrowIndex ?? RAY;

                // Ray math: scaled → real
                const realSupply = rayMul(scaledSupply, liquidityIndex);
                const realVariableDebt = rayMul(scaledVariableDebt, variableBorrowIndex);
                const realTotalDebt = realVariableDebt + principalStableDebt;

                if (realSupply === 0n && realTotalDebt === 0n) continue;

                const market = marketMap.get(`${chainId}-${assetAddr}`);
                const decimals = market?.decimals ?? 18;
                const symbol = market?.assetSymbol ?? '???';
                const assetName = market?.assetName ?? 'Unknown';

                let priceUsd = 0;
                if (market && market.priceUsd > 0) {
                  priceUsd = market.priceUsd;
                } else if (isStable(symbol)) {
                  priceUsd = 1;
                }

                const supplyFormatted = formatUnits(realSupply, decimals);
                const debtFormatted = formatUnits(realTotalDebt, decimals);
                const supplyUsd = parseFloat(supplyFormatted) * priceUsd;
                const debtUsd = parseFloat(debtFormatted) * priceUsd;

                if (DEBUG) {
                  console.log(
                    `[AavePositions] ${name} ${symbol}: scaled=${scaledSupply} idx=${liquidityIndex} → real=${realSupply} (${supplyFormatted}) $${supplyUsd.toFixed(4)}`,
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
                  supplyBalance: realSupply,
                  supplyBalanceFormatted: supplyFormatted,
                  supplyBalanceUsd: supplyUsd,
                  supplyApy: market?.supplyAPY ?? 0,
                  isCollateralEnabled: ur.usageAsCollateralEnabledOnUser,
                  variableDebt: realTotalDebt,
                  variableDebtFormatted: debtFormatted,
                  variableDebtUsd: debtUsd,
                  borrowApy: market?.borrowAPY ?? 0,
                  dataSource: 'rpc',
                  market,
                });

                debugEntry.positionsFound++;
              } catch (reserveErr) {
                if (DEBUG) {
                  console.warn(`[AavePositions] ${name}: skipping reserve due to error:`, reserveErr);
                }
                // Continue to next reserve — don't crash the chain
              }
            }
          } catch (err) {
            console.error(`[AavePositions] RPC reads failed for ${name}:`, err);
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
                // Normalize subgraph address (usually already 0x string, but be safe)
                const normalizedSgAsset = tryNormalizeAddress(sr.underlyingAssetAddress);
                if (!normalizedSgAsset) {
                  if (DEBUG) console.warn(`[AavePositions][SUBGRAPH] ${name}: bad address`, sr.underlyingAssetAddress);
                  continue;
                }

                const assetAddr = normalizedSgAsset.toLowerCase();
                const market = marketMap.get(`${chainId}-${assetAddr}`);
                const decimals = sr.decimals || market?.decimals || 18;
                const symbol = market?.assetSymbol ?? sr.symbol ?? '???';
                const assetName = market?.assetName ?? 'Unknown';

              // Subgraph returns real balances (not scaled)
              const realSupply = BigInt(sr.currentATokenBalance);
              const realTotalDebt = BigInt(sr.currentVariableDebt);

              if (realSupply === 0n && realTotalDebt === 0n) continue;

              let priceUsd = 0;
              if (market && market.priceUsd > 0) {
                priceUsd = market.priceUsd;
              } else if (isStable(symbol)) {
                priceUsd = 1;
              }

              const supplyFormatted = formatUnits(realSupply, decimals);
              const debtFormatted = formatUnits(realTotalDebt, decimals);
              const supplyUsd = parseFloat(supplyFormatted) * priceUsd;
              const debtUsd = parseFloat(debtFormatted) * priceUsd;

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
                supplyBalance: realSupply,
                supplyBalanceFormatted: supplyFormatted,
                supplyBalanceUsd: supplyUsd,
                supplyApy: market?.supplyAPY ?? 0,
                isCollateralEnabled: sr.usageAsCollateralEnabledOnUser,
                variableDebt: realTotalDebt,
                variableDebtFormatted: debtFormatted,
                variableDebtUsd: debtUsd,
                borrowApy: market?.borrowAPY ?? 0,
                dataSource: 'subgraph',
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
