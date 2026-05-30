import { create } from 'zustand';
import { Transaction } from '../types';
import { transactionAPI } from './api';

interface TransactionStore {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchTransactions: () => Promise<void>;
  addTransaction: (transaction: Partial<Transaction>) => Promise<void>;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;

  // Getters
  getTransactions: () => Transaction[];
  getTransactionsBySymbol: (symbol: string) => Transaction[];
  getTransactionsByType: (type: 'buy' | 'sell') => Transaction[];
}

export const useTransactionStore = create<TransactionStore>((set, get) => ({
  transactions: [],
  loading: false,
  error: null,

  fetchTransactions: async () => {
    set({ loading: true, error: null });
    try {
      const data = await transactionAPI.getAll();
      if (!Array.isArray(data)) {
        throw new Error('Invalid transactions data format');
      }
      set({ transactions: data, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch transactions';
      set({ error: message, loading: false, transactions: [] });
      console.error('Error fetching transactions:', error);
    }
  },

  addTransaction: async (transaction) => {
    if (!transaction.symbol || !transaction.type || typeof transaction.price !== 'number' || typeof transaction.quantity !== 'number') {
      const error = 'Missing required transaction fields';
      set({ error });
      throw new Error(error);
    }
    
    set({ loading: true, error: null });
    try {
      const newTransaction = await transactionAPI.create(transaction);
      if (!newTransaction || !newTransaction._id) {
        throw new Error('Invalid transaction response');
      }
      set((state) => ({
        transactions: [...state.transactions, newTransaction],
        loading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add transaction';
      set({ error: message, loading: false });
      console.error('Error adding transaction:', error);
      throw error;
    }
  },

  updateTransaction: async (id, updates) => {
    if (!id) {
      throw new Error('Transaction ID required');
    }
    
    set({ loading: true, error: null });
    try {
      const response = await transactionAPI.update(id, updates);
      if (!response) {
        throw new Error('Invalid update response');
      }
      set((state) => ({
        transactions: state.transactions.map((t) =>
          (t._id || t.id) === id ? response : t
        ),
        loading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update transaction';
      set({ error: message, loading: false });
      console.error('Error updating transaction:', error);
      throw error;
    }
  },

  deleteTransaction: async (id) => {
    if (!id) {
      throw new Error('Transaction ID required');
    }
    
    set({ loading: true, error: null });
    try {
      await transactionAPI.delete(id);
      set((state) => ({
        transactions: state.transactions.filter((t) => (t._id || t.id) !== id),
        loading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete transaction';
      set({ error: message, loading: false });
      console.error('Error deleting transaction:', error);
      throw error;
    }
  },

  clearAll: async () => {
    set({ loading: true, error: null });
    try {
      const txList = get().transactions;
      await Promise.all(
        txList.map((t) => {
          const id = t._id || t.id;
          return id ? transactionAPI.delete(id) : Promise.resolve();
        })
      );
      set({ transactions: [], loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear all transactions';
      set({ error: message, loading: false });
      throw error;
    }
  },

  getTransactions: () => get().transactions,

  getTransactionsBySymbol: (symbol) =>
    get().transactions.filter((t) => t.symbol === symbol),

  getTransactionsByType: (type) =>
    get().transactions.filter((t) => t.type === type),
}));
