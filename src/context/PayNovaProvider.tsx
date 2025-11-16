// context/PayNovaProvider.tsx
'use client';

import { createContext, useContext, useCallback } from 'react';
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { Address, Hash } from 'viem';
import PayNovaABI from './abi.json';
import erc20Abi from './ercabi.json';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PAYNOVA_CONTRACT_BASE as Address;

export type TxStatus = 0 | 1 | 2;


type TransactionTuple = [Address, Address, bigint, Address, bigint, TxStatus, bigint];

export function useGetTransaction(ref?: string, options = { enabled: true }) {
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

export function useGenerateTransaction(
  recipient: Address,
  amount: bigint,
  token: Address,
  ref: string
) {
  const { writeContractAsync, isPending, error, data: txHash } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash as Hash });

  const write = useCallback(async (): Promise<Hash> => {
    const result = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: PayNovaABI,
      functionName: 'generateTransaction',
      args: [recipient, amount, token, ref],
    });
    if (!result) throw new Error('Invalid refHash returned');
    return result as Hash;
  }, [writeContractAsync, recipient, amount, token, ref]);

  return { write, isPending, error, txHash, isSuccess };
}

export function useExecutePay(ref: string, sentAmount: bigint, value?: bigint) {
  const { writeContractAsync, isPending, error, data: txHash } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async (): Promise<Hash> => {
    const result = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: PayNovaABI,
      functionName: 'executePay',
      args: [ref, sentAmount],
      value,
    });
    if (!result) throw new Error('Invalid txHash returned');
    return result as Hash;
  }, [writeContractAsync, ref, sentAmount, value]);

  return { write, isPending, error, txHash, isSuccess };
}

export function useCancelTransaction(refHash: Hash) {
  const { writeContractAsync, isPending, error, data: txHash } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async (): Promise<Hash> => {
    const result = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: PayNovaABI,
      functionName: 'cancelTransaction',
      args: [refHash],
    });
    if (!result) throw new Error('Invalid txHash returned');
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
  payTransaction: (ref: string, amount: bigint, token: Address) => Promise<Hash>;
  cancelTransaction: (refHash: Hash) => Promise<Hash>;
  approveTransaction: (amount: bigint, token: Address) => Promise<Hash> 
};

const PayNovaContext = createContext<ContractContextType | undefined>(undefined);

export const PayNovaContractProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { writeContractAsync } = useWriteContract();

  const generateTransaction = useCallback(
    async (recipient: Address, amount: bigint, token: Address, ref: string): Promise<Hash> => {
      const result = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PayNovaABI,
        functionName: 'generateTransaction',
        args: [recipient, amount, token, ref],
      });
      if (!result) throw new Error('Invalid refHash returned');
      return result as Hash;
    },
    [writeContractAsync]
  );

  // NEW: payTransaction with approve + executePay in one multicall
  const payTransaction = useCallback(
    async (ref: string, amount: bigint, token: Address): Promise<Hash> => {
      if (token === '0x0000000000000000000000000000000000000000') {
        // Native token
        return await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: PayNovaABI,
          functionName: 'executePay',
          args: [ref, amount],
          value: amount,
        });
      }
      else{
         return await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: PayNovaABI,
          functionName: 'executePay',
          args: [ref, amount],
        });
      }

    },
    [writeContractAsync]
  );

  // const payERCTransaction = useCallback(
  //   async (ref: string, amount: bigint, token: Address): Promise<Hash> => {
  //     if (token === '0x0000000000000000000000000000000000000000') {
  //       // Native token
  //       return await writeContractAsync({
  //         address: CONTRACT_ADDRESS,
  //         abi: PayNovaABI,
  //         functionName: 'executePay',
  //         args: [ref, amount],
  //         value: amount,
  //       });
  //     }

 
      
  //  return await writeContractAsync({
  //         address: token,
  //         abi: PayNovaABI,
  //         functionName: 'executePay',
  //         args: [ref, amount],
  //       });

  //   },
  //   [writeContractAsync]
  // );


   const approveTransaction = useCallback(
    async (amount: bigint, token: Address): Promise<Hash> => {    
      
 return await writeContractAsync({
    address: token,
    abi: erc20Abi,
    functionName: 'approve',
    args: [CONTRACT_ADDRESS, amount],
  })


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
      if (!result) throw new Error('Invalid txHash returned');
      return result as Hash;
    },
    [writeContractAsync]
  );

  return (
    <PayNovaContext.Provider
      value={{ generateTransaction, payTransaction, cancelTransaction, approveTransaction }}
    >
      {children}
    </PayNovaContext.Provider>
  );
};

export const usePayNovaContract = () => {
  const context = useContext(PayNovaContext);
  if (!context)
    throw new Error('usePayNovaContract must be used within PayNovaContractProvider');
  return context;
};