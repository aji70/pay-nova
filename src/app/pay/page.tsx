'use client';

import { useState, useCallback } from 'react';
import { usePayNovaContract } from '../../context/PayNovaProvider';
import { useAccount, usePublicClient } from 'wagmi';
import {
  Address,
  zeroAddress,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  formatUnits,
} from 'viem';
import PayNovaABI from '../../context/abi.json';
import toast from 'react-hot-toast';
import {
  CurrencyDollarIcon,
  UserIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon,
  WalletIcon,
  ArrowRightIcon,
  SparklesIcon,
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

export default function PayPage() {
  const [ref, setRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState('Native');
  const [decimals, setDecimals] = useState(18);
  const [chainName, setChainName] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);

  const { address: userAddress } = useAccount();
  const { payTransaction } = usePayNovaContract();
  const publicClient = usePublicClient();

  const CHAIN_NAMES: Record<number, string> = {
    1: 'Ethereum',
    56: 'BSC',
    137: 'Polygon',
    42161: 'Arbitrum',
    8453: 'Base',
    84531: 'Base Sepolia',
    43114: 'Avalanche',
    10: 'Optimism',
  };

  const getRefHash = (refStr: string): `0x${string}` => {
    return keccak256(encodeAbiParameters(parseAbiParameters('string'), [refStr.trim()]));
  };

  const fetchTransaction = useCallback(async () => {
    if (!ref.trim() || !publicClient) return;

    setLoading(true);
    try {
      const data = (await publicClient.readContract({
        address: '0x255fa702cD54462fa664842bc8D66A3c0528AC8b' as Address,
        abi: PayNovaABI,
        functionName: 'getTransaction',
        args: [ref.trim()],
      })) as Transaction;

      const chainId = await publicClient.getChainId();
      const chain = CHAIN_NAMES[chainId] || 'Unknown';

      let symbol = 'Native';
      let dec = 18;

      if (data.token !== zeroAddress) {
        try {
          const [d, s] = await Promise.all([
            publicClient.readContract({
              address: data.token,
              abi: ERC20_MINIMAL_ABI,
              functionName: 'decimals',
            }) as Promise<number>,
            publicClient.readContract({
              address: data.token,
              abi: ERC20_MINIMAL_ABI,
              functionName: 'symbol',
            }) as Promise<string>,
          ]);
          dec = d;
          symbol = s || 'TOKEN';
        } catch {
          symbol = 'CUSTOM';
        }
      } else {
        symbol =
          chain === 'Ethereum' || chain === 'Base' || chain === 'Base Sepolia' ? 'ETH' :
          chain === 'BSC' ? 'BNB' :
          chain === 'Polygon' ? 'MATIC' :
          chain === 'Avalanche' ? 'AVAX' : 'ETH';
      }

      setTransaction(data);
      setTokenSymbol(symbol);
      setDecimals(dec);
      setChainName(chain);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Transaction not found: ${msg}`);
      setTransaction(null);
    } finally {
      setLoading(false);
    }
  }, [ref, publicClient]);

  const handlePay = async () => {
    if (!transaction || !userAddress || transaction.status !== 0) return;
    if (transaction.from !== userAddress) {
      toast.error('Only the original sender can pay');
      return;
    }

    setPaying(true);
    try {
      const isNative = transaction.token === zeroAddress;
      const value = isNative ? transaction.amount : undefined;

      const hash = await payTransaction(ref, transaction.amount, value);

      const toastId = toast.loading('Waiting for confirmation...');
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      toast.dismiss(toastId);

      if (receipt.status === 'success') {
        toast.success('Payment successful!');
        setShowReceipt(true);
        await fetchTransaction();
      } else {
        toast.error('Transaction reverted');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown';
      toast.error(`Payment failed: ${msg}`);
      console.log(`Payment failed: ${msg}`)
    } finally {
      setPaying(false);
    }
  };

  const formatAmount = (amt: bigint, dec: number): string => {
    if (amt === 0n) return '0';
    try {
      const formatted = formatUnits(amt, dec);
      return parseFloat(formatted).toString();
    } catch {
      return 'Error';
    }
  };

  const closeModal = () => {
    setShowReceipt(false);
    setTransaction(null);
    setRef('');
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) closeModal();
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 py-8 px-4 sm:py-12 sm:px-6 lg:px-8 overflow-hidden">
      {/* TOP SPACING BELOW NAVBAR */}
      <div className="mt-6" />

      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14">
          <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 flex items-center justify-center gap-3">
            <SparklesIcon className="w-10 h-10 text-yellow-300" />
            Pay with Confidence
            <SparklesIcon className="w-10 h-10 text-yellow-300" />
          </h2>
          <p className="text-lg sm:text-xl text-purple-100 max-w-2xl mx-auto leading-relaxed">
            Enter the transaction reference to review and pay securely.
          </p>
        </div>

        {/* Search Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 sm:p-8 space-y-6 transform hover:scale-[1.005] transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center">
              <WalletIcon className="w-7 h-7 mr-2 text-emerald-300" />
              Find & Pay Transaction
            </h3>
            {!userAddress && (
              <span className="text-xs text-purple-200 bg-purple-900/50 px-3 py-1 rounded-full animate-pulse">
                Wallet Required to Pay
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Enter reference (e.g., 78438a6f-416c-47e9-ab51-8e5378d193e4)"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              className="flex-1 px-5 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-base font-medium custom-input"
            />
            <button
              onClick={fetchTransaction}
              disabled={loading || !ref.trim()}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 px-8 rounded-xl font-bold shadow-lg hover:from-emerald-600 hover:to-teal-700 focus:ring-4 focus:ring-emerald-500/50 transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span>Find</span>
                  <ArrowRightIcon className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Transaction Display */}
        {transaction && (
          <div className="mt-8 bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 sm:p-8 transform hover:scale-[1.005] transition-all duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Transaction Details</h3>
              <span
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold shadow-md ${
                  transaction.status === 0
                    ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50'
                    : transaction.status === 1
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                    : 'bg-red-500/20 text-red-300 border border-red-500/50'
                }`}
              >
                {transaction.status === 0 ? (
                  <>
                    <ClockIcon className="w-4 h-4" /> Pending
                  </>
                ) : transaction.status === 1 ? (
                  <>
                    <CheckCircleIcon className="w-4 h-4" /> Paid
                  </>
                ) : (
                  <>
                    <XMarkIcon className="w-4 h-4" /> Cancelled
                  </>
                )}
              </span>
            </div>

            <dl className="space-y-5 text-sm">
              <div className="flex justify-between items-center py-4 border-b border-white/10">
                <dt className="text-purple-200 flex items-center space-x-2">
                  <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs font-bold">REF</span>
                  Reference
                </dt>
                <dd className="font-mono text-white bg-white/10 px-4 py-2 rounded-lg text-sm">{ref}</dd>
              </div>

              <div className="flex justify-between items-center py-4 border-b border-white/10">
                <dt className="text-purple-200 flex items-center">
                  <UserIcon className="w-5 h-5 mr-2 text-purple-300" /> From
                </dt>
                <dd className="text-white font-mono text-xs sm:text-sm break-all">{transaction.from}</dd>
              </div>

              <div className="flex justify-between items-center py-4 border-b border-white/10">
                <dt className="text-purple-200 flex items-center">
                  <UserIcon className="w-5 h-5 mr-2 text-purple-300" /> To
                </dt>
                <dd className="text-white font-mono text-xs sm:text-sm break-all">{transaction.to}</dd>
              </div>

              <div className="flex justify-between items-center py-5 bg-gradient-to-r from-emerald-900/30 to-teal-900/30 rounded-xl px-5 border border-emerald-500/30">
                <dt className="text-purple-100 font-bold flex items-center text-lg">
                  <CurrencyDollarIcon className="w-6 h-6 mr-2 text-emerald-400" /> Amount
                </dt>
                <dd className="text-3xl font-bold text-white flex items-center gap-2">
                  <span>{formatAmount(transaction.amount, decimals)}</span>
                  <span className="text-xl text-emerald-300 font-semibold">{tokenSymbol}</span>
                </dd>
              </div>

              <div className="flex justify-between items-center py-4 border-b border-white/10">
                <dt className="text-purple-200 flex items-center">
                  <CurrencyDollarIcon className="w-5 h-5 mr-2 text-purple-300" /> Token
                </dt>
                <dd className="text-white font-mono text-sm">
                  {transaction.token === zeroAddress ? `Native (${tokenSymbol})` : transaction.token}
                </dd>
              </div>

              <div className="flex justify-between items-center py-4 border-b border-white/10">
                <dt className="text-purple-200 flex items-center">
                  <ClockIcon className="w-5 h-5 mr-2 text-purple-300" /> Generated
                </dt>
                <dd className="text-white">{new Date(Number(transaction.timestamp) * 1000).toLocaleString()}</dd>
              </div>

              <div className="flex justify-between items-center py-4">
                <dt className="text-purple-200">Chain</dt>
                <dd className="text-white font-bold text-lg">{chainName}</dd>
              </div>
            </dl>

            {/* Pay Button */}
            {transaction.status === 0 && transaction.from === userAddress && (
              <button
                onClick={handlePay}
                disabled={paying}
                className="mt-8 w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-5 px-6 rounded-xl font-bold text-lg shadow-xl hover:from-emerald-600 hover:to-teal-700 focus:ring-4 focus:ring-emerald-500/50 transform hover:scale-105 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-3"
              >
                {paying ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <WalletIcon className="w-6 h-6" />
                    <span>Pay Now</span>
                  </>
                )}
              </button>
            )}

            {transaction.status === 0 && transaction.from !== userAddress && (
              <p className="mt-6 text-yellow-300 text-center font-medium">
                Only the original sender can pay this transaction.
              </p>
            )}

            {transaction.status !== 0 && (
              <p className="mt-6 text-center text-white font-medium">
                {transaction.status === 1
                  ? 'This transaction has already been paid.'
                  : 'This transaction is cancelled.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Success Receipt Modal */}
      {showReceipt && transaction && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden"
          onClick={handleBackdropClick}
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[95vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible print:rounded-none print:shadow-none print:border-0 print:bg-white border-4 border-gradient-to-r from-emerald-500 to-teal-600 p-1">
            <div className="bg-white rounded-3xl p-8 space-y-6 print:p-12">
              <div className="hidden print:block text-center mb-12 border-b-4 border-emerald-600 pb-8">
                <h1 className="text-7xl font-bold text-emerald-600 mb-4">PayNova</h1>
                <p className="text-5xl font-bold text-gray-800">Payment Receipt</p>
                <p className="text-3xl mt-6 text-gray-600">Paid on: {new Date().toLocaleString()}</p>
                <p className="text-3xl text-gray-600">Chain: {chainName}</p>
              </div>

              <div className="flex justify-between items-center print:justify-center">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <CheckCircleIcon className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-gray-900">Payment Successful!</h3>
                    <p className="text-gray-600 text-lg">Transaction confirmed on-chain</p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 text-4xl font-bold print:hidden"
                >
                  ×
                </button>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl overflow-hidden shadow-lg border-2 border-emerald-200 print:border-4 print:border-emerald-600">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4">
                  <h4 className="text-xl font-bold">Payment Summary</h4>
                </div>
                <dl className="divide-y divide-emerald-200 text-base print:text-lg">
                  <div className="px-6 py-5 flex justify-between items-center">
                    <dt className="font-bold text-gray-700 flex items-center space-x-2">
                      <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded-full text-sm font-bold">REF</span>
                      Reference
                    </dt>
                    <dd className="font-bold text-gray-900 bg-gray-100 px-4 py-2 rounded-lg">{ref}</dd>
                  </div>

                  <div className="px-6 py-5 flex justify-between items-center bg-emerald-100/50">
                    <dt className="text-gray-700 font-bold flex items-center space-x-2 text-lg">
                      <CurrencyDollarIcon className="w-6 h-6 text-emerald-600" /> Paid
                    </dt>
                    <dd className="text-3xl font-bold text-emerald-700 flex items-center gap-2">
                      <span>{formatAmount(transaction.amount, decimals)}</span>
                      <span className="text-xl text-emerald-600 font-bold">{tokenSymbol}</span>
                    </dd>
                  </div>

                  <div className="px-6 py-5 flex justify-between items-center">
                    <dt className="text-gray-700 flex items-center space-x-2">
                      <UserIcon className="w-5 h-5 text-gray-500" /> Paid To
                    </dt>
                    < dd className="text-gray-900 font-mono text-sm break-all">{transaction.to}</dd>
                  </div>

                  <div className="px-6 py-5 flex justify-between items-center">
                    <dt className="text-gray-700 flex items-center space-x-2">
                      <ClockIcon className="w-5 h-5 text-gray-500" /> Status
                    </dt>
                    <dd>
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-base font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircleIcon className="w-5 h-5" /> Paid
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-6 print:hidden">
                <button
                  onClick={closeModal}
                  className="flex-1 bg-gray-100 text-gray-700 py-4 px-6 rounded-xl hover:bg-gray-200 transition-all font-bold text-lg flex items-center justify-center space-x-2"
                >
                  <XMarkIcon className="w-6 h-6" />
                  <span>Close</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-4 px-6 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all font-bold text-lg flex items-center justify-center space-x-2"
                >
                  <span>Print Receipt</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM STYLES */}
      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }

        .custom-input {
          appearance: none;
          background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20fill%3D%22%23a78bfa%22%20d%3D%22M8%2012l-4-4%201.5-1.5L8%209l4.5-4.5L14%206l-6%206z%22%2F%3E%3C%2Fsvg%3E");
          background-repeat: no-repeat;
          background-position: right 1rem center;
          background-size: 16px;
          padding-right: 3rem;
        }

        /* Gradient border for receipt */
        .border-gradient-to-r {
          background: linear-gradient(to right, #10b981, #14b8a6);
          padding: 2px;
        }
      `}</style>
    </div>
  );
}