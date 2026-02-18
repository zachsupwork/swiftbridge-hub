/**
 * Aave V3 Positions Hook
 *
 * CRITICAL FIX: Applies Ray math to convert scaled balances to real balances.
 *   realSupply = scaledATokenBalance * liquidityIndex / RAY
 *   realDebt   = scaledVariableDebt  * variableBorrowIndex / RAY
 *
 * Fetches:
 *  1. getReservesData  → reserve indexes + metadata
 *  2. getUserReservesData → user scaled balances + collateral flags
 *  3. getUserAccountData → health factor, LTV, available borrows
 *
 * USD pricing: uses market.priceUsd first, stablecoin $1 fallback.
 * RPC: retries with fallback list if primary fails.
 * Chain isolation: one chain failing does NOT fail others.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { createPublicClient, http, formatUnits, getAddress } from 'viem';
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

/**
 * getReservesData — fetches per-reserve liquidityIndex + variableBorrowIndex.
 * We only need a minimal ABI subset for the fields we actually use.
 */
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
}

// ──────────────────────────────────────────────
// Helper: create client with RPC fallback
// ──────────────────────────────────────────────

async function createClientWithFallback(
  chainId: number,
  primaryRpc: string | undefined,
): Promise<ReturnType<typeof createPublicClient> | null> {
  const viemChain = VIEM_CHAINS[chainId];
  if (!viemChain) return null;

  const candidates: string[] = [];
  if (primaryRpc) candidates.push(primaryRpc);
  candidates.push(...getFallbackRpcs(chainId));

  for (const rpc of candidates) {
    try {
      // Quick liveness check via raw fetch (avoids viem typing issues)
      const resp = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) {
        const data = await resp.json();
        const returnedChainId = parseInt(data?.result, 16);
        if (returnedChainId === chainId) {
          return createPublicClient({
            chain: viemChain,
            transport: http(rpc, { timeout: 15000 }),
          }) as ReturnType<typeof createPublicClient>;
        }
      }
    } catch {
      // try next
    }
  }
  return null;
}

// ──────────────────────────────────────────────
// Helper: Ray math
// ──────────────────────────────────────────────

function rayMul(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  return (a * b + RAY / 2n) / RAY;
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

  const fetchPositions = useCallback(async () => {
    if (!address || !isConnected) {
      setPositions([]);
      setChainAccountData([]);
      return;
    }

    setLoading(true);
    setError(null);

    const allPositions: AavePosition[] = [];
    const allAccountData: AaveChainAccountData[] = [];
    let anySuccess = false;

    // Build market lookup: chainId-assetAddress(lower) → LendingMarket
    const marketMap = new Map<string, LendingMarket>();
    for (const m of markets) {
      marketMap.set(`${m.chainId}-${m.assetAddress.toLowerCase()}`, m);
    }

    // Process all chains in parallel; failures are isolated per-chain
    await Promise.allSettled(
      SUPPORTED_CHAINS.map(async (chainConfig) => {
        const { chainId, name, logo, rpcUrl } = chainConfig;

        const aaveAddresses = getAaveAddresses(chainId);
        if (!aaveAddresses) return;

        // Create client with fallback RPC logic
        const client = await createClientWithFallback(chainId, rpcUrl);
        if (!client) {
          if (DEBUG) console.warn(`[AavePositions] No working RPC for ${name} (${chainId})`);
          return;
        }

        const checksummedProvider = getAddress(aaveAddresses.POOL_ADDRESSES_PROVIDER);
        const checksummedUiProvider = getAddress(aaveAddresses.UI_POOL_DATA_PROVIDER);
        const checksummedPool = getAddress(aaveAddresses.POOL);

        try {
          // Fetch all three in parallel
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

          // ── Build reserve index map ──
          // reservesResult[0] = AggregatedReserveData[]
          // reservesResult[1] = BaseCurrencyInfo
          const reservesList: any[] = reservesResult[0];

          interface ReserveIndex {
            liquidityIndex: bigint;
            variableBorrowIndex: bigint;
          }
          const reserveIndexMap = new Map<string, ReserveIndex>();

          if (DEBUG) {
            console.log(`[AavePositions] ${name}: fetched ${reservesList.length} reserves`);
          }

          for (const rd of reservesList) {
            const key = rd.underlyingAsset.toLowerCase();
            reserveIndexMap.set(key, {
              liquidityIndex: BigInt(rd.liquidityIndex),
              variableBorrowIndex: BigInt(rd.variableBorrowIndex),
            });
          }

          // ── Parse getUserAccountData ──
          const [
            totalCollateralBase,
            totalDebtBase,
            availableBorrowsBase,
            _currentLiqThreshold,
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
            });
          }

          // ── Parse getUserReservesData ──
          const [userReserves] = userReservesResult;

          if (DEBUG) {
            console.log(
              `[AavePositions] ${name}: fetched ${userReserves.length} user reserves`,
            );
          }

          for (const ur of userReserves) {
            const scaledSupply = BigInt(ur.scaledATokenBalance || 0n);
            const scaledVariableDebt = BigInt(ur.scaledVariableDebt || 0n);
            const principalStableDebt = BigInt(ur.principalStableDebt || 0n);

            // Skip reserves with no position at all
            if (scaledSupply === 0n && scaledVariableDebt === 0n && principalStableDebt === 0n) {
              continue;
            }

            const assetAddr = ur.underlyingAsset.toLowerCase() as string;
            const indexes = reserveIndexMap.get(assetAddr);

            // ── Ray math: convert scaled → real ──
            // Use index from getReservesData; if unavailable fall back to 1 RAY (no-op)
            const liquidityIndex = indexes?.liquidityIndex ?? RAY;
            const variableBorrowIndex = indexes?.variableBorrowIndex ?? RAY;

            const realSupply = rayMul(scaledSupply, liquidityIndex);
            const realVariableDebt = rayMul(scaledVariableDebt, variableBorrowIndex);
            const realTotalDebt = realVariableDebt + principalStableDebt;

            // Skip if real balances round to zero
            if (realSupply === 0n && realTotalDebt === 0n) continue;

            // Market metadata
            const market = marketMap.get(`${chainId}-${assetAddr}`);
            const decimals = market?.decimals ?? 18;
            const symbol = market?.assetSymbol ?? '???';
            const assetName = market?.assetName ?? 'Unknown';

            // ── USD pricing ──
            // Priority: market.priceUsd → stablecoin heuristic → 0
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
                `[AavePositions] ${name} ${symbol}: scaledSupply=${scaledSupply} liqIdx=${liquidityIndex} → realSupply=${realSupply} (${supplyFormatted}) $${supplyUsd.toFixed(4)}`,
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
              // Supply
              supplyBalance: realSupply,
              supplyBalanceFormatted: supplyFormatted,
              supplyBalanceUsd: supplyUsd,
              supplyApy: market?.supplyAPY ?? 0,
              isCollateralEnabled: ur.usageAsCollateralEnabledOnUser,
              // Borrow
              variableDebt: realTotalDebt,
              variableDebtFormatted: debtFormatted,
              variableDebtUsd: debtUsd,
              borrowApy: market?.borrowAPY ?? 0,
              market,
            });
          }
        } catch (err) {
          console.error(`[AavePositions] Failed for ${name} (${chainId}):`, err);
          // Continue — don't fail entire hook
        }
      }),
    );

    setPositions(allPositions);
    setChainAccountData(allAccountData);
    setLoading(false);

    if (!anySuccess && allPositions.length === 0) {
      setError('Could not connect to any RPC endpoint.');
    }
  }, [address, isConnected, markets]);

  useEffect(() => {
    if (markets.length > 0) {
      fetchPositions();
    }
  }, [fetchPositions, markets.length]);

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
  };
}
