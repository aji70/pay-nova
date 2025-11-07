import ReceiptViewer from '@/components/ReceiptViewer';

export default function ReceiptsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Query Receipts & Proofs</h1>
      <ReceiptViewer />
    </div>
  );
}