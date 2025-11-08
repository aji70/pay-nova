'use client';

import { useState, useCallback } from 'react';
import { usePayNovaContract } from '@/context/PayNovaProvider';
import {
  useAccount,
  usePublicClient,
  useWaitForTransactionReceipt,
} from 'wagmi';
import {
  Address,
  zeroAddress,
  formatUnits,
  parseUnits,
} from 'viem';
import PayNovaABI from '@/context/abi.json';
import toast from 'react-hot-toast';
import {
  QrCodeIcon,
  WalletIcon,
  ArrowRightIcon,
  UserIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon,
  CurrencyDollarIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';

const ERC20_MINIMAL_ABI = [
  { inputs: [], name: 'decimals', outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ internalType: 'string', name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
] as const;

type Transaction = {
  from: Address;
  to: Address;
  amount: bigint;
  token: Address;
  timestamp: bigint;
  status: 0 | 1 | 2;
  refunded: bigint;
};

type TokenType = 'Native' | 'USDT' | 'USDC' | 'Custom';

const TOKEN_CONFIG: Record<string, Record<string, { address: Address; decimals: number }>> = {
  Ethereum: {
    USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Address, decimals: 6 },
    USDC: { address: '0xA0b86a33E641E66e2aD2d4fC5E9B6b8C9e5D8b4f' as Address, decimals: 6 },
  },
  BSC: {
    USDT: { address: '0x55d398326f99059fF775485246999027B3197955' as Address, decimals: 18 },
    USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' as Address, decimals: 18 },
  },
  'Base Sepolia': {
    USDT: { address: process.env.NEXT_PUBLIC_USDT_BASE_SEPOLIA as Address, decimals: 6 },
    USDC: { address: process.env.NEXT_PUBLIC_USDC_BASE_SEPOLIA as Address, decimals: 6 },
  },
};

export default function Home() {
  /* ────── STATE ────── */
  const [ref, setRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [tx, setTx] = useState<Transaction | null>(null);
  const [symbol, setSymbol] = useState('Native');
  const [decimals, setDecimals] = useState(18);
  const [chain, setChain] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showRefModal, setShowRefModal] = useState(false);
  const [generatedRef, setGeneratedRef] = useState('');
  const [generatedChain, setGeneratedChain] = useState('');
  const [generatedSymbol, setGeneratedSymbol] = useState('');
  const [generatedDecimals, setGeneratedDecimals] = useState(18);

  // Generate form state
  const [genForm, setGenForm] = useState({
    recipient: '',
    amount: '',
    chain: 'Base Sepolia' as string,
    tokenType: 'Native' as TokenType,
    tokenAddress: '',
  });

  const { address: user } = useAccount();
  const { generateTransaction, payTransaction } = usePayNovaContract();
  const client = usePublicClient();

  const CHAIN_MAP: Record<number, string> = {
    1: 'Ethereum', 56: 'BSC', 137: 'Polygon', 42161: 'Arbitrum',
    8453: 'Base', 43114: 'Avalanche', 10: 'Optimism', 84532: 'Base Sepolia',
  };

  /* ────── HELPERS ────── */
  const generateId = () => `ref_${Math.random().toString(36).substr(2, 9)}`;
  const fmt = (amt: bigint, dec: number) => amt === 0n ? '0' : parseFloat(formatUnits(amt, dec)).toString();

  /* ────── FETCH TX ────── */
  const fetchTx = useCallback(async (refId: string): Promise<{
    data: Transaction;
    sym: string;
    dec: number;
    chainName: string;
  } | null> => {
    if (!refId.trim() || !client) return null;
    try {
      const data = (await client.readContract({
        address: process.env.NEXT_PUBLIC_PAYNOVA_CONTRACT as Address,
        abi: PayNovaABI,
        functionName: 'getTransaction',
        args: [refId.trim()],
      })) as Transaction;

      const chainId = await client.getChainId();
      const chainName = CHAIN_MAP[chainId] ?? 'Unknown';

      let sym = 'Native', dec = 18;
      if (data.token !== zeroAddress) {
        try {
          const [d, s] = await Promise.all([
            client.readContract({ address: data.token, abi: ERC20_MINIMAL_ABI, functionName: 'decimals' }) as Promise<number>,
            client.readContract({ address: data.token, abi: ERC20_MINIMAL_ABI, functionName: 'symbol' }) as Promise<string>,
          ]);
          dec = d; sym = s || 'TOKEN';
        } catch { sym = 'CUSTOM'; }
      } else {
        sym = ['Ethereum', 'Base', 'Base Sepolia', 'Arbitrum', 'Optimism'].includes(chainName) ? 'ETH'
          : chainName === 'BSC' ? 'BNB'
          : chainName === 'Polygon' ? 'MATIC'
          : chainName === 'Avalanche' ? 'AVAX'
          : 'Native';
      }

      return { data, sym, dec, chainName };
    } catch {
      return null;
    }
  }, [client]);

  const loadTx = async () => {
    setLoading(true);
    const result = await fetchTx(ref);
    if (result) {
      setTx(result.data);
      setSymbol(result.sym);
      setDecimals(result.dec);
      setChain(result.chainName);
    } else {
      toast.error('Transaction not found');
      setTx(null);
    }
    setLoading(false);
  };

  /* ────── PAY (uses context with multicall) ────── */
  const pay = async (refId: string) => {
    if (!user || !client) return;
    setPaying(true);

    const result = await fetchTx(refId);
    if (!result || result.data.status !== 0 || result.data.from !== user) {
      toast.error('Cannot pay: invalid, already paid, or not your transaction');
      setPaying(false);
      return;
    }

    // ---- TOAST FLOW (fixed) ----
    const toastId = toast.loading('Preparing payment…');

    try {
      const hash = await payTransaction(refId, result.data.amount, result.data.token);

      toast.dismiss(toastId);
      const confirmToast = toast.loading('Confirming payment…');

      const receipt = await client.waitForTransactionReceipt({ hash });
      toast.dismiss(confirmToast);

      if (receipt.status === 'success') {
        toast.success('Paid successfully!');
        setShowRefModal(false);
        setShowReceipt(true);
        const updated = await fetchTx(refId);
        if (updated) {
          setTx(updated.data);
          setSymbol(updated.sym);
          setDecimals(updated.dec);
        }
      } else {
        toast.error('Payment reverted');
      }
    } catch (err) {
      toast.dismiss(toastId);
      const e = err as { shortMessage?: string; message?: string };
      toast.error(e.shortMessage || e.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  /* ────── GENERATE TRANSACTION ────── */
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !client) return toast.error('Wallet not connected');

    const isCustom = genForm.tokenType === 'Custom';
    if (!/^0x[a-fA-F0-9]{40}$/.test(genForm.recipient)) return toast.error('Invalid recipient');
    if (isCustom && genForm.tokenAddress && !/^0x[a-fA-F0-9]{40}$/.test(genForm.tokenAddress)) return toast.error('Invalid token address');

    let tokenAddr: Address = zeroAddress;
    let dec = 18;
    let sym = 'ETH';

    if (genForm.tokenType === 'Native') {
      sym = ['Ethereum', 'Base', 'Base Sepolia', 'Arbitrum', 'Optimism'].includes(genForm.chain) ? 'ETH'
        : genForm.chain === 'BSC' ? 'BNB'
        : genForm.chain === 'Polygon' ? 'MATIC'
        : genForm.chain === 'Avalanche' ? 'AVAX'
        : 'ETH';
    } else if (isCustom && genForm.tokenAddress) {
      tokenAddr = genForm.tokenAddress as Address;
      try {
        const [d, s] = await Promise.all([
          client.readContract({ address: tokenAddr, abi: ERC20_MINIMAL_ABI, functionName: 'decimals' }) as Promise<number>,
          client.readContract({ address: tokenAddr, abi: ERC20_MINIMAL_ABI, functionName: 'symbol' }) as Promise<string>,
        ]);
        dec = d; sym = s || 'CUSTOM';
      } catch {
        sym = 'CUSTOM';
      }
    } else {
      const cfg = TOKEN_CONFIG[genForm.chain]?.[genForm.tokenType];
      if (!cfg) return toast.error('Unsupported chain/token');
      tokenAddr = cfg.address;
      dec = cfg.decimals;
      sym = genForm.tokenType;
    }

    const refId = generateId();
    const amount = parseUnits(genForm.amount, dec);

    const toastId = toast.loading('Creating transaction…');
    try {
      setLoading(true);
      const hash = await generateTransaction(genForm.recipient as Address, amount, tokenAddr, refId);
      toast.dismiss(toastId);
      const confirmToast = toast.loading('Confirming on-chain…');

      const receipt = await client.waitForTransactionReceipt({ hash });
      toast.dismiss(confirmToast);

      if (receipt.status === 'success') {
        toast.success('Transaction generated!');
        setGeneratedRef(refId);
        setGeneratedChain(genForm.chain);
        setGeneratedSymbol(sym);
        setGeneratedDecimals(dec);
        setShowGenerateModal(false);
        setShowRefModal(true);
      } else {
        toast.error('Transaction reverted');
      }
    } catch (err) {
      toast.dismiss(toastId);
      const e = err as Error;
      toast.error(`Generate failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  /* ────── TOKEN TYPE CHANGE (Type-Safe) ────── */
  const handleTokenTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as TokenType;
    setGenForm({
      ...genForm,
      tokenType: value,
      tokenAddress: value === 'Custom' ? genForm.tokenAddress : '',
    });
  };

  /* ────── COPY REF ────── */
  const copyRef = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  /* ────── RENDER ────── */
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900">

      {/* ---------- ANIMATED BLOBS ---------- */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-10 left-10 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply blur-xl opacity-60 animate-blob" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-yellow-400 rounded-full mix-blend-multiply blur-xl opacity-50 animate-blob animation-delay-2000" />
        <div className="absolute top-1/3 left-1/3 w-64 h-64 bg-pink-400 rounded-full mix-blend-multiply blur-xl opacity-40 animate-blob animation-delay-4000" />
      </div>

      {/* ---------- HERO + SEARCH ---------- */}
      <section className="relative flex flex-col items-center justify-center px-4 py-20 text-center">
        <h1 className="mb-4 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-5xl font-bold text-transparent md:text-7xl">
          PayNova
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-white/90 md:text-xl">
          Search, pay, or generate crypto transactions – **zero mistakes**.
        </p>

        {/* CTA – Generate */}
        <button
          onClick={() => setShowGenerateModal(true)}
          className="mb-12 flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-4 font-bold text-white shadow-lg transition hover:scale-105"
        >
          <QrCodeIcon className="h-6 w-6" />
          Generate New Transaction
        </button>

        {/* Search Card */}
        <div className="w-full max-w-2xl rounded-2xl bg-white/10 p-6 backdrop-blur-xl shadow-2xl border border-white/20">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold text-white">
              <WalletIcon className="h-6 w-6 text-purple-300" />
              Search & Pay
            </h2>
            {!user && (
              <span className="rounded-full bg-purple-900/50 px-3 py-1 text-xs text-purple-200">
                Connect wallet to pay
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="Reference (e.g. ref_abc123)"
              value={ref}
              onChange={e => setRef(e.target.value)}
              className="flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-purple-200 focus:border-transparent focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={loadTx}
              disabled={loading || !ref.trim()}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 font-bold text-white shadow-lg transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                  Searching…
                </>
              ) : (
                <>
                  Find <ArrowRightIcon className="h-5 w-5" />
                </>
              )}
            </button>
          </div>

          {/* ---------- TX DETAILS ---------- */}
          {tx && (
            <div className="mt-6 rounded-xl bg-white/10 p-5 text-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold text-white">Details</h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    tx.status === 0 ? 'bg-yellow-100 text-yellow-800' :
                    tx.status === 1 ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}
                >
                  {tx.status === 0 ? 'Pending' : tx.status === 1 ? 'Paid' : 'Cancelled'}
                </span>
              </div>

              <dl className="space-y-2">
                <div className="flex justify-between border-b border-white/10 py-1">
                  <dt className="text-purple-200">Ref</dt>
                  <dd className="bg-white/10 rounded px-2 font-mono text-white">{ref}</dd>
                </div>
                <div className="flex justify-between border-b border-white/10 py-1">
                  <dt className="flex items-center text-purple-200"><UserIcon className="mr-1 h-4 w-4" />From</dt>
                  <dd className="font-mono text-xs text-white">{tx.from}</dd>
                </div>
                <div className="flex justify-between border-b border-white/10 py-1">
                  <dt className="flex items-center text-purple-200"><UserIcon className="mr-1 h-4 w-4" />To</dt>
                  <dd className="font-mono text-xs text-white">{tx.to}</dd>
                </div>
                <div className="flex justify-between rounded bg-blue-900/30 px-3 py-2">
                  <dt className="flex items-center font-semibold text-purple-200">
                    <CurrencyDollarIcon className="mr-1 h-4 w-4 text-blue-300" />
                    Amount
                  </dt>
                  <dd className="text-xl font-bold text-white">
                    {fmt(tx.amount, decimals)} <span className="text-purple-200">{symbol}</span>
                  </dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-purple-200">Chain</dt>
                  <dd className="font-semibold text-white">{chain}</dd>
                </div>
              </dl>

              {/* Pay button */}
              {tx.status === 0 && tx.from === user && (
                <button
                  onClick={() => pay(ref)}
                  disabled={paying}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 py-3 font-bold text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-50"
                >
                  {paying ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                      Paying…
                    </>
                  ) : (
                    <>
                      <WalletIcon className="h-5 w-5" />
                      Pay Now
                    </>
                  )}
                </button>
              )}

              {tx.status === 0 && tx.from !== user && (
                <p className="mt-3 text-center text-sm text-yellow-300">
                  Only the original sender can pay.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ────── GENERATE MODAL ────── */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setShowGenerateModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Generate Transaction</h3>
              <button onClick={() => setShowGenerateModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Chain</label>
                <select
                  value={genForm.chain}
                  onChange={e => setGenForm({ ...genForm, chain: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                >
                  <option value="Base Sepolia">Base Sepolia</option>
                  <option value="Ethereum">Ethereum</option>
                  <option value="BSC">BSC</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Token</label>
                <select
                  value={genForm.tokenType}
                  onChange={handleTokenTypeChange}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                >
                  <option value="Native">Native Token</option>
                  <option value="USDT">USDT</option>
                  <option value="USDC">USDC</option>
                  <option value="Custom">Custom Token</option>
                </select>
              </div>

              {genForm.tokenType === 'Custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Token Address</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={genForm.tokenAddress}
                    onChange={e => setGenForm({ ...genForm, tokenAddress: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Recipient</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={genForm.recipient}
                  onChange={e => setGenForm({ ...genForm, recipient: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Amount</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={genForm.amount}
                  onChange={e => setGenForm({ ...genForm, amount: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-3 font-bold text-white shadow-md transition hover:scale-[1.02] disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                    Generating...
                  </>
                ) : (
                  <>
                    Generate Transaction
                    <ArrowRightIcon className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ────── REF MODAL (after generate) ────── */}
      {showRefModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setShowRefModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                <CheckCircleIcon className="h-7 w-7 text-green-500" />
                Ready to Pay
              </h3>
              <button onClick={() => setShowRefModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 p-4 border border-purple-200">
              <p className="text-sm text-gray-700 mb-2">Reference ID</p>
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border">
                <code className="font-mono text-sm text-gray-800 truncate">{generatedRef}</code>
                <button onClick={() => copyRef(generatedRef)} className="ml-2 p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition">
                  <DocumentDuplicateIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-1 text-sm text-gray-600">
              <p><strong>Amount:</strong> {genForm.amount} {generatedSymbol}</p>
              <p><strong>Chain:</strong> {generatedChain}</p>
            </div>

            <button
              onClick={() => pay(generatedRef)}
              disabled={paying}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 py-3 font-bold text-white shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-70"
            >
              {paying ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                  Paying...
                </>
              ) : (
                <>
                  <WalletIcon className="h-5 w-5" />
                  Pay Now
                </>
              )}
            </button>

            <p className="mt-3 text-center text-xs text-gray-500">
              Share this ref to let others pay later
            </p>
          </div>
        </div>
      )}

      {/* ────── RECEIPT MODAL ────── */}
      {showReceipt && tx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm print:hidden" onClick={e => e.target === e.currentTarget && setShowReceipt(false)}>
          <div className="max-w-2xl w-full overflow-y-auto rounded-3xl bg-white shadow-2xl print:max-w-none print:rounded-none print:shadow-none print:border-0">
            <div className="space-y-6 p-8 print:p-12">
              <div className="hidden border-b-2 border-gray-900 pb-8 text-center print:block">
                <h1 className="text-6xl font-bold text-gray-900">PayNova</h1>
                <p className="mt-4 text-4xl font-semibold text-gray-700">Payment Receipt</p>
                <p className="mt-6 text-2xl text-gray-600">Paid on: {new Date().toLocaleString()}</p>
                <p className="text-2xl text-gray-600">Chain: {chain}</p>
              </div>

              <div className="flex items-center justify-between print:justify-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500">
                    <CheckCircleIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Payment Successful!</h3>
                    <p className="text-gray-600">Completed on-chain</p>
                  </div>
                </div>
                <button onClick={() => setShowReceipt(false)} className="text-3xl font-bold text-gray-400 print:hidden">×</button>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white shadow-sm print:border-2 print:print-border-black">
                <div className="border-b border-gray-200 bg-white px-6 py-4">
                  <h4 className="text-lg font-semibold text-gray-900">Payment Details</h4>
                </div>
                <dl className="divide-y divide-gray-200 text-sm">
                  <div className="flex justify-between px-6 py-4">
                    <dt className="flex items-center gap-2 font-medium text-gray-700">
                      <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-600">REF</span>
                      Reference
                    </dt>
                    <dd className="bg-gray-100 rounded px-3 py-1 font-bold text-gray-900">{ref}</dd>
                  </div>
                  <div className="flex justify-between bg-green-50 px-6 py-4">
                    <dt className="flex items-center gap-2 font-semibold text-gray-700">
                      <CurrencyDollarIcon className="h-4 w-4 text-green-600" />
                      Paid
                    </dt>
                    <dd className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                      {fmt(tx.amount, decimals)}
                      <span className="text-lg font-semibold text-green-600">{symbol}</span>
                    </dd>
                  </div>
                  <div className="flex justify-between px-6 py-4">
                    <dt className="flex items-center gap-2 text-gray-700">
                      <UserIcon className="h-4 w-4 text-gray-400" />
                      Paid To
                    </dt>
                    <dd className="break-all font-mono text-sm text-gray-900">{tx.to}</dd>
                  </div>
                  <div className="flex justify-between px-6 py-4">
                    <dt className="flex items-center gap-2 text-gray-700">
                      <ClockIcon className="h-4 w-4 text-gray-400" />
                      Status
                    </dt>
                    <dd>
                      <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">Paid</span>
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-col gap-4 pt-4 sm:flex-row print:hidden">
                <button
                  onClick={() => { setShowReceipt(false); setTx(null); setRef(''); }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-100 py-3 font-semibold text-gray-700 hover:bg-gray-200"
                >
                  <XMarkIcon className="h-5 w-5" />
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 py-3 font-semibold text-white hover:from-green-700 hover:to-emerald-700"
                >
                  Print Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- ANIMATIONS ---------- */}
      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
}