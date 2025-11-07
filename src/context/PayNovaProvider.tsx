'use client';

import { createContext, useContext, useCallback } from 'react';
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi';
import { Address, Hash } from 'viem';
import PayNovaABI from './abi.json';

const CONTRACT_ADDRESS =
  '0x1387C1cDaC62D23A4b198D834a6Ac3C50a9f3840' as Address;

/* ----------------------- Types ----------------------- */
export type TxStatus = 0 | 1 | 2; // 0: Pending, 1: Paid, 2: Cancelled

type Transaction = {
  from: Address;
  to: Address;
  amount: bigint;
  token: Address;
  timestamp: bigint;
  status: TxStatus;
  refunded: bigint;
};

type TransactionTuple = [Address, Address, bigint, Address, bigint, TxStatus, bigint];

/* ----------------------- Hooks ----------------------- */
export function useGetTransaction(
  ref?: string,
  options = { enabled: true }
) {
  const result = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PayNovaABI,
    functionName: 'getTransaction',
    args: ref ? [ref] : undefined,
    query: { enabled: options.enabled && !!ref },
  });

  return {
    data: result.data
      ? {
          from: (result.data as TransactionTuple)[0],
          to: (result.data as TransactionTuple)[1],
          amount: (result.data as TransactionTuple)[2],
          token: (result.data as TransactionTuple)[3],
          timestamp: (result.data as TransactionTuple)[4],
          status: (result.data as TransactionTuple)[5],
          refunded: (result.data as TransactionTuple)[6],
        }
      : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

/* generateTransaction – unchanged */
export function useGenerateTransaction(
  recipient: Address,
  amount: bigint,
  token: Address,
  ref: string
) {
  const {
    writeContractAsync,
    isPending,
    error,
    data: txHash,
  } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash as Hash });

  const write = useCallback(async (): Promise<Hash> => {
    const result = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: PayNovaABI,
      functionName: 'generateTransaction',
      args: [recipient, amount, token, ref],
    });

    if (!result) throw new Error('Invalid refHash returned from contract');
    return result as Hash;
  }, [writeContractAsync, recipient, amount, token, ref]);

  return { write, isPending, error, txHash, isSuccess };
}

/* executePay – unchanged (kept for internal use) */
export function useExecutePay(
  refHash: Hash,
  sentAmount: bigint,
  value?: bigint
) {
  const {
    writeContractAsync,
    isPending,
    error,
    data: txHash,
  } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async (): Promise<Hash> => {
    const result = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: PayNovaABI,
      functionName: 'executePay',
      args: [refHash, sentAmount],
      value,
    });

    if (!result) throw new Error('Invalid txHash returned from contract');
    return result as Hash;
  }, [writeContractAsync, refHash, sentAmount, value]);

  return { write, isPending, error, txHash, isSuccess };
}

/* cancelTransaction – unchanged */
export function useCancelTransaction(refHash: Hash) {
  const {
    writeContractAsync,
    isPending,
    error,
    data: txHash,
  } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async (): Promise<Hash> => {
    const result = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: PayNovaABI,
      functionName: 'cancelTransaction',
      args: [refHash],
    });

    if (!result) throw new Error('Invalid txHash returned from contract');
    return result as Hash;
  }, [writeContractAsync, refHash]);

  return { write, isPending, error, txHash, isSuccess };
}

/* ----------------------- Context ----------------------- */
type ContractContextType = {
  generateTransaction: (
    recipient: Address,
    amount: bigint,
    token: Address,
    ref: string
  ) => Promise<Hash>;
  /** NEW – matches UI naming */
  payTransaction: (refHash: Hash, sentAmount: bigint, value?: bigint) => Promise<Hash>;
  cancelTransaction: (refHash: Hash) => Promise<Hash>;
};

const PayNovaContext = createContext<ContractContextType | undefined>(undefined);

export const PayNovaContractProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { writeContractAsync } = useWriteContract();

  const generateTransaction = useCallback(
    async (
      recipient: Address,
      amount: bigint,
      token: Address,
      ref: string
    ): Promise<Hash> => {
      const result = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PayNovaABI,
        functionName: 'generateTransaction',
        args: [recipient, amount, token, ref],
      });
      if (!result) throw new Error('Invalid refHash returned from contract');
      return result as Hash;
    },
    [writeContractAsync]
  );

  /** payTransaction – calls the contract’s executePay */
  const payTransaction = useCallback(
    async (refHash: Hash, sentAmount: bigint, value?: bigint): Promise<Hash> => {
      const result = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PayNovaABI,
        functionName: 'executePay',
        args: [refHash, sentAmount],
        value,
      });
      if (!result) throw new Error('Invalid txHash returned from contract');
      return result as Hash;
    },
    [writeContractAsync]
  );

  const cancelTransaction = useCallback(
    async (refHash: Hash): Promise<Hash> => {
      const result = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PayNovaABI,
        functionName: 'cancelTransaction',
        args: [refHash],
      });
      if (!result) throw new Error('Invalid txHash returned from contract');
      return result as Hash;
    },
    [writeContractAsync]
  );

  return (
    <PayNovaContext.Provider
      value={{ generateTransaction, payTransaction, cancelTransaction }}
    >
      {children}
    </PayNovaContext.Provider>
  );
};

export const usePayNovaContract = () => {
  const context = useContext(PayNovaContext);
  if (!context)
    throw new Error(
      'usePayNovaContract must be used within a PayNovaContractProvider'
    );
  return context;
};