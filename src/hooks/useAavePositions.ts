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
import { createPublicClient, http, fallback, formatUnits, getAddress } from 'viem';
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

const RESERVES_DATA_ABI = [
  {
    inputs: [
      { internalType: 'contract IPoolAddressesProvider', name: 'provider', type: 'address' },
    ],
    name: 'getReservesData',
    outputs: [
      {
        components: [
          { internalType: 'address', name: 'underlyingAsset', type: 'address' },
          { internalType: 'string', name: 'name', type: 'string' },
          { internalType: 'string', name: 'symbol', type: 'string' },
          { internalType: 'uint256', name: 'decimals', type: 'uint256' },
          { internalType: 'uint256', name: 'baseLTVasCollateral', type: 'uint256' },
          { internalType: 'uint256', name: 'reserveLiquidationThreshold', type: 'uint256' },
          { internalType: 'uint256', name: 'reserveLiquidationBonus', type: 'uint256' },
          { internalType: 'uint256', name: 'reserveFactor', type: 'uint256' },
          { internalType: 'bool', name: 'usageAsCollateralEnabled', type: 'bool' },
          { internalType: 'bool', name: 'borrowingEnabled', type: 'bool' },
          { internalType: 'bool', name: 'isActive', type: 'bool' },
          { internalType: 'bool', name: 'isFrozen', type: 'bool' },
          { internalType: 'uint128', name: 'liquidityIndex', type: 'uint128' },
          { internalType: 'uint128', name: 'variableBorrowIndex', type: 'uint128' },
          { internalType: 'uint128', name: 'liquidityRate', type: 'uint128' },
          { internalType: 'uint128', name: 'variableBorrowRate', type: 'uint128' },
          { internalType: 'uint40', name: 'lastUpdateTimestamp', type: 'uint40' },
          { internalType: 'address', name: 'aTokenAddress', type: 'address' },
          { internalType: 'address', name: 'variableDebtTokenAddress', type: 'address' },
          { internalType: 'address', name: 'interestRateStrategyAddress', type: 'address' },
          { internalType: 'uint256', name: 'availableLiquidity', type: 'uint256' },
          { internalType: 'uint256', name: 'totalScaledVariableDebt', type: 'uint256' },
          { internalType: 'uint256', name: 'priceInMarketReferenceCurrency', type: 'uint256' },
          { internalType: 'address', name: 'priceOracle', type: 'address' },
          { internalType: 'uint256', name: 'variableRateSlope1', type: 'uint256' },
          { internalType: 'uint256', name: 'variableRateSlope2', type: 'uint256' },
          { internalType: 'uint256', name: 'baseVariableBorrowRate', type: 'uint256' },
          { internalType: 'uint256', name: 'optimalUsageRatio', type: 'uint256' },
          { internalType: 'bool', name: 'isPaused', type: 'bool' },
          { internalType: 'bool', name: 'isSiloedBorrowing', type: 'bool' },
          { internalType: 'uint128', name: 'accruedToTreasury', type: 'uint128' },
          { internalType: 'uint128', name: 'unbacked', type: 'uint128' },
          { internalType: 'uint128', name: 'isolationModeTotalDebt', type: 'uint128' },
          { internalType: 'bool', name: 'flashLoanEnabled', type: 'bool' },
          { internalType: 'uint256', name: 'debtCeiling', type: 'uint256' },
          { internalType: 'uint256', name: 'debtCeilingDecimals', type: 'uint256' },
          { internalType: 'uint8', name: 'eModeCategoryId', type: 'uint8' },
          { internalType: 'uint256', name: 'borrowCap', type: 'uint256' },
          { internalType: 'uint256', name: 'supplyCap', type: 'uint256' },
          { internalType: 'bool', name: 'borrowableInIsolation', type: 'bool' },
          { internalType: 'bool', name: 'virtualAccActive', type: 'bool' },
          { internalType: 'uint128', name: 'virtualUnderlyingBalance', type: 'uint128' },
        ],
        internalType: 'struct IUiPoolDataProviderV3.AggregatedReserveData[]',
        name: '',
        type: 'tuple[]',
      },
      {
        components: [
          { internalType: 'uint256', name: 'marketReferenceCurrencyUnit', type: 'uint256' },
          { internalType: 'int256', name: 'marketReferenceCurrencyPriceInUsd', type: 'int256' },
          { internalType: 'int256', name: 'networkBaseTokenPriceInUsd', type: 'int256' },
          { internalType: 'uint8', name: 'networkBaseTokenPriceDecimals', type: 'uint8' },
        ],
        internalType: 'struct IUiPoolDataProviderV3.BaseCurrencyInfo',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const USER_RESERVES_ABI = [
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

const ACCOUNT_DATA_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getUserAccountData',
    outputs: [
      { internalType: 'uint256', name: 'totalCollateralBase', type: 'uint256' },
      { internalType: 'uint256', name: 'totalDebtBase', type: 'uint256' },
      { internalType: 'uint256', name: 'availableBorrowsBase', type: 'uint256' },
      { internalType: 'uint256', name: 'currentLiquidationThreshold', type: 'uint256' },
      { internalType: 'uint256', name: 'ltv', type: 'uint256' },
      { internalType: 'uint256', name: 'healthFactor', type: 'uint256' },
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
    const marketMap = new Map<string, LendingMarket>();
    for (const m of markets) {
      marketMap.set(`${m.chainId}-${m.assetAddress.toLowerCase()}`, m);
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

            // All three reads in parallel — viem handles retry/fallback internally
            const [reservesResult, userReservesResult, accountResult] = await Promise.all([
              (client.readContract as any)({
                address: checksummedUiProvider,
                abi: RESERVES_DATA_ABI,
                functionName: 'getReservesData',
                args: [checksummedProvider],
              }),
              (client.readContract as any)({
                address: checksummedUiProvider,
                abi: USER_RESERVES_ABI,
                functionName: 'getUserReservesData',
                args: [checksummedProvider, address],
              }),
              (client.readContract as any)({
                address: checksummedPool,
                abi: ACCOUNT_DATA_ABI,
                functionName: 'getUserAccountData',
                args: [address],
              }),
            ]);

            anySuccess = true;
            rpcSuccess = true;
            debugEntry.dataSource = 'rpc';

            // ── Build reserve index map ──
            const reservesList: any[] = reservesResult[0];

            if (DEBUG) {
              console.log(`[AavePositions] ${name}: ${reservesList.length} reserves fetched`);
            }

            interface ReserveIndex {
              liquidityIndex: bigint;
              variableBorrowIndex: bigint;
            }
            const reserveIndexMap = new Map<string, ReserveIndex>();
            for (const rd of reservesList) {
              reserveIndexMap.set(rd.underlyingAsset.toLowerCase(), {
                liquidityIndex: BigInt(rd.liquidityIndex),
                variableBorrowIndex: BigInt(rd.variableBorrowIndex),
              });
            }

            // ── Parse getUserAccountData ──
            const [
              totalCollateralBase,
              totalDebtBase,
              availableBorrowsBase,
              currentLiqThreshold,
              ltv,
              healthFactor,
            ] = accountResult;

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
            const [userReserves] = userReservesResult;

            if (DEBUG) {
              console.log(`[AavePositions] ${name}: ${userReserves.length} user reserves`);
            }

            for (const ur of userReserves) {
              const scaledSupply = BigInt(ur.scaledATokenBalance || 0n);
              const scaledVariableDebt = BigInt(ur.scaledVariableDebt || 0n);
              const principalStableDebt = BigInt(ur.principalStableDebt || 0n);

              if (scaledSupply === 0n && scaledVariableDebt === 0n && principalStableDebt === 0n) continue;

              const assetAddr = ur.underlyingAsset.toLowerCase() as string;
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
                );
              }

              allPositions.push({
                chainId,
                chainName: name,
                chainLogo: logo,
                assetAddress: ur.underlyingAsset as `0x${string}`,
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
              const assetAddr = sr.underlyingAssetAddress.toLowerCase();
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
                assetAddress: sr.underlyingAssetAddress as `0x${string}`,
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
