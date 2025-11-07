import { NextRequest, NextResponse } from 'next/server';
import { Transaction } from '@/types';

let transactions: Transaction[] = []; // In-memory mock (use DB in prod)

export async function GET() {
  return NextResponse.json(transactions);
}

export async function POST(request: NextRequest) {
  const { recipient, amount, reference } = await request.json();
  const newTx: Transaction = {
    id: crypto.randomUUID(),
    recipient,
    amount: Number(amount),
    reference,
    status: 'pending',
    createdAt: new Date(),
  };
  transactions.push(newTx);
  return NextResponse.json(newTx, { status: 201 });
}