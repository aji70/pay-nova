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
import erc20Abi from './ercabi.json';

export type TxStatus = 0 | 1 | 2;

type TransactionTuple = [Address, Address, bigint, Address, bigint, TxStatus, bigint];

const getContractAddress = (chainId?: number): Address | undefined => {
  if (!chainId) return undefined;

  switch (chainId) {
    case 84532: // Base Sepolia
      return process.env.NEXT_PUBLIC_BASE_SEPOLIA_PAYNOVA_CONTRACT as Address;
    case 8453: // Base mainnet
      return process.env.NEXT_PUBLIC_PAYNOVA_CONTRACT_BASE as Address;
    case 42220: // Celo mainnet
      return process.env.NEXT_PUBLIC_PAYNOVA_CONTRACT_CELO as Address;
    default:
      return undefined;
  }
};

export function useGetTransaction(ref?: string, options = { enabled: true }) {
  const client = usePublicClient();
  const chainId = client?.chain?.id;
  const CONTRACT_ADDRESS = getContractAddress(chainId);

  const result = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PayNovaABI,
    functionName: 'getTransaction',
    args: ref ? [ref] : undefined,
    query: { enabled: options.enabled && !!ref && !!CONTRACT_ADDRESS },
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
  const client = usePublicClient();
  const chainId = client?.chain?.id;
  const CONTRACT_ADDRESS = getContractAddress(chainId);
  const { writeContractAsync, isPending, error, data: txHash } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash as Hash });

  const write = useCallback(async (): Promise<Hash> => {
    if (!CONTRACT_ADDRESS) throw new Error('Contract address not available on this chain');
    const result = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: PayNovaABI,
      functionName: 'generateTransaction',
      args: [recipient, amount, token, ref],
    });
    if (!result) throw new Error('Invalid refHash returned');
    return result as Hash;
  }, [writeContractAsync, recipient, amount, token, ref, CONTRACT_ADDRESS]);

  return { write, isPending, error, txHash, isSuccess };
}

export function useExecutePay(ref: string, sentAmount: bigint, value?: bigint) {
  const client = usePublicClient();
  const chainId = client?.chain?.id;
  const CONTRACT_ADDRESS = getContractAddress(chainId);
  const { writeContractAsync, isPending, error, data: txHash } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async (): Promise<Hash> => {
    if (!CONTRACT_ADDRESS) throw new Error('Contract address not available on this chain');
    const result = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: PayNovaABI,
      functionName: 'executePay',
      args: [ref, sentAmount],
      value,
    });
    if (!result) throw new Error('Invalid txHash returned');
    return result as Hash;
  }, [writeContractAsync, ref, sentAmount, value, CONTRACT_ADDRESS]);

  return { write, isPending, error, txHash, isSuccess };
}

export function useCancelTransaction(refHash: Hash) {
  const client = usePublicClient();
  const chainId = client?.chain?.id;
  const CONTRACT_ADDRESS = getContractAddress(chainId);
  const { writeContractAsync, isPending, error, data: txHash } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async (): Promise<Hash> => {
    if (!CONTRACT_ADDRESS) throw new Error('Contract address not available on this chain');
    const result = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: PayNovaABI,
      functionName: 'cancelTransaction',
      args: [refHash],
    });
    if (!result) throw new Error('Invalid txHash returned');
    return result as Hash;
  }, [writeContractAsync, refHash, CONTRACT_ADDRESS]);

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
  const client = usePublicClient();
  const chainId = client?.chain?.id;
  const CONTRACT_ADDRESS = getContractAddress(chainId);
  const { writeContractAsync } = useWriteContract();

  const generateTransaction = useCallback(
    async (recipient: Address, amount: bigint, token: Address, ref: string): Promise<Hash> => {
      if (!CONTRACT_ADDRESS) throw new Error('Contract address not available on this chain');
      const result = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PayNovaABI,
        functionName: 'generateTransaction',
        args: [recipient, amount, token, ref],
      });
      if (!result) throw new Error('Invalid refHash returned');
      return result as Hash;
    },
    [writeContractAsync, CONTRACT_ADDRESS]
  );

  // NEW: payTransaction with approve + executePay in one multicall
  const payTransaction = useCallback(
    async (ref: string, amount: bigint, token: Address): Promise<Hash> => {
      if (!CONTRACT_ADDRESS) throw new Error('Contract address not available on this chain');
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
    [writeContractAsync, CONTRACT_ADDRESS]
  );

   const approveTransaction = useCallback(
    async (amount: bigint, token: Address): Promise<Hash> => {    
      if (!CONTRACT_ADDRESS) throw new Error('Contract address not available on this chain');
 return await writeContractAsync({
    address: token,
    abi: erc20Abi,
    functionName: 'approve',
    args: [CONTRACT_ADDRESS, amount],
  })


    },
    [writeContractAsync, CONTRACT_ADDRESS]
  );

  const cancelTransaction = useCallback(
    async (refHash: Hash): Promise<Hash> => {
      if (!CONTRACT_ADDRESS) throw new Error('Contract address not available on this chain');
      const result = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PayNovaABI,
        functionName: 'cancelTransaction',
        args: [refHash],
      });
      if (!result) throw new Error('Invalid txHash returned');
      return result as Hash;
    },
    [writeContractAsync, CONTRACT_ADDRESS]
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