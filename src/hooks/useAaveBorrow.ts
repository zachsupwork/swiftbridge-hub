/**
 * Aave V3 Borrow Hook
 *
 * ARCHITECTURE — NO getReservesData:
 *   - Borrow markets come from useLendingMarkets (DeFi Llama).
 *   - Account health from Pool.getUserAccountData(user) per chain.
 *   - Reserve token addresses fetched on-demand via Pool.getReserveData(asset).
 *   - Borrow/repay transactions go directly to Pool.borrow / Pool.repay.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, useChainId, useWriteContract } from 'wagmi';
import {
  createPublicClient, http, parseUnits, formatUnits, getAddress, isAddress,
  erc20Abi, parseAbi, type Hash
} from 'viem';
import { calcPlatformFee, FEE_TREASURY, isTreasuryConfigured } from '@/lib/platformFee';
import { mainnet, arbitrum, optimism, polygon, base, avalanche } from 'viem/chains';
import { SUPPORTED_CHAINS, getChainConfig, getAavePoolAddress, getFallbackRpcs } from '@/lib/chainConfig';
import { getAaveAddresses } from '@/lib/aaveAddressBook';

// ============================================
// TYPES
// ============================================

export interface BorrowMarket {
  id: string;
  chainId: number;
  chainName: string;
  chainLogo: string;
  assetSymbol: string;
  assetName: string;
  assetAddress: `0x${string}`;
  assetLogo: string;
  decimals: number;
  variableBorrowAPY: number;
  stableBorrowAPY: number;
  stableBorrowEnabled: boolean;
  borrowingEnabled: boolean;
  availableLiquidity: number;
  availableLiquidityUsd: number;
  ltv: number;
  liquidationThreshold: number;
  liquidationBonus: number;
  priceInUsd: number;
  variableDebtTokenAddress: `0x${string}`;
  stableDebtTokenAddress: `0x${string}`;
}

export interface UserBorrowPosition {
  assetAddress: `0x${string}`;
  assetSymbol: string;
  assetName: string;
  assetLogo: string;
  chainId: number;
  chainName: string;
  currentVariableDebt: bigint;
  currentStableDebt: bigint;
  variableDebtFormatted: string;
  stableDebtFormatted: string;
  variableBorrowAPY: number;
  stableBorrowAPY: number;
  decimals: number;
  rateMode: 'variable' | 'stable';
}

export interface UserAccountData {
  totalCollateralBase: bigint;
  totalDebtBase: bigint;
  availableBorrowsBase: bigint;
  currentLiquidationThreshold: bigint;
  ltv: bigint;
  healthFactor: bigint;
  // Formatted
  totalCollateralUsd: number;
  totalDebtUsd: number;
  availableBorrowsUsd: number;
  healthFactorFormatted: number;
  borrowLimitUsedPercent: number;
}

export interface ChainBorrowStatus {
  chainId: number;
  chainName: string;
  status: 'ok' | 'error' | 'loading';
  error?: { message: string; contract?: string; functionName?: string };
  markets: BorrowMarket[];
  lastFetched?: number;
}

export type BorrowStep = 'idle' | 'approving' | 'borrowing' | 'repaying' | 'complete' | 'error';

// ============================================
// VIEM CHAINS
// ============================================

const VIEM_CHAINS: Record<number, any> = {
  1: mainnet, 42161: arbitrum, 10: optimism, 137: polygon, 8453: base, 43114: avalanche,
};

// ============================================
// ABIS — all via parseAbi, no getReservesData
// ============================================

const POOL_ACCOUNT_ABI = parseAbi([
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
]);

/** Pool.getReserveData — for fetching aToken / debtToken addresses on demand */
const POOL_RESERVE_DATA_ABI = parseAbi([
  'function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint8 id)',
]);

const POOL_BORROW_ABI = parseAbi([
  'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) nonpayable',
]);

const POOL_REPAY_ABI = parseAbi([
  'function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) nonpayable returns (uint256)',
]);

// ============================================
// HELPERS
// ============================================

function createClientForChain(chainId: number, primaryRpc?: string) {
  const viemChain = VIEM_CHAINS[chainId];
  if (!viemChain) return null;
  const rpcs = [primaryRpc, ...getFallbackRpcs(chainId)].filter(Boolean) as string[];
  if (rpcs.length === 0) return null;
  return createPublicClient({
    chain: viemChain,
    transport: http(rpcs[0], { timeout: 15_000 }),
  });
}

// ============================================
// MAIN HOOK
// ============================================

export interface UseAaveBorrowResult {
  chainStatuses: ChainBorrowStatus[];
  borrowMarkets: BorrowMarket[];
  userPositions: UserBorrowPosition[];
  accountData: UserAccountData | null;
  isLoading: boolean;
  isLoadingAccount: boolean;
  selectedChainId: number | undefined;
  setSelectedChainId: (chainId: number | undefined) => void;
  availableChains: { chainId: number; name: string; logo: string }[];
  refresh: () => void;
  retestChain: (chainId: number) => void;
  borrowStep: BorrowStep;
  borrowError: string | null;
  borrow: (market: BorrowMarket, amount: string, rateMode: 'variable' | 'stable') => Promise<void>;
  repayStep: BorrowStep;
  repayError: string | null;
  repay: (position: UserBorrowPosition, amount: string) => Promise<void>;
  resetBorrowState: () => void;
  resetRepayState: () => void;
  /** Fetch aToken/debtToken addresses for a specific asset via Pool.getReserveData */
  fetchReserveTokenAddresses: (chainId: number, assetAddress: `0x${string}`) => Promise<{
    aTokenAddress: `0x${string}`;
    variableDebtTokenAddress: `0x${string}`;
    stableDebtTokenAddress: `0x${string}`;
  } | null>;
}

export function useAaveBorrow(): UseAaveBorrowResult {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const { writeContractAsync } = useWriteContract();

  const [chainStatuses, setChainStatuses] = useState<ChainBorrowStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>(undefined);
  const [accountData, setAccountData] = useState<UserAccountData | null>(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const [userPositions] = useState<UserBorrowPosition[]>([]);

  const [borrowStep, setBorrowStep] = useState<BorrowStep>('idle');
  const [borrowError, setBorrowError] = useState<string | null>(null);
  const [repayStep, setRepayStep] = useState<BorrowStep>('idle');
  const [repayError, setRepayError] = useState<string | null>(null);

  // ── Fetch account data for selected chain via Pool.getUserAccountData ──
  const fetchUserAccountData = useCallback(async () => {
    if (!address || !isConnected || !selectedChainId) {
      setAccountData(null);
      return;
    }

    const chainConfig = SUPPORTED_CHAINS.find(c => c.chainId === selectedChainId);
    const aaveAddresses = getAaveAddresses(selectedChainId);
    if (!aaveAddresses || !chainConfig) return;

    const client = createClientForChain(selectedChainId, chainConfig.rpcUrl);
    if (!client) return;

    setIsLoadingAccount(true);
    try {
      const checksummedPool = getAddress(aaveAddresses.POOL);
      const result = await (client.readContract as any)({
        address: checksummedPool,
        abi: POOL_ACCOUNT_ABI,
        functionName: 'getUserAccountData',
        args: [address],
      });

      // parseAbi returns named fields
      const acct = result as any;
      const totalCollateralBase  = BigInt(acct.totalCollateralBase  ?? acct[0] ?? 0n);
      const totalDebtBase        = BigInt(acct.totalDebtBase        ?? acct[1] ?? 0n);
      const availableBorrowsBase = BigInt(acct.availableBorrowsBase ?? acct[2] ?? 0n);
      const currentLiqThreshold  = BigInt(acct.currentLiquidationThreshold ?? acct[3] ?? 0n);
      const ltv                  = BigInt(acct.ltv                  ?? acct[4] ?? 0n);
      const healthFactor         = BigInt(acct.healthFactor         ?? acct[5] ?? 0n);

      const totalCollateralUsd   = Number(totalCollateralBase) / 1e8;
      const totalDebtUsd         = Number(totalDebtBase) / 1e8;
      const availableBorrowsUsd  = Number(availableBorrowsBase) / 1e8;
      const healthFactorFormatted = Number(healthFactor) / 1e18;
      const maxBorrow = totalCollateralUsd * (Number(ltv) / 10000);
      const borrowLimitUsedPercent = maxBorrow > 0 ? (totalDebtUsd / maxBorrow) * 100 : 0;

      setAccountData({
        totalCollateralBase,
        totalDebtBase,
        availableBorrowsBase,
        currentLiquidationThreshold: currentLiqThreshold,
        ltv,
        healthFactor,
        totalCollateralUsd,
        totalDebtUsd,
        availableBorrowsUsd,
        healthFactorFormatted,
        borrowLimitUsedPercent,
      });
    } catch (err) {
      console.error('[Borrow] getUserAccountData failed:', err);
      setAccountData(null);
    } finally {
      setIsLoadingAccount(false);
    }
  }, [address, isConnected, selectedChainId]);

  useEffect(() => {
    fetchUserAccountData();
  }, [fetchUserAccountData]);

  // ── Fetch reserve token addresses on demand (aToken, debtTokens) ──
  const fetchReserveTokenAddresses = useCallback(async (
    chainId: number,
    assetAddress: `0x${string}`,
  ) => {
    const aaveAddresses = getAaveAddresses(chainId);
    if (!aaveAddresses) return null;
    const chainConfig = SUPPORTED_CHAINS.find(c => c.chainId === chainId);
    const client = createClientForChain(chainId, chainConfig?.rpcUrl);
    if (!client) return null;

    try {
      const checksummedPool = getAddress(aaveAddresses.POOL);
      const rd = await (client.readContract as any)({
        address: checksummedPool,
        abi: POOL_RESERVE_DATA_ABI,
        functionName: 'getReserveData',
        args: [assetAddress],
      }) as any;

      return {
        aTokenAddress: (rd.aTokenAddress ?? rd[7] ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
        variableDebtTokenAddress: (rd.variableDebtTokenAddress ?? rd[9] ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
        stableDebtTokenAddress: (rd.stableDebtTokenAddress ?? rd[8] ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
      };
    } catch (err) {
      console.warn(`[Borrow] getReserveData(${assetAddress}) on chain ${chainId} failed:`, err);
      return null;
    }
  }, []);

  // ── Borrow ──
  const borrow = useCallback(async (market: BorrowMarket, amount: string, rateMode: 'variable' | 'stable') => {
    if (!address) { setBorrowError('Wallet not connected'); return; }
    if (walletChainId !== market.chainId) { setBorrowError(`Please switch to ${market.chainName}`); return; }

    const poolAddress = getAavePoolAddress(market.chainId);
    if (!poolAddress) { setBorrowError('Pool address not found'); return; }

    setBorrowStep('borrowing');
    setBorrowError(null);

    try {
      const parsedAmount = parseUnits(amount, market.decimals);
      const interestRateMode = rateMode === 'variable' ? 2n : 1n;

      const txHash: Hash = await writeContractAsync({
        address: poolAddress,
        abi: POOL_BORROW_ABI,
        functionName: 'borrow',
        args: [market.assetAddress, parsedAmount, interestRateMode, 0, address],
      } as any);

      await new Promise(resolve => setTimeout(resolve, 3000));
      setBorrowStep('complete');
      console.log('[Borrow] Success:', txHash);
      await fetchUserAccountData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Borrow failed';
      setBorrowError(msg.includes('User rejected') || msg.includes('User denied') ? 'Transaction cancelled' : msg);
      setBorrowStep('error');
    }
  }, [address, walletChainId, writeContractAsync, fetchUserAccountData]);

  // ── Repay ──
  const repay = useCallback(async (position: UserBorrowPosition, amount: string) => {
    if (!address) { setRepayError('Wallet not connected'); return; }
    if (walletChainId !== position.chainId) { setRepayError(`Please switch to ${position.chainName}`); return; }

    const poolAddress = getAavePoolAddress(position.chainId);
    if (!poolAddress) { setRepayError('Pool address not found'); return; }

    setRepayStep('approving');
    setRepayError(null);

    try {
      const parsedAmount = parseUnits(amount, position.decimals);
      const interestRateMode = position.rateMode === 'variable' ? 2n : 1n;

      await writeContractAsync({
        address: position.assetAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [poolAddress, parsedAmount],
      } as any);

      setRepayStep('repaying');

      const txHash: Hash = await writeContractAsync({
        address: poolAddress,
        abi: POOL_REPAY_ABI,
        functionName: 'repay',
        args: [position.assetAddress, parsedAmount, interestRateMode, address],
      } as any);

      await new Promise(resolve => setTimeout(resolve, 3000));
      setRepayStep('complete');
      console.log('[Repay] Success:', txHash);
      await fetchUserAccountData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Repay failed';
      setRepayError(msg.includes('User rejected') || msg.includes('User denied') ? 'Transaction cancelled' : msg);
      setRepayStep('error');
    }
  }, [address, walletChainId, writeContractAsync, fetchUserAccountData]);

  // ── No-op chain fetch (markets come from useLendingMarkets now) ──
  const fetchAllChains = useCallback(async () => {
    setIsLoading(false);
    // Chain statuses populated from LendingMarkets — nothing to do here
  }, []);

  const retestChain = useCallback((_chainId: number) => {
    // No-op: markets are from DeFiLlama, no per-chain RPC needed
  }, []);

  const borrowMarkets = useMemo((): BorrowMarket[] => {
    return chainStatuses
      .filter(s => s.status === 'ok')
      .flatMap(s => s.markets);
  }, [chainStatuses]);

  const availableChains = useMemo(() => {
    return SUPPORTED_CHAINS.map(c => ({ chainId: c.chainId, name: c.name, logo: c.logo }));
  }, []);

  const resetBorrowState = useCallback(() => { setBorrowStep('idle'); setBorrowError(null); }, []);
  const resetRepayState  = useCallback(() => { setRepayStep('idle'); setRepayError(null); }, []);

  return {
    chainStatuses,
    borrowMarkets,
    userPositions,
    accountData,
    isLoading,
    isLoadingAccount,
    selectedChainId,
    setSelectedChainId,
    availableChains,
    refresh: fetchAllChains,
    retestChain,
    borrowStep,
    borrowError,
    borrow,
    repayStep,
    repayError,
    repay,
    resetBorrowState,
    resetRepayState,
    fetchReserveTokenAddresses,
  };
}
