'use client';
import { useState, useEffect } from 'react';
import { Receipt } from '@/types';
import { formatDate } from '@/lib/utils';
import ReceiptPDF from './ReceiptPDF';

export default function ReceiptViewer() {
  const [query, setQuery] = useState('');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selected, setSelected] = useState<Receipt | null>(null);

//   useEffect(() => {
//     if (query) {
//       fetchReceipts();
//     }
//   }, [query]);

  const fetchReceipts = async () => {
    const res = await fetch(`/api/receipts?q=${encodeURIComponent(query)}`);
    setReceipts(await res.json());
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold">Query Receipts</h2>
      <input
        type="text"
        placeholder="Search by reference or ID"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <div className="space-y-2">
        {receipts.map((r) => (
          <div key={r.id} className="border p-2 rounded cursor-pointer hover:bg-gray-100" onClick={() => setSelected(r)}>
            <p>ID: {r.id}</p>
            <p>Paid: {formatDate(r.paidAt)}</p>
            <p>Proof: {r.proof.method} - {r.proof.details}</p>
          </div>
        ))}
      </div>
      {selected && (
        <div>
          <h3>Receipt Details</h3>
          <ReceiptPDF receipt={selected} transactionId={selected.transactionId} />
        </div>
      )}
    </div>
  );
}