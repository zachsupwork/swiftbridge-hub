/**
 * Alchemy Token API Client
 * 
 * Calls the alchemy-balances edge function to fetch token balances
 * and metadata via Alchemy's Token API.
 */

import { supabase } from '@/integrations/supabase/client';

export interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string; // hex
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  logo: string | null;
}

export interface AlchemyBalancesResponse {
  chainId: number;
  walletAddress: string;
  tokenCount: number;
  tokens: AlchemyTokenBalance[];
}

/**
 * Fetch all ERC20 token balances for a wallet on a specific chain via Alchemy.
 */
export async function getAlchemyTokenBalances(
  chainId: number,
  walletAddress: string,
  tokenAddresses?: string[],
): Promise<AlchemyBalancesResponse | null> {
  try {
    const { data, error } = await supabase.functions.invoke('alchemy-balances', {
      body: { chainId, walletAddress, tokenAddresses },
    });

    if (error) {
      console.warn('[Alchemy] Edge function error:', error);
      return null;
    }

    return data as AlchemyBalancesResponse;
  } catch (err) {
    console.warn('[Alchemy] Failed to fetch balances:', err);
    return null;
  }
}

/**
 * Check if specific aToken/vToken addresses have non-zero balances via Alchemy.
 * This is used as a verification/secondary discovery path for Aave positions.
 */
export async function verifyAaveTokenBalances(
  chainId: number,
  walletAddress: string,
  aTokenAddresses: string[],
): Promise<Map<string, bigint>> {
  const result = new Map<string, bigint>();

  try {
    const response = await getAlchemyTokenBalances(chainId, walletAddress, aTokenAddresses);
    if (!response) return result;

    for (const token of response.tokens) {
      if (token.tokenBalance && token.tokenBalance !== '0x0') {
        try {
          result.set(token.contractAddress.toLowerCase(), BigInt(token.tokenBalance));
        } catch {
          // skip invalid hex
        }
      }
    }
  } catch (err) {
    console.warn('[Alchemy] Verification failed:', err);
  }

  return result;
}
