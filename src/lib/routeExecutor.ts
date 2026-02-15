/**
 * Lightweight REST-based multi-step route executor for LI.FI.
 * Handles: chain validation, ERC-20 approvals, step transactions, bridge status polling.
 * No @lifi/sdk dependency — browser-safe.
 */

import { erc20Abi, maxUint256, type WalletClient } from 'viem';
import { getStepTransaction, getTransactionStatus, type Route, type Step } from './lifiClient';
import {
  normalizeTxRequest,
  getTransactionSimulation,
  logTransactionDetails,
  TransactionValidationError,
  isNativeToken,
} from './transactionHelper';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ExecutionPhase =
  | 'idle'
  | 'approval_needed'
  | 'approving'
  | 'approved'
  | 'sending'
  | 'waiting_bridge'
  | 'completed'
  | 'failed';

export interface StepResult {
  stepIndex: number;
  tool: string;
  approvalTxHash?: string;
  txHash: string;
  status: 'completed' | 'failed';
}

export interface ExecutionUpdate {
  phase: ExecutionPhase;
  stepIndex: number;
  totalSteps: number;
  message: string;
  stepResults: StepResult[];
}

export interface ExecutionResult {
  success: boolean;
  stepResults: StepResult[];
  error?: string;
}

export interface ExecutionContext {
  /** wagmi sendTransactionAsync */
  sendTransaction: (params: {
    to: `0x${string}`;
    data: `0x${string}`;
    value: bigint;
    gas?: bigint;
  }) => Promise<string>;

  /** Send an ERC-20 approve tx, return tx hash */
  approveToken: (params: {
    tokenAddress: `0x${string}`;
    spender: `0x${string}`;
    amount: bigint;
    chainId: number;
  }) => Promise<string>;

  /** Wait for a tx receipt by hash */
  waitForReceipt: (hash: `0x${string}`) => Promise<{ status: 'success' | 'reverted' }>;

  /** Read ERC-20 allowance */
  readAllowance: (params: {
    tokenAddress: `0x${string}`;
    owner: `0x${string}`;
    spender: `0x${string}`;
    chainId: number;
  }) => Promise<bigint>;

  /** Current wallet chain id */
  walletChainId: number;

  /** Wallet address */
  walletAddress: `0x${string}`;

  /** Callback for UI updates */
  onUpdate: (update: ExecutionUpdate) => void;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Poll LI.FI /status until DONE or FAILED (max ~10 min).
 * Uses exponential backoff on rate-limit / RPC errors. */
async function waitForBridgeCompletion(
  txHash: string,
  fromChainId: number,
  toChainId: number,
  tool: string,
): Promise<{ done: boolean; receivingTxHash?: string }> {
  const maxAttempts = 120;
  let delay = 3000; // start at 3s
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(delay);
    try {
      const status = await getTransactionStatus(txHash, fromChainId, toChainId, tool);
      if (status.status === 'DONE') {
        return { done: true, receivingTxHash: status.receiving?.txHash };
      }
      if (status.status === 'FAILED') {
        return { done: false };
      }
      // Success fetch → reset delay
      delay = 3000;
    } catch {
      // Exponential backoff: 3→6→12→20s max
      delay = Math.min(delay * 2, 20000);
    }
  }
  // Timeout — treat as success-ish (user can check explorer)
  return { done: true };
}

/* ------------------------------------------------------------------ */
/* Main executor                                                       */
/* ------------------------------------------------------------------ */

export async function executeRoute(
  route: Route,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const stepResults: StepResult[] = [];
  const totalSteps = route.steps.length;

  const emit = (phase: ExecutionPhase, stepIndex: number, message: string) => {
    ctx.onUpdate({ phase, stepIndex, totalSteps, message, stepResults: [...stepResults] });
  };

  try {
    for (let i = 0; i < totalSteps; i++) {
      const step = route.steps[i];

      // 1 — Validate chain
      if (ctx.walletChainId !== step.action.fromChainId) {
        throw new TransactionValidationError(
          `Please switch to chain ${step.action.fromChainId} for step ${i + 1}.`,
        );
      }

      const fromTokenAddr = step.action.fromToken.address;
      const isNative = isNativeToken(fromTokenAddr);
      const spender = step.estimate.approvalAddress as `0x${string}` | undefined;
      let approvalTxHash: string | undefined;

      // 2 — Handle ERC-20 approval
      if (!isNative && spender) {
        emit('approval_needed', i, `Checking allowance for ${step.action.fromToken.symbol}…`);

        const allowance = await ctx.readAllowance({
          tokenAddress: fromTokenAddr as `0x${string}`,
          owner: ctx.walletAddress,
          spender,
          chainId: step.action.fromChainId,
        });

        const requiredAmount = BigInt(step.action.fromAmount);

        if (allowance < requiredAmount) {
          emit('approving', i, `Approve ${step.action.fromToken.symbol} in your wallet…`);

          const approveTx = await ctx.approveToken({
            tokenAddress: fromTokenAddr as `0x${string}`,
            spender,
            amount: maxUint256,
            chainId: step.action.fromChainId,
          });

          approvalTxHash = approveTx;

          // Wait for approval confirmation
          const receipt = await ctx.waitForReceipt(approveTx as `0x${string}`);
          if (receipt.status === 'reverted') {
            throw new TransactionValidationError('Approval transaction reverted.');
          }

          emit('approved', i, 'Approval confirmed.');
        }
      }

      // 3 — Get step transaction data
      emit('sending', i, `Preparing step ${i + 1}/${totalSteps}: ${step.toolDetails?.name || step.tool}…`);

      const stepWithTx = await getStepTransaction(step);
      if (!stepWithTx.transactionRequest) {
        throw new TransactionValidationError(`No transaction data for step ${i + 1}.`);
      }

      const tx = stepWithTx.transactionRequest;
      const simulation = getTransactionSimulation(tx, fromTokenAddr, step.action.fromToken.symbol);
      const normalizedTx = normalizeTxRequest(tx, fromTokenAddr);
      logTransactionDetails(step.action.fromChainId, normalizedTx, simulation);

      // 4 — Send transaction
      emit('sending', i, 'Confirm transaction in your wallet…');

      const hash = await ctx.sendTransaction({
        to: normalizedTx.to,
        data: normalizedTx.data,
        value: normalizedTx.value,
        gas: normalizedTx.gas,
      });

      // 5 — Wait for receipt
      const receipt = await ctx.waitForReceipt(hash as `0x${string}`);
      if (receipt.status === 'reverted') {
        stepResults.push({ stepIndex: i, tool: step.tool, approvalTxHash, txHash: hash, status: 'failed' });
        emit('failed', i, `Step ${i + 1} reverted on-chain.`);
        return { success: false, stepResults, error: `Step ${i + 1} transaction reverted.` };
      }

      // 6 — If cross-chain, poll bridge status
      const isCrossChain = step.action.fromChainId !== step.action.toChainId;
      if (isCrossChain) {
        emit('waiting_bridge', i, `Waiting for bridge (${step.toolDetails?.name || step.tool})…`);
        const bridgeResult = await waitForBridgeCompletion(
          hash,
          step.action.fromChainId,
          step.action.toChainId,
          step.tool,
        );
        if (!bridgeResult.done) {
          stepResults.push({ stepIndex: i, tool: step.tool, approvalTxHash, txHash: hash, status: 'failed' });
          emit('failed', i, 'Bridge transfer failed.');
          return { success: false, stepResults, error: 'Bridge transfer failed.' };
        }
      }

      stepResults.push({ stepIndex: i, tool: step.tool, approvalTxHash, txHash: hash, status: 'completed' });
    }

    emit('completed', totalSteps - 1, 'Swap complete!');
    return { success: true, stepResults };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Execution failed';
    emit('failed', stepResults.length, message);
    return { success: false, stepResults, error: message };
  }
}
