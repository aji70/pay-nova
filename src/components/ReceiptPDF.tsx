'use client';
import { PDFDownloadLink, Document, Page, Text, View } from '@react-pdf/renderer';
import { Receipt } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

const styles = {
  page: { padding: 30 },
  section: { margin: 10, padding: 10 },
  title: { fontSize: 24, textAlign: 'center' as const },
};

export default function ReceiptPDF({ receipt, transactionId }: { receipt: Receipt; transactionId: string }) {
  // Fetch transaction details mockingly (in prod, API call)
  const mockTx = { amount: 100, reference: 'REF123' }; // Replace with real fetch

  return (
    <PDFDownloadLink document={
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.title}>Pay-Nova Receipt</Text>
            <Text>Receipt ID: {receipt.id}</Text>
            <Text>Transaction ID: {transactionId}</Text>
            <Text>Amount: {formatCurrency(mockTx.amount)}</Text>
            <Text>Reference: {mockTx.reference}</Text>
            <Text>Paid At: {formatDate(receipt.paidAt)}</Text>
            <Text>Proof: {receipt.proof.method.toUpperCase()} - {receipt.proof.details}</Text>
          </View>
        </Page>
      </Document>
    } fileName={`receipt-${receipt.id}.pdf`}>
      {({ blob, url, loading, error }) => (loading ? 'Loading...' : <button className="bg-blue-500 text-white px-4 py-2 rounded">Download Receipt</button>)}
    </PDFDownloadLink>
  );
}