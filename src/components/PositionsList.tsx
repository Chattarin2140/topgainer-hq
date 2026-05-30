import { useMemo, useState, useEffect } from 'react';
import { useTransactionStore } from '../utils/store';
import { calculatePosition } from '../utils/calculations';
import { pricesAPI, optionPricesAPI } from '../utils/api';

// Get display price for average cost (divide by multiplier for options)
const getDisplayAverageCost = (averageCost: number, assetType: string): number => {
  return assetType === 'option' ? averageCost / 100 : averageCost;
};

export default function PositionsList() {
  const transactions = useTransactionStore((state) => state.transactions);
  const [apiPrices, setApiPrices] = useState<Record<string, number>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);

  // Fetch prices from API with error handling
  useEffect(() => {
    const fetchPrices = async () => {
      const transactions_list = transactions;
      if (transactions_list.length === 0) {
        setApiPrices({});
        return;
      }

      // Separate stock and option symbols
      const stockSymbols = Array.from(new Set(
        transactions_list
          .filter(t => t.assetType === 'stock')
          .map(t => t.symbol)
      ));
      
      const optionSymbols = Array.from(new Set(
        transactions_list
          .filter(t => t.assetType === 'option')
          .map(t => t.symbol)
      ));

      setLoadingPrices(true);
      try {
        const priceMap: Record<string, number> = {};

        // Fetch stock prices
        if (stockSymbols.length > 0) {
          try {
            const stockResults = await pricesAPI.getPrices(stockSymbols);
            if (Array.isArray(stockResults) && stockResults.length > 0) {
              stockResults.forEach((result: any) => {
                if (result && result.symbol && typeof result.price === 'number') {
                  priceMap[result.symbol] = result.price;
                }
              });
            }
          } catch (error) {
            console.error('Failed to fetch stock prices:', error);
          }
        }

        // Fetch option prices
        if (optionSymbols.length > 0) {
          try {
            const optionResults = await optionPricesAPI.getPrices(optionSymbols);
            if (Array.isArray(optionResults) && optionResults.length > 0) {
              optionResults.forEach((result: any) => {
                if (result && result.symbol && typeof result.price === 'number') {
                  priceMap[result.symbol] = result.price;
                }
              });
            }
          } catch (error) {
            console.error('Failed to fetch option prices:', error);
          }
        }

        if (Object.keys(priceMap).length > 0) {
          setApiPrices(priceMap);
        } else {
          console.warn('No price data returned from API');
        }
      } catch (error) {
        console.error('Failed to fetch prices from API:', error);
        // Don't clear prices on error - fall back to localStorage
      } finally {
        setLoadingPrices(false);
      }
    };

    const timeoutId = setTimeout(fetchPrices, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [transactions]);

  const { positions, portfolioSummary } = useMemo(() => {
    const symbols = new Set(transactions.map((t) => t.symbol));
    const buys = transactions.filter((t) => t.type === 'buy');
    const sells = transactions.filter((t) => t.type === 'sell');

    // ดึงราคาจาก localStorage
    const localPrices = JSON.parse(localStorage.getItem('currentPrices') || '{}');

    const pos = [];
    let totalCurrentValue = 0;
    let totalCost = 0;
    let totalNetPL = 0;

    symbols.forEach((symbol) => {
      // ลำดับความสำคัญ: API → localStorage → 0
      const currentPrice = apiPrices[symbol as string] || localPrices[symbol as string] || 0;
      const position = calculatePosition(symbol as string, buys, sells, currentPrice);
      if (position && position.quantity > 0) {
        position.priceSource = apiPrices[symbol as string] ? 'API' : 'Manual';
        pos.push(position);
        
        // Accumulate totals
        totalCurrentValue += position.currentValue;
        totalCost += position.totalCost;
        totalNetPL += position.netPL;
      }
    });

    const changePercentage = totalCost > 0 ? (totalNetPL / totalCost) * 100 : 0;

    return {
      positions: pos,
      portfolioSummary: {
        totalCurrentValue,
        totalCost,
        totalNetPL,
        changePercentage,
        positionCount: pos.length,
      }
    };
  }, [transactions, apiPrices]);

  if (positions.length === 0) {
    return (
      <div className="card">
        <p className="text-gray-500 text-center py-8">
          ไม่มี Position ที่เปิดอยู่ (หรือยังไม่ได้ตั้งค่าราคาปัจจุบัน)
        </p>
        <p className="text-gray-400 text-center text-sm">
          💡 ไปที่ Settings → ตั้งค่าราคาปัจจุบันของแต่ละสัญลักษณ์
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loadingPrices && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
          ⏳ กำลังดึงราคาจากตลาด...
        </div>
      )}

      {/* Portfolio Summary Section */}
      <div className="card bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold">Portfolio Overview</h2>
            <p className="text-blue-100 text-sm mt-1">{portfolioSummary.positionCount} positions</p>
          </div>
          <span className={`text-lg font-bold px-4 py-2 rounded-lg ${
            portfolioSummary.totalNetPL >= 0 
              ? 'bg-green-500/30 text-green-100' 
              : 'bg-red-500/30 text-red-100'
          }`}>
            {portfolioSummary.totalNetPL >= 0 ? '+' : ''}${portfolioSummary.totalNetPL.toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-blue-100 text-sm mb-1">Current Value</p>
            <p className="text-2xl font-bold">${portfolioSummary.totalCurrentValue.toFixed(2)}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-blue-100 text-sm mb-1">Total Cost</p>
            <p className="text-2xl font-bold">${portfolioSummary.totalCost.toFixed(2)}</p>
          </div>
          <div className={`rounded-lg p-4 ${
            portfolioSummary.changePercentage >= 0 
              ? 'bg-green-500/20' 
              : 'bg-red-500/20'
          }`}>
            <p className="text-blue-100 text-sm mb-1">Change %</p>
            <p className={`text-2xl font-bold ${
              portfolioSummary.changePercentage >= 0 
                ? 'text-green-300' 
                : 'text-red-300'
            }`}>
              {portfolioSummary.changePercentage >= 0 ? '+' : ''}{portfolioSummary.changePercentage.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Positions Grid */}
      <div>
        <h3 className="text-lg font-bold mb-4">Positions</h3>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {positions.map((pos) => (
            <div key={pos.symbol} className="card hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold">{pos.symbol}</h3>
                  <p className="text-xs text-gray-400">
                    {pos.assetType === 'option' ? 'Option' : 'Stock'} • <span className={pos.priceSource === 'API' ? 'text-green-600 font-semibold' : 'text-orange-600'}>{pos.priceSource}</span>
                  </p>
                </div>
                <span
                  className={`badge ${
                    pos.netPL >= 0 ? 'badge-profit' : 'badge-loss'
                  }`}
                >
                  {pos.netPL >= 0 ? '+' : ''}
                  {pos.netPL.toFixed(2)}
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Quantity</p>
                    <p className="font-bold">{pos.quantity}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Avg Cost</p>
                    <p className="font-bold">${getDisplayAverageCost(pos.averageCost, pos.assetType).toFixed(4)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Current Price</p>
                    <p className="font-bold">${pos.currentPrice.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Current Value</p>
                    <p className="font-bold">${pos.currentValue.toFixed(2)}</p>
                  </div>
                </div>

                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Cost:</span>
                    <span className="font-bold">${pos.totalCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-gray-600">P&L %:</span>
                    <span
                      className={`font-bold ${
                        pos.netPL >= 0 ? 'text-profit' : 'text-loss'
                      }`}
                    >
                      {pos.plPercentage >= 0 ? '+' : ''}{pos.plPercentage.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
