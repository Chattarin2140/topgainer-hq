import { useState } from 'react';
import { Transaction } from '../types';
import { useTransactionStore } from '../utils/store';

interface Props {
  onSuccess?: () => void;
}

export default function TransactionForm({ onSuccess }: Props) {
  const addTransaction = useTransactionStore((state) => state.addTransaction);
  const loading = useTransactionStore((state) => state.loading);
  
  const [formData, setFormData] = useState<Partial<Transaction>>({
    symbol: '',
    type: 'buy',
    assetType: 'stock',
    quantity: 1,
    price: 0,
    commission: 0,
    date: new Date().toISOString().split('T')[0],
  });
  const [message, setMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'quantity' || name === 'price' || name === 'commission'
        ? parseFloat(value) || 0
        : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.symbol || !formData.quantity || !formData.price) {
      setMessage('โปรดกรอกข้อมูลให้ครบ');
      return;
    }

    try {
      await addTransaction({
        ...formData,
        date: new Date(formData.date + 'T00:00:00Z'),
      } as Partial<Transaction>);
      
      setMessage('✅ บันทึกสำเร็จ');
      setFormData({
        symbol: '',
        type: 'buy',
        assetType: 'stock',
        quantity: 1,
        price: 0,
        commission: 0,
        date: new Date().toISOString().split('T')[0],
      });

      setTimeout(() => {
        setMessage('');
        onSuccess?.();
      }, 1500);
    } catch (error) {
      setMessage('❌ เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">บันทึกรายการใหม่</h2>
      {message && (
        <div className={`mb-4 p-3 rounded ${message.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">สัญลักษณ์หุ้น</label>
            <input
              type="text"
              name="symbol"
              value={formData.symbol || ''}
              onChange={handleChange}
              placeholder="เช่น AAPL, BTC"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ประเภท</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="buy">ซื้อ (Buy)</option>
              <option value="sell">ขาย (Sell)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">ประเภทสินทรัพย์</label>
            <select
              name="assetType"
              value={formData.assetType}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="stock">หุ้น (Stock)</option>
              <option value="option">ออปชั่น (Option)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">วันที่</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">จำนวน</label>
            <input
              type="number"
              name="quantity"
              value={formData.quantity || ''}
              onChange={handleChange}
              placeholder="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ราคา</label>
            <input
              type="number"
              name="price"
              value={formData.price || ''}
              onChange={handleChange}
              placeholder="เช่น 0.3, 0.6, 2.50"
              step="any"
              min="0"
              inputMode="decimal"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ค่าธรรมเนียม</label>
            <input
              type="number"
              name="commission"
              value={formData.commission || ''}
              onChange={handleChange}
              placeholder="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
        </div>

        <button 
          type="submit" 
          className="btn-primary w-full disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </form>
    </div>
  );
}
