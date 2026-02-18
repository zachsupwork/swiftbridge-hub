/**
 * Address normalization utility
 *
 * Viem's readContract can sometimes return EVM addresses as:
 *   - `0x...` strings (ideal)
 *   - Uint8Array  (raw bytes from some transports)
 *   - number[]    (JSON-decoded byte arrays)
 *
 * This helper converts any of those into a checksummed `0x${string}` address
 * that viem / ethers / any EVM lib accepts.
 */

import { getAddress, toHex, isHex } from 'viem';

export type Hex = `0x${string}`;

/**
 * Normalise an EVM address coming from any on-chain read.
 * Throws a descriptive error if the input cannot be converted.
 */
export function normalizeAddress(input: unknown): Hex {
  if (input === null || input === undefined) {
    throw new Error(`normalizeAddress: received ${String(input)}`);
  }

  // Uint8Array (most common "bytes" case from some viem codec paths)
  if (input instanceof Uint8Array) {
    const hex = toHex(input);
    return getAddress(hex) as Hex;
  }

  // Plain number[] that looks like a byte array
  if (Array.isArray(input) && input.every((x) => typeof x === 'number')) {
    const uint8 = new Uint8Array(input as number[]);
    const hex = toHex(uint8);
    return getAddress(hex) as Hex;
  }

  // Already a string
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s.startsWith('0x')) {
      throw new Error(`normalizeAddress: string does not start with 0x — "${s.slice(0, 20)}"`);
    }
    if (!isHex(s)) {
      throw new Error(`normalizeAddress: not a valid hex string — "${s.slice(0, 20)}"`);
    }
    return getAddress(s) as Hex;
  }

  // Fallback: coerce to string and try
  const coerced = String(input);
  if (coerced.startsWith('0x') && isHex(coerced)) {
    return getAddress(coerced) as Hex;
  }

  throw new Error(
    `normalizeAddress: cannot convert value of type "${typeof input}" ` +
    `(Array.isArray=${Array.isArray(input)}, instanceof Uint8Array=${input instanceof Uint8Array}) ` +
    `value="${coerced.slice(0, 40)}"`,
  );
}

/**
 * Like normalizeAddress but returns null instead of throwing.
 * Safe to use in per-item loops where one bad address shouldn't break the whole set.
 */
export function tryNormalizeAddress(input: unknown): Hex | null {
  try {
    return normalizeAddress(input);
  } catch {
    return null;
  }
}
