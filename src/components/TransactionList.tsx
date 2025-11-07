'use client';

import { useState, useCallback } from 'react';
import { usePayNovaContract } from '../context/PayNovaProvider';
import { useAccount, usePublicClient } from 'wagmi';
import { Address, zeroAddress, keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';
import PayNovaABI from '../context/abi.json';
import toast from 'react-hot-toast';
import {
  CurrencyDollarIcon,
  UserIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon,
  WalletIcon,
  ArrowRightIcon,
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

export default function TransactionList() {
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
        address: '0xF4075597b631fFb2Ea78f6C5BD9d248aB0eF9828' as Address,
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
            publicClient.readContract({ address: data.token, abi: ERC20_MINIMAL_ABI, functionName: 'decimals' }) as Promise<number>,
            publicClient.readContract({ address: data.token, abi: ERC20_MINIMAL_ABI, functionName: 'symbol' }) as Promise<string>,
          ]);
          dec = d;
          symbol = s || 'TOKEN';
        } catch {
          symbol = 'CUSTOM';
        }
      } else {
        symbol = chain === 'Ethereum' ? 'ETH' :
                 chain === 'BSC' ? 'BNB' :
                 chain === 'Polygon' ? 'MATIC' :
                 chain === 'Avalanche' ? 'AVAX' : 'Native';
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
      const refHash = getRefHash(ref);
      const isNative = transaction.token === zeroAddress;
      const value = isNative ? transaction.amount : undefined;

      const hash = await payTransaction(refHash, transaction.amount, value);

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
    } finally {
      setPaying(false);
    }
  };

  const formatAmount = (amt: bigint, dec: number) =>
    (Number(amt) / 10 ** dec).toFixed(8).replace(/\.?0+$/, '') || '0';

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
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center px-5 py-2.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
            <span className="text-2xl">PayNova</span>
            <h1 className="ml-3 text-2xl font-bold text-white">PayNova</h1>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4">Pay Existing Transaction</h2>
          <p className="text-lg sm:text-xl text-purple-100 max-w-2xl mx-auto leading-relaxed">
            Enter the transaction reference to view and pay.
          </p>
        </div>

        {/* Search Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center">
              <WalletIcon className="w-6 h-6 mr-2 text-purple-300" />
              Find & Pay
            </h3>
            {!userAddress && (
              <span className="text-xs text-purple-200 bg-purple-900/50 px-3 py-1 rounded-full">
                Wallet Required to Pay
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Enter Transaction Reference (e.g., abc123)"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
            />
            <button
              onClick={fetchTransaction}
              disabled={loading || !ref.trim()}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-xl font-bold shadow-lg hover:from-purple-700 hover:to-blue-700 focus:ring-4 focus:ring-purple-500/50 transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span>Find Transaction</span>
                  <ArrowRightIcon className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Transaction Display */}
        {transaction && (
          <div className="mt-8 bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Transaction Details</h3>
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
                transaction.status === 0 ? 'bg-yellow-100 text-yellow-800' :
                transaction.status === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {transaction.status === 0 ? 'Pending' : transaction.status === 1 ? 'Paid' : 'Cancelled'}
              </span>
            </div>

            <dl className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <dt className="text-purple-200 flex items-center space-x-2">
                  <span className="bg-purple-100 text-purple-600 px-2 py-1 rounded-full text-xs font-semibold">REF</span>
                  Reference
                </dt>
                <dd className="font-mono text-white bg-white/10 px-3 py-1 rounded-lg">{ref}</dd>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <dt className="text-purple-200 flex items-center"><UserIcon className="w-4 h-4 mr-2" /> From</dt>
                <dd className="text-white font-mono text-xs sm:text-sm break-all">{transaction.from}</dd>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <dt className="text-purple-200 flex items-center"><UserIcon className="w-4 h-4 mr-2" /> To</dt>
                <dd className="text-white font-mono text-xs sm:text-sm break-all">{transaction.to}</dd>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10 bg-blue-900/30 rounded-lg px-4">
                <dt className="text-purple-200 font-semibold flex items-center">
                  <CurrencyDollarIcon className="w-4 h-4 mr-2 text-blue-300" /> Amount
                </dt>
                <dd className="text-2xl font-bold text-white">
                  {formatAmount(transaction.amount, decimals)} {tokenSymbol}
                </dd>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <dt className="text-purple-200 flex items-center"><CurrencyDollarIcon className="w-4 h-4 mr-2" /> Token</dt>
                <dd className="text-white font-mono text-sm">
                  {transaction.token === zeroAddress ? `Native (${tokenSymbol})` : transaction.token}
                </dd>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <dt className="text-purple-200 flex items-center"><ClockIcon className="w-4 h-4 mr-2" /> Generated</dt>
                <dd className="text-white">{new Date(Number(transaction.timestamp) * 1000).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between items-center py-3">
                <dt className="text-purple-200">Chain</dt>
                <dd className="text-white font-semibold">{chainName}</dd>
              </div>
            </dl>

            {/* Pay Button */}
            {transaction.status === 0 && transaction.from === userAddress && (
              <button
                onClick={handlePay}
                disabled={paying}
                className="mt-6 w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-6 rounded-xl font-bold shadow-lg hover:from-green-700 hover:to-emerald-700 focus:ring-4 focus:ring-green-500/50 transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
              >
                {paying ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <WalletIcon className="w-5 h-5" />
                    <span>Pay Now</span>
                  </>
                )}
              </button>
            )}

            {transaction.status === 0 && transaction.from !== userAddress && (
              <p className="mt-4 text-yellow-300 text-center text-sm">
                Only the original sender can pay this transaction.
              </p>
            )}

            {transaction.status !== 0 && (
              <p className="mt-4 text-center text-white">
                {transaction.status === 1 ? 'This transaction has already been paid.' : 'This transaction is cancelled.'}
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
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[95vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible print:rounded-none print:shadow-none print:border-0 print:bg-white border border-gray-200">
            <div className="p-8 space-y-6 print:p-12">
              <div className="hidden print:block text-center mb-12 border-b-2 border-gray-900 pb-8">
                <h1 className="text-6xl font-bold text-gray-900">PayNova</h1>
                <p className="text-4xl font-semibold mt-4 text-gray-700">Payment Receipt</p>
                <p className="text-2xl mt-6 text-gray-600">Paid on: {new Date().toLocaleString()}</p>
                <p className="text-2xl text-gray-600">Chain: {chainName}</p>
              </div>

              <div className="flex justify-between items-center print:justify-center">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
                    <CheckCircleIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Payment Successful!</h3>
                    <p className="text-gray-600">Transaction completed on-chain</p>
                  </div>
                </div>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-3xl font-bold print:hidden">
                  ×
                </button>
              </div>

              <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl overflow-hidden shadow-sm border border-gray-200 print:border-2 print:border-black">
                <div className="bg-white px-6 py-4 border-b border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900">Payment Details</h4>
                </div>
                <dl className="divide-y divide-gray-200 text-sm">
                  <div className="px-6 py-4 flex justify-between items-center">
                    <dt className="font-medium text-gray-700 flex items-center space-x-2">
                      <span className="bg-purple-100 text-purple-600 px-2 py-1 rounded-full text-xs font-semibold">REF</span>
                      Reference
                    </dt>
                    <dd className="font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">{ref}</dd>
                  </div>
                  <div className="px-6 py-4 flex justify-between items-center bg-green-50">
                    <dt className="text-gray-700 font-semibold flex items-center space-x-2">
                      <CurrencyDollarIcon className="w-4 h-4 text-green-600" /> Paid
                    </dt>
                    <dd className="text-2xl font-bold text-gray-900">
                      {formatAmount(transaction.amount, decimals)} {tokenSymbol}
                    </dd>
                  </div>
                  <div className="px-6 py-4 flex justify-between items-center">
                    <dt className="text-gray-700 flex items-center space-x-2"><UserIcon className="w-4 h-4 text-gray-400" /> Paid To</dt>
                    <dd className="text-gray-900 font-mono text-sm break-all">{transaction.to}</dd>
                  </div>
                  <div className="px-6 py-4 flex justify-between items-center">
                    <dt className="text-gray-700 flex items-center space-x-2"><ClockIcon className="w-4 h-4 text-gray-400" /> Status</dt>
                    <dd>
                      <span className="inline-flex px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                        Paid
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-6 print:hidden">
                <button
                  onClick={closeModal}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-200 transition-all font-semibold flex items-center justify-center space-x-2"
                >
                  <XMarkIcon className="w-5 h-5" />
                  <span>Close</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-6 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-semibold flex items-center justify-center space-x-2"
                >
                  <span>Print Receipt</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
      `}</style>
    </div>
  );
}