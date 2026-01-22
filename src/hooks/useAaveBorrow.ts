/**
 * Aave V3 Borrow Hook
 * 
 * Fetches user account data and handles borrow/repay transactions.
 * Uses UiPoolDataProviderV3 for user reserves and account data.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, useChainId, useWriteContract, useReadContract } from 'wagmi';
import { createPublicClient, http, parseUnits, formatUnits, getAddress, isAddress, erc20Abi, type Hash } from 'viem';
import { mainnet, arbitrum, optimism, polygon, base, avalanche } from 'viem/chains';
import { SUPPORTED_CHAINS, getChainConfig, getAavePoolAddress } from '@/lib/chainConfig';
import { AAVE_V3_ADDRESSES, getAaveAddresses } from '@/lib/aaveAddressBook';
import { logEarnEvent } from '@/lib/earnLogger';

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
  ltv: number; // Loan-to-Value ratio
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
  error?: {
    message: string;
    contract?: string;
    functionName?: string;
    rpcMasked?: string;
  };
  markets: BorrowMarket[];
  lastFetched?: number;
}

export type BorrowStep = 'idle' | 'approving' | 'borrowing' | 'repaying' | 'complete' | 'error';

// ============================================
// VIEM CHAINS
// ============================================

const VIEM_CHAINS: Record<number, typeof mainnet | typeof arbitrum | typeof optimism | typeof polygon | typeof base | typeof avalanche> = {
  1: mainnet,
  42161: arbitrum,
  10: optimism,
  137: polygon,
  8453: base,
  43114: avalanche,
};

// ============================================
// ABIS
// ============================================

// UiPoolDataProviderV3 - getUserReservesData
const UI_POOL_DATA_PROVIDER_USER_ABI = [
  {
    inputs: [
      { internalType: 'contract IPoolAddressesProvider', name: 'provider', type: 'address' },
      { internalType: 'address', name: 'user', type: 'address' }
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

// Pool - getUserAccountData
const POOL_USER_ACCOUNT_ABI = [
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

// Pool - borrow
const POOL_BORROW_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'asset', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint256', name: 'interestRateMode', type: 'uint256' },
      { internalType: 'uint16', name: 'referralCode', type: 'uint16' },
      { internalType: 'address', name: 'onBehalfOf', type: 'address' },
    ],
    name: 'borrow',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Pool - repay
const POOL_REPAY_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'asset', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint256', name: 'interestRateMode', type: 'uint256' },
      { internalType: 'address', name: 'onBehalfOf', type: 'address' },
    ],
    name: 'repay',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
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
};

function getTokenLogo(symbol: string): string {
  const upperSymbol = symbol.toUpperCase().replace('.', '');
  return TOKEN_LOGOS[upperSymbol] || 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';
}

// Mask RPC URL for security
function maskRpcUrl(url: string | undefined): string {
  if (!url) return 'N/A';
  return url.substring(0, 12) + '…';
}

// ============================================
// MAIN HOOK
// ============================================

export interface UseAaveBorrowResult {
  // Chain statuses for all chains
  chainStatuses: ChainBorrowStatus[];
  // All borrow markets from successful chains
  borrowMarkets: BorrowMarket[];
  // User's borrow positions
  userPositions: UserBorrowPosition[];
  // User account data for selected chain
  accountData: UserAccountData | null;
  // Loading states
  isLoading: boolean;
  isLoadingAccount: boolean;
  // Selected chain for borrow
  selectedChainId: number | undefined;
  setSelectedChainId: (chainId: number | undefined) => void;
  // Available chains (chains with ok status)
  availableChains: { chainId: number; name: string; logo: string }[];
  // Actions
  refresh: () => void;
  retestChain: (chainId: number) => void;
  // Borrow transaction
  borrowStep: BorrowStep;
  borrowError: string | null;
  borrow: (market: BorrowMarket, amount: string, rateMode: 'variable' | 'stable') => Promise<void>;
  // Repay transaction
  repayStep: BorrowStep;
  repayError: string | null;
  repay: (position: UserBorrowPosition, amount: string) => Promise<void>;
  // Reset states
  resetBorrowState: () => void;
  resetRepayState: () => void;
}

export function useAaveBorrow(): UseAaveBorrowResult {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const { writeContractAsync } = useWriteContract();

  // State
  const [chainStatuses, setChainStatuses] = useState<ChainBorrowStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>(undefined);
  const [accountData, setAccountData] = useState<UserAccountData | null>(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const [userPositions, setUserPositions] = useState<UserBorrowPosition[]>([]);

  // Transaction states
  const [borrowStep, setBorrowStep] = useState<BorrowStep>('idle');
  const [borrowError, setBorrowError] = useState<string | null>(null);
  const [repayStep, setRepayStep] = useState<BorrowStep>('idle');
  const [repayError, setRepayError] = useState<string | null>(null);

  // Fetch borrow markets for a single chain
  const fetchChainMarkets = useCallback(async (chainConfig: typeof SUPPORTED_CHAINS[0]): Promise<ChainBorrowStatus> => {
    const { chainId, name, rpcUrl, logo, rpcEnvKey } = chainConfig;

    // Initial status
    const status: ChainBorrowStatus = {
      chainId,
      chainName: name,
      status: 'loading',
      markets: [],
    };

    // Validate RPC
    if (!rpcUrl) {
      return {
        ...status,
        status: 'error',
        error: {
          message: `Missing RPC: ${rpcEnvKey}`,
          rpcMasked: 'N/A',
        },
      };
    }

    // Get Aave addresses
    const aaveAddresses = getAaveAddresses(chainId);
    if (!aaveAddresses) {
      return {
        ...status,
        status: 'error',
        error: {
          message: 'Aave V3 not configured for this chain',
        },
      };
    }

    // Validate addresses
    try {
      if (!isAddress(aaveAddresses.POOL_ADDRESSES_PROVIDER) || 
          !isAddress(aaveAddresses.UI_POOL_DATA_PROVIDER) ||
          !isAddress(aaveAddresses.POOL)) {
        throw new Error('Invalid address format');
      }
    } catch (e) {
      return {
        ...status,
        status: 'error',
        error: {
          message: 'Invalid Aave contract address format',
          contract: 'Address validation',
        },
      };
    }

    // Checksum addresses
    const checksummedProvider = getAddress(aaveAddresses.POOL_ADDRESSES_PROVIDER);
    const checksummedUiProvider = getAddress(aaveAddresses.UI_POOL_DATA_PROVIDER);
    const checksummedPool = getAddress(aaveAddresses.POOL);

    const viemChain = VIEM_CHAINS[chainId];
    if (!viemChain) {
      return {
        ...status,
        status: 'error',
        error: {
          message: 'Chain not configured in viem',
        },
      };
    }

    // Create client
    const client = createPublicClient({
      chain: viemChain,
      transport: http(rpcUrl),
    });

    try {
      // Import the ABI from aaveAddressBook
      const { UI_POOL_DATA_PROVIDER_ABI } = await import('@/lib/aaveAddressBook');

      // Fetch reserves data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (client.readContract as any)({
        address: checksummedUiProvider,
        abi: UI_POOL_DATA_PROVIDER_ABI,
        functionName: 'getReservesData',
        args: [checksummedProvider],
      });

      const [reserves, baseCurrencyInfo] = result;

      if (!reserves || reserves.length === 0) {
        return {
          ...status,
          status: 'error',
          error: {
            message: 'No reserves returned from getReservesData',
            contract: checksummedUiProvider,
            functionName: 'getReservesData',
          },
        };
      }

      // Convert reserves to borrow markets
      const markets: BorrowMarket[] = reserves
        .filter((r: any) => r.isActive && !r.isFrozen && !r.isPaused && r.borrowingEnabled)
        .map((r: any) => {
          const decimals = Number(r.decimals);
          const variableBorrowRate = Number(r.variableBorrowRate);
          const stableBorrowRate = Number(r.stableBorrowRate);
          const availableLiquidity = Number(r.availableLiquidity) / Math.pow(10, decimals);
          
          // Price in USD (priceInMarketReferenceCurrency / marketReferenceCurrencyUnit * marketReferenceCurrencyPriceInUsd)
          const priceInUsd = (Number(r.priceInMarketReferenceCurrency) / Number(baseCurrencyInfo.marketReferenceCurrencyUnit)) * 
            (Number(baseCurrencyInfo.marketReferenceCurrencyPriceInUsd) / 1e8);

          return {
            id: `borrow-${chainId}-${r.underlyingAsset}`,
            chainId,
            chainName: name,
            chainLogo: logo,
            assetSymbol: r.symbol,
            assetName: r.name,
            assetAddress: r.underlyingAsset,
            assetLogo: getTokenLogo(r.symbol),
            decimals,
            variableBorrowAPY: (variableBorrowRate / 1e27) * 100,
            stableBorrowAPY: (stableBorrowRate / 1e27) * 100,
            stableBorrowEnabled: r.stableBorrowRateEnabled,
            borrowingEnabled: r.borrowingEnabled,
            availableLiquidity,
            availableLiquidityUsd: availableLiquidity * priceInUsd,
            ltv: Number(r.baseLTVasCollateral) / 100,
            liquidationThreshold: Number(r.reserveLiquidationThreshold) / 100,
            liquidationBonus: Number(r.reserveLiquidationBonus) / 100 - 100,
            priceInUsd,
            variableDebtTokenAddress: r.variableDebtTokenAddress,
            stableDebtTokenAddress: r.stableDebtTokenAddress,
          };
        });

      return {
        chainId,
        chainName: name,
        status: 'ok',
        markets,
        lastFetched: Date.now(),
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        chainId,
        chainName: name,
        status: 'error',
        markets: [],
        error: {
          message: errorMessage,
          contract: checksummedUiProvider,
          functionName: 'getReservesData',
          rpcMasked: maskRpcUrl(rpcUrl),
        },
      };
    }
  }, []);

  // Fetch all chains
  const fetchAllChains = useCallback(async () => {
    setIsLoading(true);
    
    const promises = SUPPORTED_CHAINS.map(chain => fetchChainMarkets(chain));
    const results = await Promise.all(promises);
    
    setChainStatuses(results);
    setIsLoading(false);

    // Auto-select first available chain if none selected
    const firstAvailable = results.find(r => r.status === 'ok');
    if (!selectedChainId && firstAvailable) {
      setSelectedChainId(firstAvailable.chainId);
    }
  }, [fetchChainMarkets, selectedChainId]);

  // Retest single chain
  const retestChain = useCallback(async (chainId: number) => {
    const chainConfig = SUPPORTED_CHAINS.find(c => c.chainId === chainId);
    if (!chainConfig) return;

    // Mark as loading
    setChainStatuses(prev => prev.map(s => 
      s.chainId === chainId ? { ...s, status: 'loading' as const } : s
    ));

    const result = await fetchChainMarkets(chainConfig);
    
    setChainStatuses(prev => prev.map(s => 
      s.chainId === chainId ? result : s
    ));
  }, [fetchChainMarkets]);

  // Fetch user account data for selected chain
  const fetchUserAccountData = useCallback(async () => {
    if (!address || !selectedChainId) {
      setAccountData(null);
      setUserPositions([]);
      return;
    }

    const chainConfig = SUPPORTED_CHAINS.find(c => c.chainId === selectedChainId);
    if (!chainConfig?.rpcUrl) return;

    const aaveAddresses = getAaveAddresses(selectedChainId);
    if (!aaveAddresses) return;

    const viemChain = VIEM_CHAINS[selectedChainId];
    if (!viemChain) return;

    setIsLoadingAccount(true);

    try {
      const checksummedPool = getAddress(aaveAddresses.POOL);
      const checksummedProvider = getAddress(aaveAddresses.POOL_ADDRESSES_PROVIDER);
      const checksummedUiProvider = getAddress(aaveAddresses.UI_POOL_DATA_PROVIDER);

      const client = createPublicClient({
        chain: viemChain,
        transport: http(chainConfig.rpcUrl),
      });

      // Fetch user account data from Pool
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountResult = await (client.readContract as any)({
        address: checksummedPool,
        abi: POOL_USER_ACCOUNT_ABI,
        functionName: 'getUserAccountData',
        args: [address],
      });

      const [totalCollateralBase, totalDebtBase, availableBorrowsBase, currentLiquidationThreshold, ltv, healthFactor] = accountResult;

      // Base currency is in 8 decimals (USD)
      const totalCollateralUsd = Number(totalCollateralBase) / 1e8;
      const totalDebtUsd = Number(totalDebtBase) / 1e8;
      const availableBorrowsUsd = Number(availableBorrowsBase) / 1e8;
      const healthFactorFormatted = Number(healthFactor) / 1e18;
      
      // Calculate borrow limit used %
      const maxBorrow = totalCollateralUsd * (Number(ltv) / 10000);
      const borrowLimitUsedPercent = maxBorrow > 0 ? (totalDebtUsd / maxBorrow) * 100 : 0;

      setAccountData({
        totalCollateralBase,
        totalDebtBase,
        availableBorrowsBase,
        currentLiquidationThreshold,
        ltv,
        healthFactor,
        totalCollateralUsd,
        totalDebtUsd,
        availableBorrowsUsd,
        healthFactorFormatted,
        borrowLimitUsedPercent,
      });

      // Fetch user reserves data for positions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userReservesResult = await (client.readContract as any)({
        address: checksummedUiProvider,
        abi: UI_POOL_DATA_PROVIDER_USER_ABI,
        functionName: 'getUserReservesData',
        args: [checksummedProvider, address],
      });

      const [userReserves] = userReservesResult;

      // Get market info for each position
      const chainStatus = chainStatuses.find(s => s.chainId === selectedChainId);
      const positions: UserBorrowPosition[] = [];

      for (const reserve of userReserves) {
        const variableDebt = BigInt(reserve.scaledVariableDebt || 0);
        const stableDebt = BigInt(reserve.principalStableDebt || 0);

        if (variableDebt > 0n || stableDebt > 0n) {
          const market = chainStatus?.markets.find(m => 
            m.assetAddress.toLowerCase() === reserve.underlyingAsset.toLowerCase()
          );

          if (market) {
            positions.push({
              assetAddress: reserve.underlyingAsset,
              assetSymbol: market.assetSymbol,
              assetName: market.assetName,
              assetLogo: market.assetLogo,
              chainId: selectedChainId,
              chainName: chainConfig.name,
              currentVariableDebt: variableDebt,
              currentStableDebt: stableDebt,
              variableDebtFormatted: formatUnits(variableDebt, market.decimals),
              stableDebtFormatted: formatUnits(stableDebt, market.decimals),
              variableBorrowAPY: market.variableBorrowAPY,
              stableBorrowAPY: market.stableBorrowAPY,
              decimals: market.decimals,
              rateMode: variableDebt > stableDebt ? 'variable' : 'stable',
            });
          }
        }
      }

      setUserPositions(positions);

    } catch (error) {
      console.error('[Borrow] Failed to fetch user account data:', error);
      setAccountData(null);
      setUserPositions([]);
    } finally {
      setIsLoadingAccount(false);
    }
  }, [address, selectedChainId, chainStatuses]);

  // Initial fetch
  useEffect(() => {
    fetchAllChains();
  }, [fetchAllChains]);

  // Fetch user data when chain or address changes
  useEffect(() => {
    fetchUserAccountData();
  }, [fetchUserAccountData]);

  // Derived data
  const borrowMarkets = useMemo(() => {
    if (selectedChainId !== undefined) {
      const chainStatus = chainStatuses.find(s => s.chainId === selectedChainId);
      return chainStatus?.markets || [];
    }
    // Return all markets from successful chains
    return chainStatuses
      .filter(s => s.status === 'ok')
      .flatMap(s => s.markets);
  }, [chainStatuses, selectedChainId]);

  const availableChains = useMemo(() => {
    return chainStatuses
      .filter(s => s.status === 'ok')
      .map(s => ({
        chainId: s.chainId,
        name: s.chainName,
        logo: SUPPORTED_CHAINS.find(c => c.chainId === s.chainId)?.logo || '',
      }));
  }, [chainStatuses]);

  // Borrow function
  const borrow = useCallback(async (market: BorrowMarket, amount: string, rateMode: 'variable' | 'stable') => {
    if (!address) {
      setBorrowError('Wallet not connected');
      return;
    }

    if (walletChainId !== market.chainId) {
      setBorrowError(`Please switch to ${market.chainName}`);
      return;
    }

    const poolAddress = getAavePoolAddress(market.chainId);
    if (!poolAddress) {
      setBorrowError('Pool address not found');
      return;
    }

    setBorrowStep('borrowing');
    setBorrowError(null);

    try {
      const parsedAmount = parseUnits(amount, market.decimals);
      const interestRateMode = rateMode === 'variable' ? 2n : 1n;

      console.log('[Borrow] Transaction sent:', {
        chainId: market.chainId,
        assetSymbol: market.assetSymbol,
        amount: parsedAmount.toString(),
        rateMode,
      });

      const txHash = await writeContractAsync({
        address: poolAddress,
        abi: POOL_BORROW_ABI,
        functionName: 'borrow',
        args: [market.assetAddress, parsedAmount, interestRateMode, 0, address],
      } as any);

      // Wait a bit for confirmation
      await new Promise(resolve => setTimeout(resolve, 3000));

      setBorrowStep('complete');
      
      console.log('[Borrow] Transaction success:', { txHash });

      // Refresh data
      await fetchUserAccountData();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Borrow failed';
      
      if (errorMessage.includes('User rejected') || errorMessage.includes('User denied')) {
        setBorrowError('Transaction cancelled');
      } else {
        setBorrowError(errorMessage);
      }
      setBorrowStep('error');
      console.error('[Borrow] Error:', errorMessage);
    }
  }, [address, walletChainId, writeContractAsync, fetchUserAccountData]);

  // Repay function
  const repay = useCallback(async (position: UserBorrowPosition, amount: string) => {
    if (!address) {
      setRepayError('Wallet not connected');
      return;
    }

    if (walletChainId !== position.chainId) {
      setRepayError(`Please switch to ${position.chainName}`);
      return;
    }

    const poolAddress = getAavePoolAddress(position.chainId);
    if (!poolAddress) {
      setRepayError('Pool address not found');
      return;
    }

    setRepayStep('approving');
    setRepayError(null);

    try {
      const parsedAmount = parseUnits(amount, position.decimals);
      const interestRateMode = position.rateMode === 'variable' ? 2n : 1n;

      // First approve the pool to spend tokens
      await writeContractAsync({
        address: position.assetAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [poolAddress, parsedAmount],
      } as any);

      setRepayStep('repaying');

      console.log('[Repay] Transaction sent:', {
        chainId: position.chainId,
        assetSymbol: position.assetSymbol,
        amount: parsedAmount.toString(),
      });

      const txHash = await writeContractAsync({
        address: poolAddress,
        abi: POOL_REPAY_ABI,
        functionName: 'repay',
        args: [position.assetAddress, parsedAmount, interestRateMode, address],
      } as any);

      await new Promise(resolve => setTimeout(resolve, 3000));

      setRepayStep('complete');
      console.log('[Repay] Transaction success:', { txHash });

      await fetchUserAccountData();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Repay failed';
      
      if (errorMessage.includes('User rejected') || errorMessage.includes('User denied')) {
        setRepayError('Transaction cancelled');
      } else {
        setRepayError(errorMessage);
      }
      setRepayStep('error');
      console.error('[Repay] Error:', errorMessage);
    }
  }, [address, walletChainId, writeContractAsync, fetchUserAccountData]);

  const resetBorrowState = useCallback(() => {
    setBorrowStep('idle');
    setBorrowError(null);
  }, []);

  const resetRepayState = useCallback(() => {
    setRepayStep('idle');
    setRepayError(null);
  }, []);

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
  };
}
