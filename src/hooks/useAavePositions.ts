/**
 * Aave V3 Positions Hook — v5 (NO UiPoolDataProvider at all)
 *
 * ARCHITECTURE:
 *   UiPoolDataProvider.getUserReservesData() and getReservesData() BOTH fail on
 *   multiple chains with ABI-decode errors ("Bytes value ... is not a valid boolean").
 *   We completely remove them.
 *
 *   New pipeline per chain:
 *   1. For each market asset in the DeFiLlama markets list:
 *        Pool.getReserveData(asset)  →  aTokenAddress, variableDebtTokenAddress
 *   2. aToken.balanceOf(user)             → real supply balance (no ray math needed)
 *      variableDebtToken.balanceOf(user)  → real variable debt (no ray math needed)
 *   3. Pool.getUserAccountData(user)      → HF / collateral / debt / available borrow
 *
 *   All calls use stable, simple ABIs — no large structs, no boolean alignment issues.
 *   Chain isolation: one chain failing does NOT fail others.
 *   Batching: all assets on a chain are fetched in parallel.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
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

/**
 * Pool.getReserveData — returns single reserve state.
 * We only need: aTokenAddress (index 7), variableDebtTokenAddress (index 9).
 * This function works reliably on all chains — no struct mismatch issues.
 */
const POOL_RESERVE_ABI = parseAbi([
  'function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint8 id)',
]);

/**
 * Pool.getUserAccountData — account-level health metrics.
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
    if (!address || !isConnected || markets.length === 0) {
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

    // Group markets by chainId for efficient per-chain processing
    const marketsByChain = new Map<number, LendingMarket[]>();
    for (const m of markets) {
      if (!marketsByChain.has(m.chainId)) marketsByChain.set(m.chainId, []);
      marketsByChain.get(m.chainId)!.push(m);
    }

    // Process all chains in parallel; failures are isolated per-chain
    await Promise.allSettled(
      SUPPORTED_CHAINS.map(async (chainConfig) => {
        const { chainId, name, logo, rpcUrl } = chainConfig;

        const aaveAddresses = getAaveAddresses(chainId);
        if (!aaveAddresses) return;

        const chainMarkets = marketsByChain.get(chainId) || [];
        if (chainMarkets.length === 0) return; // no markets to check on this chain

        const debugEntry: ChainDebugInfo = {
          chainId,
          chainName: name,
          dataSource: 'failed',
          positionsFound: 0,
          accountDataFetched: false,
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

          // ── STEP 1: getUserAccountData (parallel with asset discovery) ──
          // This uses a simple, proven ABI — no struct issues
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

          // ── STEP 2: For each market, get aToken + debtToken addresses ──
          // Pool.getReserveData is reliable — no UiPoolDataProvider needed
          const reserveDataResults = await Promise.allSettled(
            chainMarkets.map(async (market) => {
              let assetAddr: `0x${string}`;
              try {
                assetAddr = getAddress(market.assetAddress) as `0x${string}`;
              } catch {
                return null;
              }

              try {
                const rd = await (client.readContract as any)({
                  address: checksummedPool,
                  abi: POOL_RESERVE_ABI,
                  functionName: 'getReserveData',
                  args: [assetAddr],
                }) as any;

                const aTokenAddress = (rd?.aTokenAddress ?? rd?.[7] ?? null) as `0x${string}` | null;
                const varDebtTokenAddress = (rd?.variableDebtTokenAddress ?? rd?.[9] ?? null) as `0x${string}` | null;

                if (!aTokenAddress || aTokenAddress === '0x0000000000000000000000000000000000000000') {
                  return null; // asset not configured in pool
                }

                return { market, assetAddr, aTokenAddress, varDebtTokenAddress };
              } catch (e) {
                // Asset not in pool on this chain — skip silently
                return null;
              }
            })
          );

          // Collect valid reserve data
          const validReserves = reserveDataResults
            .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value !== null)
            .map(r => r.value);

          if (DEBUG) {
            console.log(`[AavePositions] ${name}: ${validReserves.length}/${chainMarkets.length} markets have reserve data`);
          }

          if (validReserves.length === 0) {
            debugEntry.dataSource = 'rpc';
            debugEntry.error = 'No valid reserve data found';
            allDebugInfo.push(debugEntry);
            const accountResult = await accountPromise;
            if (accountResult) {
              const ad = parseAccountData(accountResult, chainId, name);
              if (ad) allAccountData.push(ad);
            }
            return;
          }

          // ── STEP 3: For each valid reserve, call balanceOf(user) on aToken + debtToken ──
          // balanceOf returns the REAL balance (already index-adjusted by the token contract)
          // This is much simpler and more reliable than reading scaled balances + applying ray math
          const balanceResults = await Promise.allSettled(
            validReserves.map(async ({ market, assetAddr, aTokenAddress, varDebtTokenAddress }) => {
              const [supplyRaw, debtRaw] = await Promise.all([
                // aToken.balanceOf(user) = real supply balance
                (client.readContract as any)({
                  address: aTokenAddress,
                  abi: erc20Abi,
                  functionName: 'balanceOf',
                  args: [address],
                }).catch(() => 0n),

                // variableDebtToken.balanceOf(user) = real variable debt
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

              return { market, assetAddr, supplyBalance, variableDebt };
            })
          );

          // ── STEP 4: Build positions from balances ──
          for (const result of balanceResults) {
            if (result.status !== 'fulfilled') continue;
            const { market, assetAddr, supplyBalance, variableDebt } = result.value;

            // Skip if no balance
            if (supplyBalance === 0n && variableDebt === 0n) continue;

            const decimals = market.decimals || 18;
            const symbol = market.assetSymbol;
            let priceUsd = 0;
            if (market.priceUsd > 0) {
              priceUsd = market.priceUsd;
            } else if (isStable(symbol)) {
              priceUsd = 1;
            }

            const supplyFormatted = formatUnits(supplyBalance, decimals);
            const debtFormatted = formatUnits(variableDebt, decimals);
            const supplyBalanceUsd = parseFloat(supplyFormatted) * priceUsd;
            const variableDebtUsd = parseFloat(debtFormatted) * priceUsd;

            if (DEBUG) {
              console.log(
                `[AavePositions] ${name} ${symbol}:`,
                `supply=${supplyFormatted} ($${supplyBalanceUsd.toFixed(4)})`,
                `debt=${debtFormatted} ($${variableDebtUsd.toFixed(4)})`,
              );
            }

            allPositions.push({
              chainId,
              chainName: name,
              chainLogo: logo,
              assetAddress: assetAddr,
              assetSymbol: symbol,
              assetName: market.assetName,
              assetLogo: market.assetLogo || getTokenLogo(symbol),
              decimals,
              supplyBalance,
              supplyBalanceFormatted: supplyFormatted,
              supplyBalanceUsd,
              supplyApy: market.supplyAPY,
              isCollateralEnabled: market.collateralEnabled,
              variableDebt,
              variableDebtFormatted: debtFormatted,
              variableDebtUsd,
              borrowApy: market.borrowAPY,
              dataSource: 'rpc',
              market,
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

    setPositions(allPositions);
    setChainAccountData(allAccountData);
    setDebugInfo(allDebugInfo);
    setLoading(false);

    if (allPositions.length === 0 && isConnected) {
      if (DEBUG) console.log('[AavePositions] No positions found across all chains');
    }
  }, [address, isConnected, markets]);

  // Re-fetch whenever markets load or wallet changes
  useEffect(() => {
    if (markets.length > 0 && isConnected && address) {
      fetchPositions();
    } else if (!isConnected) {
      setPositions([]);
      setChainAccountData([]);
      setLoading(false);
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
