'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePayNovaContract } from '@/context/PayNovaProvider';
import { useAccount, usePublicClient } from 'wagmi';
import {
  Address,
  zeroAddress,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  formatUnits,
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

  const { address: user } = useAccount();
  const { payTransaction } = usePayNovaContract();
  const client = usePublicClient();

  const CHAIN_MAP: Record<number, string> = {
    1: 'Ethereum', 56: 'BSC', 137: 'Polygon', 42161: 'Arbitrum',
    8453: 'Base', 43114: 'Avalanche', 10: 'Optimism',
  };

  /* ────── HELPERS ────── */
  const refHash = (s: string) => keccak256(encodeAbiParameters(parseAbiParameters('string'), [s.trim()]));

  const fmt = (amt: bigint, dec: number) => amt === 0n ? '0' : parseFloat(formatUnits(amt, dec)).toString();

  /* ────── FETCH TX ────── */
  const fetchTx = useCallback(async () => {
    if (!ref.trim() || !client) return;
    setLoading(true);
    try {
      const data = (await client.readContract({
        address: '0xfea50f270763F34DD644fE241429f6e8494A680F' as Address,
        abi: PayNovaABI,
        functionName: 'getTransaction',
        args: [ref.trim()],
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
        sym = chainName === 'Ethereum' ? 'ETH'
          : chainName === 'BSC' ? 'BNB'
          : chainName === 'Polygon' ? 'MATIC'
          : chainName === 'Avalanche' ? 'AVAX'
          : 'Native';
      }

      setTx(data);
      setSymbol(sym);
      setDecimals(dec);
      setChain(chainName);
    } catch (e) {
      toast.error(`Not found – ${(e as Error).message}`);
      setTx(null);
    } finally {
      setLoading(false);
    }
  }, [ref, client]);

  /* ────── PAY ────── */
  const pay = async () => {
  if (!tx || !user || tx.status !== 0 || tx.from !== user) return;
  setPaying(true);

  try {
    const isNative = tx.token === zeroAddress;
    console.log('Is native:', isNative);
    console.log('tx amount:', tx.amount);
    console.log("Creator (from):", tx.from);
    console.log("Current wallet:", user);
    console.log('To', tx.to)

    // Pass msg.value as bigint directly, not an object
    const hash = await payTransaction(
      refHash(ref),
      tx.amount,
      isNative ? tx.amount : undefined
    );

    // Optional: handle receipt
    const id = toast.loading('Confirming…');
    const rcpt = await client!.waitForTransactionReceipt({ hash });
    toast.dismiss(id);
    if (rcpt.status === 'success') {
      toast.success('Paid!');
      setShowReceipt(true);
      await fetchTx();
    } else toast.error('Reverted');
  } 
  catch (e) {
    toast.error(`Pay failed – ${(e as Error).message}`);
  } 
  finally {
    setPaying(false);
  }
};


  /* ────── MODAL ────── */
  const close = () => { setShowReceipt(false); setTx(null); setRef(''); };
  const print = () => window.print();

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
        <Link
          href="/generate"
          className="mb-12 flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-4 font-bold text-white shadow-lg transition hover:scale-105"
        >
          <QrCodeIcon className="h-6 w-6" />
          Generate New Transaction
        </Link>

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
              placeholder="Reference (e.g. abc123)"
              value={ref}
              onChange={e => setRef(e.target.value)}
              className="flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-purple-200 focus:border-transparent focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={fetchTx}
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
                  onClick={pay}
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

              {/* {tx.status === 1 && <p className="mt-3 text-center text-green-300">Already paid</p>}
              {tx.status === 2 && <p className="mt-3 text-center text-red-300">Cancelled</p>} */}
            </div>
          )}
        </div>
      </section>

      {/* ---------- RECEIPT MODAL ---------- */}
      {showReceipt && tx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm print:hidden"
          onClick={e => e.target === e.currentTarget && close()}
        >
          <div className="max-w-2xl w-full overflow-y-auto rounded-3xl bg-white shadow-2xl print:max-w-none print:rounded-none print:shadow-none print:border-0">
            <div className="space-y-6 p-8 print:p-12">
              {/* Print-only header */}
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
                <button onClick={close} className="text-3xl font-bold text-gray-400 print:hidden">×</button>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white shadow-sm print:border-2 print:border-black">
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
                  onClick={close}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-100 py-3 font-semibold text-gray-700 hover:bg-gray-200"
                >
                  <XMarkIcon className="h-5 w-5" />
                  Close
                </button>
                <button
                  onClick={print}
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