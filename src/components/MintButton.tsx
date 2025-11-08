type MintButtonProps = {
  tokenName: string;
  tokenAddress: Address;
  abi: typeof erc20Abi;
  client: ReturnType<typeof usePublicClient>;
  user: Address | undefined;
};

function MintButton({ tokenName, tokenAddress, abi, client, user }: MintButtonProps) {
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleMint = async () => {
    if (!user || !client) return toast.error('Connect wallet first');

    const toastId = toast.loading(`Minting 100 ${tokenName}…`);
    try {
      const txHash = await writeContractAsync({
        address: tokenAddress,
        abi,
        functionName: 'mint',
        args: [],
      });

      // wait for receipt (optional, but gives nice UI)
      await client.waitForTransactionReceipt({ hash: txHash });
      toast.dismiss(toastId);
      toast.success(`Minted 100 ${tokenName}!`);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(`Mint failed – ${(err as Error).message}`);
    }
  };

  return (
    <button
      onClick={handleMint}
      disabled={isPending || confirming || !user}
      className={`
        flex w-full items-center justify-center gap-2 rounded-xl
        px-5 py-3 font-bold text-white shadow-lg transition
        ${isPending || confirming
          ? 'bg-gray-500 cursor-not-allowed'
          : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:scale-[1.02]'
        }
      `}
    >
      {(isPending || confirming) ? (
        <>
          <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
          Minting…
        </>
      ) : (
        <>
          <CurrencyDollarIcon className="h-5 w-5" />
          Mint 100 {tokenName}
        </>
      )}
    </button>
  );
}