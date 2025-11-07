export interface Transaction {
  id: string;
  recipient: string;
  amount: number;
  reference: string;
  status: 'pending' | 'paid';
  createdAt: Date;
}

export interface Receipt {
  id: string;
  transactionId: string;
  paidAt: Date;
  proof: {
    method: 'bank_transfer' | 'card';
    details: string;
  };
}