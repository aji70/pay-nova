'use client';

import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import erc20Abi from '@/context/ercabi.json';
import toast from 'react-hot-toast';
import { CurrencyDollarIcon } from '@heroicons/react/24/outline';

export default function NavbarBalances() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();

  const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_BASE as `0x${string}`;
  const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_BASE as `0x${string}`;


  const { data: usdcRaw, isLoading: loadingUsdc } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: isConnected && !!address },
  }) as { data: bigint | undefined; isLoading: boolean };

  const { data: usdtRaw, isLoading: loadingUsdt } = useReadContract({
    address: USDT_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: isConnected && !!address },
  }) as { data: bigint | undefined; isLoading: boolean };

  // ✅ Format by dividing balance by 10^18
  const format = (val: bigint | undefined) =>
    val ? parseFloat(formatUnits(val, 18)).toFixed(2) : '0.00';

  const mint = async (tokenAddr: `0x${string}`, tokenName: string) => {
    if (!address) {
      toast.error('Connect wallet');
      return;
    }

    const toastId = toast.loading(`Minting 100 ${tokenName}…`);

    try {
      await writeContractAsync({
        address: tokenAddr,
        abi: erc20Abi,
        functionName: 'mint',
        args: [],
      });

      toast.dismiss(toastId);
      toast.success(`Minted 100 ${tokenName}!`);
    } catch (err) {
      const error = err as { shortMessage?: string; message?: string };
      toast.dismiss(toastId);
      toast.error(error.shortMessage || 'Mint failed');
    }
  };

  if (!isConnected || !address) return null;

  return (
    <div className="hidden md:flex items-center gap-3 text-xs text-white/80 font-medium">
      {/* Balances */}
      <div className="flex items-center gap-1">
        <span className="text-white/60">USDC:</span>
        {loadingUsdc ? (
          <span className="animate-pulse">...</span>
        ) : (
          <span className="font-bold text-white">{format(usdcRaw)}</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <span className="text-white/60">USDT:</span>
        {loadingUsdt ? (
          <span className="animate-pulse">...</span>
        ) : (
          <span className="font-bold text-white">{format(usdtRaw)}</span>
        )}
      </div>

      {/* Mint Buttons – Only visible on Base Sepolia */}
      {client?.chain?.id === 8453 && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => mint(USDC_ADDRESS, 'USDC')}
            disabled={isPending}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold transition-all ${
              isPending
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 active:scale-95'
            }`}
            title="Mint 100 USDC"
          >
            {isPending ? (
              <div className="h-2.5 w-2.5 animate-spin rounded-full border border-white border-t-transparent" />
            ) : (
              <CurrencyDollarIcon className="h-3 w-3" />
            )}
            Mint USDC
          </button>

          <button
            onClick={() => mint(USDT_ADDRESS, 'USDT')}
            disabled={isPending}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold transition-all ${
              isPending
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
            }`}
            title="Mint 100 USDT"
          >
            {isPending ? (
              <div className="h-2.5 w-2.5 animate-spin rounded-full border border-white border-t-transparent" />
            ) : (
              <CurrencyDollarIcon className="h-3 w-3" />
            )}
            Mint USDT
          </button>
        </div>
      )}
    </div>
  );
}