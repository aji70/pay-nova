import { v4 as uuidv4 } from 'uuid';

export const generateId = () => uuidv4();
export const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
export const formatDate = (date: Date) => date.toLocaleString();