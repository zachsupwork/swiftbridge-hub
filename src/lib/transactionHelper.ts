// Transaction normalization and validation helpers for LI.FI swaps
import { formatEther } from 'viem';

// Native token address (zero address used by LI.FI)
const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface LiFiTransactionRequest {
  to: string;
  data: string;
  value?: string;
  gasLimit?: string;
  gasPrice?: string;
}

export interface NormalizedTransaction {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  gas?: bigint;
}

export interface TransactionSimulation {
  to: string;
  valueEth: string;
  valueBigInt: bigint;
  gasLimit: string;
  isNativeToken: boolean;
  fromTokenSymbol: string;
  dataLength: number;
}

export class TransactionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransactionValidationError';
  }
}

/**
 * Check if a token address is the native token (ETH, MATIC, etc.)
 */
export function isNativeToken(tokenAddress: string): boolean {
  return (
    tokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase() ||
    tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  );
}

/**
 * Normalize a LI.FI transaction request into a safe transaction object.
 * NEVER use fromAmount as value - always use tx.value from LI.FI.
 */
export function normalizeTxRequest(
  tx: LiFiTransactionRequest,
  fromTokenAddress: string
): NormalizedTransaction {
  // Validate required fields
  if (!tx.to) {
    throw new TransactionValidationError('Route transaction missing "to" field');
  }
  if (!tx.data) {
    throw new TransactionValidationError('Route transaction missing "data" field');
  }

  const isNative = isNativeToken(fromTokenAddress);
  
  // For ERC-20 swaps, value MUST be 0 (or the small amount for gas on some L2s)
  // For native token swaps, use the exact value from LI.FI
  let value: bigint;
  
  if (isNative) {
    // Native token: use the exact value from LI.FI transaction
    value = BigInt(tx.value ?? '0');
  } else {
    // ERC-20: value should be 0 (or very small for gas purposes)
    // LI.FI sometimes includes a small value for gas on L2s, but never the swap amount
    value = BigInt(tx.value ?? '0');
    
    // Guardrail: If value > 1 ETH for an ERC-20 swap, something is wrong
    const oneEth = BigInt('1000000000000000000'); // 1 ETH in wei
    if (value > oneEth) {
      throw new TransactionValidationError(
        `Invalid tx value for ERC-20 swap: ${formatEther(value)} ETH. ERC-20 swaps should have value ≈ 0.`
      );
    }
  }

  const normalized: NormalizedTransaction = {
    to: tx.to as `0x${string}`,
    data: tx.data as `0x${string}`,
    value,
  };

  // Only include gas if provided
  if (tx.gasLimit) {
    normalized.gas = BigInt(tx.gasLimit);
  }

  return normalized;
}

/**
 * Generate a simulation summary for debug display
 */
export function getTransactionSimulation(
  tx: LiFiTransactionRequest,
  fromTokenAddress: string,
  fromTokenSymbol: string
): TransactionSimulation {
  const isNative = isNativeToken(fromTokenAddress);
  const valueBigInt = BigInt(tx.value ?? '0');

  return {
    to: tx.to || 'MISSING',
    valueEth: formatEther(valueBigInt),
    valueBigInt,
    gasLimit: tx.gasLimit || 'auto',
    isNativeToken: isNative,
    fromTokenSymbol,
    dataLength: tx.data?.length ?? 0,
  };
}

/**
 * Log transaction details before sending (for debugging)
 */
export function logTransactionDetails(
  chainId: number,
  normalized: NormalizedTransaction,
  simulation: TransactionSimulation
): void {
  console.log('🔄 Preparing transaction:');
  console.log('  Chain ID:', chainId);
  console.log('  To:', normalized.to);
  console.log('  Value:', simulation.valueEth, 'ETH');
  console.log('  Gas limit:', simulation.gasLimit);
  console.log('  Data length:', simulation.dataLength, 'bytes');
  console.log('  Token type:', simulation.isNativeToken ? 'NATIVE' : 'ERC-20');
  console.log('  From token:', simulation.fromTokenSymbol);
}
