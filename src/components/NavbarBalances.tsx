'use client';

import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import erc20Abi from '@/context/ercabi.json';
import toast from 'react-hot-toast';
import { CurrencyDollarIcon } from '@heroicons/react/24/outline';

export default function NavbarBalances() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();

  const chainId = client?.chain?.id;

  // Dynamically select token addresses based on chain ID
  let USDC_ADDRESS: `0x${string}` | undefined;
  let USDT_ADDRESS: `0x${string}` | undefined;

  if (chainId === 84532) { // Base Sepolia
    USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_BASE_SEPOLIA as `0x${string}`;
    USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_BASE_SEPOLIA as `0x${string}`;
  } else if (chainId === 8453) { // Base mainnet
    USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_BASE as `0x${string}`;
    USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_BASE as `0x${string}`;
  } else if (chainId === 42220) { // Celo mainnet
    USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_CELO as `0x${string}`;
    USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_CELO as `0x${string}`;
  } else if (chainId === 1) { // Ethereum mainnet
    USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ETHEREUM as `0x${string}`;
    USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_ETHEREUM as `0x${string}`;
  } else if (chainId === 56) { // BSC mainnet
    USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_BSC as `0x${string}`;
    USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_BSC as `0x${string}`;
  }

  const { data: usdcRaw, isLoading: loadingUsdc } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: isConnected && !!address && !!USDC_ADDRESS },
  }) as { data: bigint | undefined; isLoading: boolean };

  const { data: usdtRaw, isLoading: loadingUsdt } = useReadContract({
    address: USDT_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: isConnected && !!address && !!USDT_ADDRESS },
  }) as { data: bigint | undefined; isLoading: boolean };

  // Format by dividing balance by 10^6 (USDC/USDT decimals)
  const format = (val: bigint | undefined) =>
    val ? parseFloat(formatUnits(val, 18)).toFixed(2) : '0.00';

  if (!isConnected || !address || (!USDC_ADDRESS && !USDT_ADDRESS)) return null;

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
    </div>
  );
}