/**
 * Aave V3 Positions Hook
 * 
 * Fetches user supply & borrow positions across ALL supported chains.
 * Uses UiPoolDataProviderV3.getUserReservesData + Pool.getUserAccountData.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { createPublicClient, http, formatUnits, getAddress } from 'viem';
import { mainnet, arbitrum, optimism, polygon, base, avalanche } from 'viem/chains';
import { SUPPORTED_CHAINS, getChainConfig } from '@/lib/chainConfig';
import { getAaveAddresses } from '@/lib/aaveAddressBook';
import type { LendingMarket } from '@/hooks/useLendingMarkets';

// Viem chain objects
const VIEM_CHAINS: Record<number, any> = {
  1: mainnet, 42161: arbitrum, 10: optimism, 137: polygon, 8453: base, 43114: avalanche,
};

// ABIs
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

// Token logos
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
  return TOKEN_LOGOS[symbol.toUpperCase()] || 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
}

export interface AavePosition {
  chainId: number;
  chainName: string;
  chainLogo: string;
  assetAddress: `0x${string}`;
  assetSymbol: string;
  assetName: string;
  assetLogo: string;
  decimals: number;
  // Supply
  supplyBalance: bigint;
  supplyBalanceFormatted: string;
  supplyBalanceUsd: number;
  supplyApy: number;
  isCollateralEnabled: boolean;
  // Borrow
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

    // Build market lookup
    const marketMap = new Map<string, LendingMarket>();
    for (const m of markets) {
      marketMap.set(`${m.chainId}-${m.assetAddress.toLowerCase()}`, m);
    }

    // Fetch from all chains in parallel
    const promises = SUPPORTED_CHAINS.map(async (chainConfig) => {
      const { chainId, name, logo, rpcUrl } = chainConfig;
      if (!rpcUrl) return;

      const aaveAddresses = getAaveAddresses(chainId);
      if (!aaveAddresses) return;

      const viemChain = VIEM_CHAINS[chainId];
      if (!viemChain) return;

      try {
        const client = createPublicClient({
          chain: viemChain,
          transport: http(rpcUrl, { timeout: 12000 }),
        });

        const checksummedProvider = getAddress(aaveAddresses.POOL_ADDRESSES_PROVIDER);
        const checksummedUiProvider = getAddress(aaveAddresses.UI_POOL_DATA_PROVIDER);
        const checksummedPool = getAddress(aaveAddresses.POOL);

        // Fetch both in parallel
        const [userReservesResult, accountResult] = await Promise.all([
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

        // Parse account data
        const [totalCollateralBase, totalDebtBase, availableBorrowsBase, , ltv, healthFactor] = accountResult;
        const totalCollateralUsd = Number(totalCollateralBase) / 1e8;
        const totalDebtUsd = Number(totalDebtBase) / 1e8;

        if (totalCollateralUsd > 0 || totalDebtUsd > 0) {
          allAccountData.push({
            chainId,
            chainName: name,
            totalCollateralUsd,
            totalDebtUsd,
            availableBorrowsUsd: Number(availableBorrowsBase) / 1e8,
            healthFactor: Number(healthFactor) / 1e18,
            ltv: Number(ltv) / 10000,
          });
        }

        // Parse user reserves
        const [userReserves] = userReservesResult;
        for (const reserve of userReserves) {
          const supplyBalance = BigInt(reserve.scaledATokenBalance || 0);
          const variableDebt = BigInt(reserve.scaledVariableDebt || 0);
          const stableDebt = BigInt(reserve.principalStableDebt || 0);
          const totalDebt = variableDebt + stableDebt;

          if (supplyBalance > 0n || totalDebt > 0n) {
            const assetAddr = reserve.underlyingAsset.toLowerCase();
            const market = marketMap.get(`${chainId}-${assetAddr}`);
            const decimals = market?.decimals || 18;
            const symbol = market?.assetSymbol || '???';
            const assetName = market?.assetName || 'Unknown';

            // Approximate USD values using market price if available
            const supplyFormatted = formatUnits(supplyBalance, decimals);
            const debtFormatted = formatUnits(totalDebt, decimals);
            
            // Use TVL/available liquidity to estimate price (rough)
            let priceUsd = 0;
            if (market && market.tvl && market.availableLiquidity && market.availableLiquidity > 0) {
              // This is approximate - better to use oracle prices
              priceUsd = (market.tvl / market.availableLiquidity) || 1;
            }
            // For stablecoins, assume $1
            if (['USDC', 'USDT', 'DAI', 'USDC.E', 'USDCE', 'GHO', 'LUSD', 'FRAX'].includes(symbol.toUpperCase())) {
              priceUsd = 1;
            }

            const supplyUsd = parseFloat(supplyFormatted) * priceUsd;
            const debtUsd = parseFloat(debtFormatted) * priceUsd;

            allPositions.push({
              chainId,
              chainName: name,
              chainLogo: logo,
              assetAddress: reserve.underlyingAsset,
              assetSymbol: symbol,
              assetName: assetName,
              assetLogo: market?.assetLogo || getTokenLogo(symbol),
              decimals,
              supplyBalance,
              supplyBalanceFormatted: supplyFormatted,
              supplyBalanceUsd: supplyUsd,
              supplyApy: market?.supplyAPY || 0,
              isCollateralEnabled: reserve.usageAsCollateralEnabledOnUser,
              variableDebt: totalDebt,
              variableDebtFormatted: debtFormatted,
              variableDebtUsd: debtUsd,
              borrowApy: market?.borrowAPY || 0,
              market,
            });
          }
        }
      } catch (err) {
        console.error(`[AavePositions] Failed to fetch positions for ${name}:`, err);
      }
    });

    await Promise.all(promises);

    setPositions(allPositions);
    setChainAccountData(allAccountData);
    setLoading(false);
  }, [address, isConnected, markets]);

  useEffect(() => {
    if (markets.length > 0) {
      fetchPositions();
    }
  }, [fetchPositions, markets.length]);

  const totalSupplyUsd = useMemo(() => positions.reduce((acc, p) => acc + p.supplyBalanceUsd, 0), [positions]);
  const totalBorrowUsd = useMemo(() => positions.reduce((acc, p) => acc + p.variableDebtUsd, 0), [positions]);
  const totalCollateralUsd = useMemo(() => chainAccountData.reduce((acc, d) => acc + d.totalCollateralUsd, 0), [chainAccountData]);
  const lowestHealthFactor = useMemo(() => {
    const factors = chainAccountData.filter(d => d.totalDebtUsd > 0).map(d => d.healthFactor);
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
