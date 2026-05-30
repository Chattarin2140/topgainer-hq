import axios from 'axios';
import { Transaction } from '../types';

const API_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Add token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: async (username: string, email: string, password: string, confirmPassword: string) => {
    const response = await api.post('/auth/register', {
      username,
      email,
      password,
      confirmPassword,
    });
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

export const pricesAPI = {
  // Get single stock price with retry
  getPrice: async (symbol: string, maxRetries = 3): Promise<any> => {
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Valid symbol required');
    }
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await api.get(`/prices/${symbol.trim().toUpperCase()}`, {
          timeout: 10000,
        });
        if (response.data && response.data.price !== undefined) {
          return response.data;
        }
      } catch (error: any) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  },

  // Get multiple prices with retry
  getPrices: async (symbols: string[], maxRetries = 3): Promise<any[]> => {
    if (!Array.isArray(symbols) || symbols.length === 0) {
      throw new Error('Valid symbols array required');
    }
    
    const cleanSymbols = symbols
      .filter(s => typeof s === 'string' && s.trim() !== '')
      .map(s => s.trim().toUpperCase());
    
    if (cleanSymbols.length === 0) {
      throw new Error('No valid symbols in array');
    }
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await api.post('/prices/batch', { symbols: cleanSymbols }, {
          timeout: 15000,
        });
        if (Array.isArray(response.data) && response.data.length > 0) {
          return response.data;
        }
      } catch (error: any) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    return [];
  },

  // Get company profile with retry
  getProfile: async (symbol: string, maxRetries = 3): Promise<any> => {
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Valid symbol required');
    }
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await api.get(`/prices/profile/${symbol.trim().toUpperCase()}`, {
          timeout: 10000,
        });
        if (response.data && response.data.name) {
          return response.data;
        }
      } catch (error: any) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  },
};

export const optionPricesAPI = {
  // Get single option price with retry
  getPrice: async (symbol: string, maxRetries = 3): Promise<any> => {
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Valid symbol required');
    }
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await api.get(`/option-prices/${symbol.trim().toUpperCase()}`, {
          timeout: 10000,
        });
        if (response.data && response.data.price !== undefined) {
          return response.data;
        }
      } catch (error: any) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  },

  // Get multiple option prices with retry
  getPrices: async (symbols: string[], maxRetries = 3): Promise<any[]> => {
    if (!Array.isArray(symbols) || symbols.length === 0) {
      throw new Error('Valid symbols array required');
    }
    
    const cleanSymbols = symbols
      .filter(s => typeof s === 'string' && s.trim() !== '')
      .map(s => s.trim().toUpperCase());
    
    if (cleanSymbols.length === 0) {
      throw new Error('No valid symbols in array');
    }
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await api.post('/option-prices/batch', { symbols: cleanSymbols }, {
          timeout: 15000,
        });
        if (Array.isArray(response.data) && response.data.length > 0) {
          return response.data;
        }
      } catch (error: any) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    return [];
  },
};

export const transactionAPI = {
  // Get all transactions
  getAll: async (): Promise<Transaction[]> => {
    const response = await api.get('/transactions');
    return response.data;
  },

  // Get transactions by symbol
  getBySymbol: async (symbol: string): Promise<Transaction[]> => {
    const response = await api.get(`/transactions/symbol/${symbol}`);
    return response.data;
  },

  // Create transaction
  create: async (data: Partial<Transaction>): Promise<Transaction> => {
    const response = await api.post('/transactions', data);
    return response.data;
  },

  // Update transaction
  update: async (id: string, data: Partial<Transaction>): Promise<Transaction> => {
    const response = await api.put(`/transactions/${id}`, data);
    return response.data;
  },

  // Delete transaction
  delete: async (id: string): Promise<void> => {
    await api.delete(`/transactions/${id}`);
  },

  // Health check
  healthCheck: async (): Promise<boolean> => {
    try {
      const response = await api.get('/health');
      return response.status === 200;
    } catch {
      return false;
    }
  },
};

export default api;
