'use client';

import { useState, useCallback, useEffect } from 'react';
import { generateId } from '@/lib/utils';
import { usePayNovaContract } from '../context/PayNovaProvider';
import { useAccount, usePublicClient } from 'wagmi';
import {
  Address,
  parseUnits,
  zeroAddress,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  formatUnits,
} from 'viem';
import PayNovaABI from '../context/abi.json';
import toast from 'react-hot-toast';
import {
  ChevronDownIcon,
  CurrencyDollarIcon,
  UserIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowRightIcon,
  WalletIcon,
  DocumentDuplicateIcon,
  QrCodeIcon,
} from '@heroicons/react/24/outline';

// ---------------------------------------------------------------------
// TOKEN CONFIG
// ---------------------------------------------------------------------
const TOKEN_CONFIG: Record<
  string,
  Record<string, { address: Address; decimals: number }>
> = {
  'Base Sepolia': {
    USDT: { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address, decimals: 6 },
    USDC: { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address, decimals: 6 },
  },
  Ethereum: {
    USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Address, decimals: 6 },
    USDC: { address: '0xA0b86a33E641E66e2aD2d4fC5E9B6b8C9e5D8b4f' as Address, decimals: 6 },
  },
  BSC: {
    USDT: { address: '0x55d398326f99059fF775485246999027B3197955' as Address, decimals: 18 },
    USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' as Address, decimals: 18 },
  },
};

const ERC20_MINIMAL_ABI = [
  { inputs: [], name: 'decimals', outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ internalType: 'string', name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
] as const;

// ---------------------------------------------------------------------
// TYPE
// ---------------------------------------------------------------------
type Transaction = {
  from: Address;
  to: Address;
  amount: bigint;
  token: Address;
  timestamp: bigint;
  status: 0 | 1 | 2;
  refunded: bigint;
};

// ---------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------
export default function TransactionForm() {
  /* ----------------------- FORM STATE ----------------------- */
  const [form, setForm] = useState({
    recipient: '',
    amount: '',
    chain: 'Base Sepolia',
    tokenType: 'Native' as 'Native' | 'USDT' | 'USDC' | 'Custom',
    tokenAddress: '',
  });

  /* ----------------------- UI STATE ----------------------- */
  const [loading, setLoading] = useState(false);
  const [showRefModal, setShowRefModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [generatedRef, setGeneratedRef] = useState<string>('');
  const [txnDecimals, setTxnDecimals] = useState<number>(18);
  const [generatedChain, setGeneratedChain] = useState<string>('');
  const [generatedTokenSymbol, setGeneratedTokenSymbol] = useState<string>('');
  const [paying, setPaying] = useState(false);
  const [payRefInput, setPayRefInput] = useState('');

  /* ----------------------- WAGMI ----------------------- */
  const { address: userAddress } = useAccount();
  const { generateTransaction, payTransaction } = usePayNovaContract();
  const publicClient = usePublicClient();

  /* ----------------------- HELPERS ----------------------- */
  const generateRef = useCallback(() => generateId(), []);
  const refHash = (s: string) =>
    keccak256(encodeAbiParameters(parseAbiParameters('string'), [s.trim()]));
  const fmt = (amt: bigint, dec: number) =>
    amt === 0n ? '0' : parseFloat(formatUnits(amt, dec)).toString();

  /* ----------------------- FETCH INVOICE ----------------------- */
  const fetchInvoice = useCallback(
    async (ref: string) => {
      if (!publicClient) return null;
      try {
        return (await publicClient.readContract({
          address: '0x255fa702cD54462fa664842bc8D66A3c0528AC8b' as Address,
          abi: PayNovaABI,
          functionName: 'getTransaction',
          args: [ref],
        })) as Transaction;
      } catch {
        return null;
      }
    },
    [publicClient]
  );

  /* ----------------------- GENERATE ----------------------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress) return toast.error('Wallet not connected');
    if (!publicClient) return toast.error('Network client not available');

    setLoading(true);
    setShowRefModal(false);

    const ref = generateRef();
    const isCustom = form.tokenType === 'Custom';

    // ---- validation -------------------------------------------------
    if (!/^0x[a-fA-F0-9]{40}$/.test(form.recipient)) {
      toast.error('Invalid recipient address');
      setLoading(false);
      return;
    }
    if (isCustom && form.tokenAddress && !/^0x[a-fA-F0-9]{40}$/.test(form.tokenAddress)) {
      toast.error('Invalid token address');
      setLoading(false);
      return;
    }

    // ---- token config ------------------------------------------------
    let tokenAddr: Address = zeroAddress;
    let decimals = 18;
    let tokenSymbol = 'ETH';

    if (form.tokenType === 'Native') {
      tokenAddr = zeroAddress;
      tokenSymbol =
        form.chain === 'Base Sepolia' ? 'ETH' :
        form.chain === 'Ethereum' ? 'ETH' :
        form.chain === 'BSC' ? 'BNB' :
        form.chain === 'Polygon' ? 'MATIC' :
        form.chain === 'Avalanche' ? 'AVAX' : 'ETH';
    } else if (isCustom) {
      tokenAddr = (form.tokenAddress || zeroAddress) as Address;
      if (tokenAddr !== zeroAddress) {
        try {
          const [dec, sym] = await Promise.all([
            publicClient.readContract({ address: tokenAddr, abi: ERC20_MINIMAL_ABI, functionName: 'decimals' }) as Promise<number>,
            publicClient.readContract({ address: tokenAddr, abi: ERC20_MINIMAL_ABI, functionName: 'symbol' }) as Promise<string>,
          ]);
          decimals = dec;
          tokenSymbol = sym || 'CUSTOM';
        } catch {
          toast.error('Failed to fetch token info – using 18 decimals');
          tokenSymbol = 'CUSTOM';
        }
      }
    } else {
      const cfg = TOKEN_CONFIG[form.chain]?.[form.tokenType];
      if (!cfg) {
        toast.error('Unsupported chain/token');
        setLoading(false);
        return;
      }
      tokenAddr = cfg.address;
      decimals = cfg.decimals;
      tokenSymbol = form.tokenType;
    }

    setTxnDecimals(decimals);
    setGeneratedTokenSymbol(tokenSymbol);
    setGeneratedChain(form.chain);
    setGeneratedRef(ref);

    const amountUnits = parseUnits(form.amount, decimals);
    const recipient = form.recipient as Address;

    // ---- contract call ------------------------------------------------
    let hash: `0x${string}` | undefined;
    try {
      hash = await generateTransaction(recipient, amountUnits, tokenAddr, ref);
      toast.success(`Submitted! Ref: ${ref}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown';
      toast.error(`Submit failed: ${msg}`);
      setLoading(false);
      return;
    }

    // ---- wait for confirmation ----------------------------------------
    try {
      const toastId = toast.loading('Confirming on-chain...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      toast.dismiss(toastId);
      if (receipt.status === 'success') {
        toast.success('Transaction generated!');
        setShowRefModal(true);
      } else {
        toast.error('Transaction reverted');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown';
      toast.error(`Confirmation error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  /* ----------------------- PAY (from ref modal) ----------------------- */
  const pay = async (ref: string) => {
    if (!userAddress || !publicClient) return;

    setPaying(true);
    const invoice = await fetchInvoice(ref);
    if (!invoice || invoice.status !== 0) {
      toast.error('Invalid or already paid transaction');
      setPaying(false);
      return;
    }

    const isNative = invoice.token === zeroAddress;

    try {
      const hash = await payTransaction(
        ref,
        invoice.amount,
        isNative ? invoice.amount : undefined
      );

      const id = toast.loading('Confirming payment…');
      const rcpt = await publicClient.waitForTransactionReceipt({ hash });
      toast.dismiss(id);

      if (rcpt.status === 'success') {
        toast.success('Paid successfully!');
        setShowRefModal(false);
        setShowPayModal(false);
      } else {
        toast.error('Payment reverted');
      }
    } catch (e) {
      toast.error(`Pay failed – ${(e as Error).message}`);
    } finally {
      setPaying(false);
    }
  };

  /* ----------------------- COPY REF ----------------------- */
  const copyRef = (ref: string) => {
    navigator.clipboard.writeText(ref);
    toast.success('Reference copied!');
  };

  /* ----------------------- TOKEN TYPE CHANGE ----------------------- */
  const handleTokenTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value as 'Native' | 'USDT' | 'USDC' | 'Custom';
    setForm({
      ...form,
      tokenType: v,
      ...(v !== 'Custom' ? { tokenAddress: '' } : {}),
    });
  };

  const isCustom = form.tokenType === 'Custom';

  /* ----------------------- RENDER ----------------------- */
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
          <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4">Create & Pay Securely</h2>
          <p className="text-lg sm:text-xl text-purple-100 max-w-2xl mx-auto leading-relaxed">
            Generate a transaction first — review, then pay with zero mistakes.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center">
              <WalletIcon className="w-6 h-6 mr-2 text-purple-300" />
              Generate Transaction
            </h3>
            {!userAddress && (
              <span className="text-xs text-purple-200 bg-purple-900/50 px-3 py-1 rounded-full">
                Wallet Required
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Chain */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2 flex items-center">
                <ClockIcon className="w-4 h-4 mr-2 text-purple-300" />
                Network
              </label>
              <select
                value={form.chain}
                onChange={(e) => setForm({ ...form, chain: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm custom-select"
                required
              >
                <option value="Base Sepolia">Base Sepolia (ETH)</option>
                <option value="Ethereum">Ethereum (ETH)</option>
                <option value="BSC">BSC (BNB)</option>
                <option value="Polygon">Polygon (MATIC)</option>
                <option value="Arbitrum">Arbitrum (ETH)</option>
                <option value="Base">Base (ETH)</option>
                <option value="Avalanche">Avalanche (AVAX)</option>
                <option value="Optimism">Optimism (ETH)</option>
              </select>
            </div>

            {/* Token Type */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2 flex items-center">
                <CurrencyDollarIcon className="w-4 h-4 mr-2 text-purple-300" />
                Token
              </label>
              <select
                value={form.tokenType}
                onChange={handleTokenTypeChange}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm custom-select"
                required
              >
                <option value="Native">Native Token</option>
                <option value="USDT">USDT</option>
                <option value="USDC">USDC</option>
                <option value="Custom">Custom Token</option>
              </select>
            </div>

            {/* Custom Token Address */}
            {isCustom && (
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Token Address</label>
                <input
                  type="text"
                  placeholder="0x…"
                  value={form.tokenAddress}
                  onChange={(e) => setForm({ ...form, tokenAddress: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
                  required
                />
              </div>
            )}

            {/* Recipient */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2 flex items-center">
                <UserIcon className="w-4 h-4 mr-2 text-purple-300" />
                Recipient
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={form.recipient}
                onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
                required
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2 flex items-center">
                <CurrencyDollarIcon className="w-4 h-4 mr-2 text-purple-300" />
                Amount
              </label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
                required
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                type="submit"
                disabled={loading || !userAddress}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 px-6 rounded-xl font-bold shadow-lg hover:from-purple-700 hover:to-blue-700 focus:ring-4 focus:ring-purple-500/50 transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Transaction</span>
                    <ArrowRightIcon className="w-5 h-5" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowPayModal(true)}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-4 px-6 rounded-xl font-bold shadow-lg hover:from-emerald-700 hover:to-teal-700 focus:ring-4 focus:ring-emerald-500/50 transform hover:scale-[1.02] transition-all duration-300 flex items-center justify-center space-x-2"
              >
                <WalletIcon className="w-5 h-5" />
                <span>Pay Existing</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* --------------------------------------------------------------- */}
      {/* REF MODAL (after generate) */}
      {/* --------------------------------------------------------------- */}
      {showRefModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setShowRefModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <CheckCircleIcon className="w-7 h-7 text-green-500" />
                Transaction Ready
              </h3>
              <button onClick={() => setShowRefModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-200">
              <p className="text-sm text-gray-700 mb-2">Reference ID</p>
              <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border">
                <code className="font-mono text-sm text-gray-800 truncate">{generatedRef}</code>
                <button
                  onClick={() => copyRef(generatedRef)}
                  className="ml-2 p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition"
                >
                  <DocumentDuplicateIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Amount:</strong> {form.amount} {generatedTokenSymbol}</p>
              <p><strong>Chain:</strong> {generatedChain}</p>
            </div>

            <button
              onClick={() => pay(generatedRef)}
              disabled={paying}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-xl font-bold shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
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

            <p className="text-xs text-center text-gray-500">
              Share this ref with anyone to pay later
            </p>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------- */}
      {/* PAY EXISTING MODAL */}
      {/* --------------------------------------------------------------- */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setShowPayModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <QrCodeIcon className="w-7 h-7 text-emerald-500" />
                Pay Existing
              </h3>
              <button onClick={() => setShowPayModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Enter Reference ID</label>
              <input
                type="text"
                placeholder="ref_abc123..."
                value={payRefInput}
                onChange={(e) => setPayRefInput(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm"
              />
            </div>

            <button
              onClick={() => pay(payRefInput.trim())}
              disabled={paying || !payRefInput.trim()}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-bold shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {paying ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                  Processing...
                </>
              ) : (
                <>
                  <WalletIcon className="h-5 w-5" />
                  Pay Now
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* STYLES & ANIMATIONS */}
      {/* ---------------------------------------------------------------- */}
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

        .custom-select {
          appearance: none;
          background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%228%22%20viewBox%3D%220%200%2012%208%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M0%2C0%20L12%2C0%20L6%2C8%20L0%2C0%22%2F%3E%3C%2Fsvg%3E");
          background-repeat: no-repeat;
          background-position: right 1rem center;
          background-size: 12px;
          padding-right: 3rem !important;
        }
        .custom-select option { color: #1f2937; background: #ffffff; }
      `}</style>
    </div>
  );
}