import { useState, useEffect } from 'react';
import { useTransactionStore } from '../utils/store';
import { pricesAPI } from '../utils/api';

interface PriceData {
  [key: string]: number;
}

export default function Settings() {
  const [settings, setSettings] = useState({
    currency: 'USD',
    commissionRate: 0,
    taxRate: 0,
  });

  const [prices, setPrices] = useState<PriceData>(() => {
    const saved = localStorage.getItem('currentPrices');
    return saved ? JSON.parse(saved) : {};
  });

  const [newSymbol, setNewSymbol] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const transactions = useTransactionStore((state) => state.transactions);
  const clearAll = useTransactionStore((state) => state.clearAll);

  const symbols = Array.from(new Set(transactions.map((t) => t.symbol)));

  const handleSettingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: name === 'currency' ? value : parseFloat(value) || 0,
    }));
  };

  const handleSavePrice = () => {
    if (!newSymbol || !newPrice) {
      alert('โปรดกรอกสัญลักษณ์และราคา');
      return;
    }

    const updated = {
      ...prices,
      [newSymbol.toUpperCase()]: parseFloat(newPrice),
    };
    setPrices(updated);
    localStorage.setItem('currentPrices', JSON.stringify(updated));
    setNewSymbol('');
    setNewPrice('');
    alert('✅ บันทึกราคาสำเร็จ');
  };

  const handleDeletePrice = (symbol: string) => {
    const updated = { ...prices };
    delete updated[symbol];
    setPrices(updated);
    localStorage.setItem('currentPrices', JSON.stringify(updated));
  };

  const handleRefreshPrices = async () => {
    if (symbols.length === 0) {
      alert('ไม่มีสัญลักษณ์ที่ต้องอัปเดต');
      return;
    }

    setRefreshing(true);
    try {
      // Validate symbols before API call
      const validSymbols = symbols.filter(s => typeof s === 'string' && s.trim() !== '');
      if (validSymbols.length === 0) {
        alert('❌ ไม่มีสัญลักษณ์ที่ถูกต้อง');
        setRefreshing(false);
        return;
      }
      
      const results = await pricesAPI.getPrices(validSymbols);
      if (Array.isArray(results) && results.length > 0) {
        const updated = { ...prices };
        let count = 0;
        
        results.forEach((result: any) => {
          if (result && result.symbol && typeof result.price === 'number' && result.price > 0) {
            updated[result.symbol] = result.price;
            count++;
          }
        });
        
        if (count > 0) {
          setPrices(updated);
          localStorage.setItem('currentPrices', JSON.stringify(updated));
          alert(`✅ อัปเดตราคา ${count} สัญลักษณ์สำเร็จ`);
        } else {
          alert('⚠️ ไม่ได้รับข้อมูลราคาที่ถูกต้องจาก API');
        }
      } else {
        alert('⚠️ ไม่ได้รับข้อมูลจาก API');
      }
    } catch (error: any) {
      console.error('Failed to refresh prices:', error);
      alert('❌ ไม่สามารถดึงราคาจาก API ได้\n\nสาเหตุ:\n- ตรวจสอบ Finnhub API key ใน backend/.env\n- เครือข่ายอาจมีปัญหา\n- API rate limit อาจเกิน');
    } finally {
      setRefreshing(false);
    }
  };

  const handleClearData = async () => {
    if (window.confirm('คุณแน่ใจหรือไม่? การลบข้อมูลไม่สามารถกู้คืนได้')) {
      try {
        await clearAll();
        alert('ลบข้อมูลทั้งหมดสำเร็จ');
      } catch {
        alert('❌ เกิดข้อผิดพลาดในการลบข้อมูล');
      }
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
    alert('✅ บันทึกการตั้งค่าสำเร็จ');
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-gray-600">ตั้งค่าค่าธรรมเนียมและราคาปัจจุบัน</p>
      </div>

      {/* Settings */}
      <div className="card max-w-md">
        <h2 className="text-xl font-bold mb-4">⚙️ การตั้งค่า</h2>
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">สกุลเงิน</label>
            <select
              name="currency"
              value={settings.currency}
              onChange={handleSettingChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="USD">USD ($)</option>
              <option value="THB">THB (฿)</option>
              <option value="EUR">EUR (€)</option>
              <option value="JPY">JPY (¥)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">อัตราค่าธรรมเนียม (%)</label>
            <input
              type="number"
              name="commissionRate"
              value={settings.commissionRate}
              onChange={handleSettingChange}
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">อัตราภาษี (%)</label>
            <input
              type="number"
              name="taxRate"
              value={settings.taxRate}
              onChange={handleSettingChange}
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button type="button" onClick={handleSaveSettings} className="btn-primary w-full">
            บันทึก
          </button>
        </form>
      </div>

      {/* Current Prices */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">💰 ราคาปัจจุบัน</h2>
        <p className="text-gray-600 text-sm mb-4">ตั้งค่าราคาปัจจุบันของแต่ละสัญลักษณ์ (สำหรับคำนวณ P&L)</p>

        {/* Refresh from API Button */}
        {symbols.length > 0 && (
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700 mb-2">🌐 ดึงราคาปัจจุบันจาก Finnhub API</p>
            <button
              onClick={handleRefreshPrices}
              disabled={refreshing}
              className="btn btn-primary w-full text-sm"
            >
              {refreshing ? '⏳ กำลังดึงราคา...' : '🔄 อัปเดตราคาจาก API'}
            </button>
          </div>
        )}

        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">สัญลักษณ์</label>
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              placeholder="เช่น AAPL, BTC"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ราคาปัจจุบัน</label>
            <input
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="0.00"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="button" onClick={handleSavePrice} className="btn-primary w-full">
            บันทึกราคา
          </button>
        </div>

        {/* Price List */}
        {symbols.length > 0 && (
          <div>
            <h3 className="font-bold mb-3">📊 ราคาที่บันทึกไว้</h3>
            <div className="space-y-2">
              {symbols.map((symbol) => (
                <div
                  key={symbol}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{symbol}</p>
                    <p className="text-sm text-gray-600">
                      ${prices[symbol]?.toFixed(2) || 'ยังไม่ได้ตั้งค่า'}
                    </p>
                  </div>
                  {prices[symbol] && (
                    <button
                      onClick={() => handleDeletePrice(symbol)}
                      className="btn btn-danger text-xs"
                    >
                      ลบ
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="card max-w-md">
        <h2 className="text-xl font-bold mb-4">⚠️ Danger Zone</h2>
        <button onClick={handleClearData} className="btn-danger w-full">
          🗑️ ลบข้อมูลทั้งหมด
        </button>
      </div>

      {/* Payment */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">💳 วิธีการชำระเงิน</h2>
        <p className="text-gray-600 mb-4">ยังไม่มีการชำระเงินในขณะนี้ (Free Version)</p>
        <button className="btn-primary w-full" disabled>
          🔒 Pinecart (Coming Soon)
        </button>
      </div>
    </div>
  );
}
