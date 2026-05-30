import PositionsList from '../components/PositionsList';
import { useTransactionStore } from '../utils/store';
import { useEffect, useMemo } from 'react';
import { calculateTotalPL } from '../utils/calculations';

export default function Portfolio() {
  const transactions = useTransactionStore((state) => state.transactions);
  const fetchTransactions = useTransactionStore((state) => state.fetchTransactions);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const summary = useMemo(() => {
    const buys = transactions.filter((t) => t.type === 'buy');
    const sells = transactions.filter((t) => t.type === 'sell');
    
    let totalCapitalInvested = 0;
    buys.forEach((t) => {
      totalCapitalInvested += t.quantity * t.price;
    });

    const stats = calculateTotalPL(buys, sells);
    return { ...stats, totalCapitalInvested };
  }, [transactions]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Portfolio</h1>
        <p className="text-gray-600">ดูสรุปพอร์ตโฟลิโอและสถิติที่เปิดอยู่</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-gray-600 text-sm mb-1">ทุนลงทุนรวม</p>
          <p className="text-2xl font-bold text-blue-600">
            ${summary.totalCapitalInvested.toFixed(2)}
          </p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm mb-1">Gross P&L</p>
          <p className={`text-2xl font-bold ${summary.totalGrossPL >= 0 ? 'text-profit' : 'text-loss'}`}>
            {summary.totalGrossPL >= 0 ? '+' : ''}${summary.totalGrossPL.toFixed(2)}
          </p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm mb-1">Net P&L</p>
          <p className={`text-2xl font-bold ${summary.totalNetPL >= 0 ? 'text-profit' : 'text-loss'}`}>
            {summary.totalNetPL >= 0 ? '+' : ''}${summary.totalNetPL.toFixed(2)}
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Position ที่เปิดอยู่</h2>
        <PositionsList />
      </div>
    </div>
  );
}
