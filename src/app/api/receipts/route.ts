import { NextRequest, NextResponse } from 'next/server';
import { Receipt } from '@/types';

let receipts: Receipt[] = []; // In-memory mock

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const filtered = receipts.filter(r => 
    r.id.includes(query) || r.transactionId.includes(query)
  );
  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const { transactionId, proof } = await request.json();
  const newReceipt: Receipt = {
    id: crypto.randomUUID(),
    transactionId,
    paidAt: new Date(),
    proof,
  };
  receipts.push(newReceipt);
  // Update transaction status
  // (In a real app, fetch/update transactions)
  return NextResponse.json(newReceipt, { status: 201 });
}